package com.muslimrecovery.protection.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.system.OsConstants
import android.util.Log
import androidx.core.app.NotificationCompat
import com.muslimrecovery.protection.MainActivity
import com.muslimrecovery.protection.dns.DnsFilteringEngine
import com.muslimrecovery.protection.dns.DnsPacketProcessor
import com.muslimrecovery.protection.dns.DnsProxyStatus
import com.muslimrecovery.protection.dns.DnsRuntimeStopReason
import com.muslimrecovery.protection.dns.ExperimentalDnsCounters
import com.muslimrecovery.protection.dns.ExperimentalDnsTestRules
import com.muslimrecovery.protection.dns.Ipv4Address
import com.muslimrecovery.protection.dns.Ipv4UdpDnsPacketAdapter
import com.muslimrecovery.protection.dns.UpstreamDnsSelection
import com.muslimrecovery.protection.dns.UpstreamDnsSelector
import com.muslimrecovery.protection.dns.UpstreamRefusalReason
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState
import java.io.IOException
import java.net.InetAddress

/**
 * M1-04 VPN lifecycle foundation + M1-05 standard-DNS filtering EXPERIMENT (D11: DNS-only
 * split-tunnel packet processing).
 *
 * The tunnel is DNS-only: the TUN gets one address ([TUN_ADDRESS]), the system resolver is pointed
 * at a virtual DNS server ([VIRTUAL_DNS_ADDRESS]), and the ONLY route is that virtual DNS server's
 * /32. There is no default route (never `0.0.0.0/0` or `::/0`), so ordinary traffic never enters
 * the TUN; only packets addressed to the virtual DNS server do, and [DnsProxyRuntime] handles those.
 *
 * Before establishing anything, the underlying network is inspected and the experiment refuses to
 * start if Private DNS is active there (it never downgrades Private DNS to plaintext) or if no
 * usable underlying DNS server exists. None of this makes `filteringOperational` true: see
 * [VpnRuntimeFacts.toProtectionSignals] — `ProtectionState.Protected` stays unreachable in M1-05.
 *
 * All lifecycle decisions (idempotent start/stop, failure handling, revoke) are delegated to
 * [VpnLifecycleController], a pure class with no Android dependency, so that decision logic is
 * unit tested off-device. This class only does the Android-framework side effects the
 * controller's decisions call for: building the TUN, running as a foreground service, starting and
 * stopping the DNS runtime, and publishing the resulting facts to [VpnRuntimeStatus] for the UI.
 *
 * [tunnel], [dnsRuntime] and [dnsProxyStatus] are resources jointly owned with [lifecycle]'s state:
 * every read or write of them is done inside `synchronized(lifecycle)`, the same monitor
 * [lifecycle]'s own `@Synchronized` methods use. This closes a real race Android's contract allows:
 * [onRevoke] "might not happen on the main thread" per the platform docs, so a revoke can arrive
 * while [establishTunnel] is still in flight on another thread. Without this lock, a tunnel could
 * finish establishing after a concurrent revoke already moved the controller back to STOPPED, get
 * assigned to [tunnel] anyway, and never be closed by anything — a leaked native file descriptor.
 * The DNS runtime reports self-stops from its own worker thread, so the same lock applies there.
 */
class LocalProtectionVpnService : VpnService() {

    private val lifecycle = VpnLifecycleController()
    private var tunnel: ParcelFileDescriptor? = null
    private var dnsRuntime: DnsProxyRuntime? = null
    private var dnsProxyStatus: DnsProxyStatus = DnsProxyStatus.NOT_RUNNING

    private val runtimeListener = object : DnsProxyRuntime.Listener {
        override fun onCountersChanged(counters: ExperimentalDnsCounters) {
            VpnRuntimeStatus.updateDnsCounters(counters)
        }

        override fun onRuntimeStopped(runtime: DnsProxyRuntime, reason: DnsRuntimeStopReason) {
            handleRuntimeStopped(runtime, reason)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startTunnel()
            ACTION_STOP -> stopTunnel()
            else -> {
                Log.w(TAG, "onStartCommand with unexpected action=${intent?.action}")
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startTunnel() {
        when (lifecycle.onStartRequested()) {
            VpnLifecycleController.StartDecision.AlreadyInProgress -> {
                publishState()
            }

            VpnLifecycleController.StartDecision.ProceedToEstablish -> {
                synchronized(lifecycle) { dnsProxyStatus = DnsProxyStatus.NOT_RUNNING }
                VpnRuntimeStatus.updateDnsCounters(ExperimentalDnsCounters())

                // Must call startForeground() promptly after the service is started, before any
                // further work, per Android's foreground-service contract. startForeground()
                // can itself throw (foreground-service restrictions, FGS type eligibility, or
                // permissions) — never call establish() if the service isn't legitimately
                // foregrounded, and never leave that failure unmanaged.
                val foregrounded = try {
                    startForeground(NOTIFICATION_ID, buildNotification())
                    true
                } catch (e: Exception) {
                    Log.e(TAG, "startForeground() failed", e)
                    false
                }

                if (foregrounded) {
                    publishState()
                    establishTunnel()
                } else {
                    synchronized(lifecycle) {
                        lifecycle.onForegroundStartFailed("Foreground service start failed")
                        publishState()
                    }
                    stopSelf()
                }
            }
        }
    }

    private fun establishTunnel() {
        // M1-05 preflight: pick the underlying network's own DNS server BEFORE establishing (once the
        // VPN is up, this app's own default network is the VPN), and refuse outright when Private DNS
        // is active there — plaintext forwarding would silently downgrade it.
        val connectivityManager: ConnectivityManager? = getSystemService(ConnectivityManager::class.java)
        if (connectivityManager == null) {
            refuseStartup(UpstreamRefusalReason.NO_UNDERLYING_NETWORK)
            return
        }
        val inspector = UnderlyingNetworkInspector(connectivityManager)
        val underlyingNetwork: Network? = inspector.currentDefaultNetwork()
        val selection = UpstreamDnsSelector.select(inspector.factsFor(underlyingNetwork), EXCLUDED_UPSTREAM_ADDRESSES)
        if (underlyingNetwork == null || selection is UpstreamDnsSelection.Refused) {
            refuseStartup(
                (selection as? UpstreamDnsSelection.Refused)?.reason ?: UpstreamRefusalReason.NO_UNDERLYING_NETWORK,
            )
            return
        }

        val established = try {
            Builder()
                .setSession(SESSION_NAME)
                .addAddress(TUN_ADDRESS, HOST_PREFIX_LENGTH)
                // D11: the ONLY route is the virtual DNS server's /32. No default route — never
                // 0.0.0.0/0 or ::/0 — so ordinary traffic never enters this TUN.
                .addRoute(VIRTUAL_DNS_ADDRESS, HOST_PREFIX_LENGTH)
                .addDnsServer(VIRTUAL_DNS_ADDRESS)
                // A VPN with only IPv4 addresses/routes otherwise BLOCKS all IPv6 traffic of the
                // apps it covers (VpnService.Builder.allowFamily docs). Unblocking IPv6 adds no
                // route: IPv6 traffic falls through to the underlying network untouched.
                .allowFamily(OsConstants.AF_INET6)
                // Explicit (also the documented default): the DNS worker polls a non-blocking fd.
                .setBlocking(false)
                .establish()
        } catch (e: Exception) {
            // Builder/establish() can throw IllegalArgumentException (bad interface config),
            // IllegalStateException (not prepared), or SecurityException (permission revoked
            // concurrently) — all are the same outcome here: establishment failed, report it
            // truthfully rather than crashing the service.
            Log.e(TAG, "TUN establishment failed", e)
            null
        }

        synchronized(lifecycle) {
            if (established == null) {
                lifecycle.onEstablishFailed("TUN establishment failed")
                publishState()
                shutDownForeground()
                return
            }

            lifecycle.onTunnelEstablished()
            val accepted = lifecycle.signals(vpnPermissionGranted = true).serviceLifecycleState ==
                ServiceLifecycleState.RUNNING

            if (!accepted) {
                // A stop/revoke raced in while establish() was in flight (see class doc): the
                // controller already moved to STOPPED and rejected onTunnelEstablished(), so
                // this descriptor must never be assigned to `tunnel` — close it right here.
                publishState()
                try {
                    established.close()
                } catch (e: IOException) {
                    Log.w(TAG, "Error closing raced TUN descriptor", e)
                }
                shutDownForeground()
                return
            }

            tunnel = established
            val runtime = startDnsRuntime(established, underlyingNetwork, inspector)
            if (runtime == null) {
                // The tunnel now routes the system's DNS to a virtual server nobody answers: never
                // leave that black hole up. Tear down and report the failure truthfully.
                applyStopDecision(lifecycle.onRuntimeFailed("DNS proxy failed to start"))
                dnsProxyStatus = DnsProxyStatus.FAILED
                publishState()
                shutDownForeground()
                return
            }

            dnsRuntime = runtime
            dnsProxyStatus = DnsProxyStatus.RUNNING
            publishState()
        }
    }

    private fun startDnsRuntime(
        established: ParcelFileDescriptor,
        underlyingNetwork: Network,
        inspector: UnderlyingNetworkInspector,
    ): DnsProxyRuntime? {
        val upstream = ProtectedUpstreamDnsExchange(this, underlyingNetwork, inspector, EXCLUDED_UPSTREAM_ADDRESSES)
        val processor = DnsPacketProcessor(
            adapter = Ipv4UdpDnsPacketAdapter(VIRTUAL_DNS_IPV4),
            engine = DnsFilteringEngine(ExperimentalDnsTestRules.ruleSet()),
            upstream = upstream,
        )
        return try {
            DnsProxyRuntime.start(established, processor, upstream, runtimeListener)
        } catch (e: IOException) {
            Log.e(TAG, "DNS proxy runtime failed to start", e)
            null
        }
    }

    private fun refuseStartup(reason: UpstreamRefusalReason) {
        Log.w(TAG, "DNS experiment refused to start: $reason")
        synchronized(lifecycle) {
            if (lifecycle.onStartupRefused(refusalMessage(reason))) {
                dnsProxyStatus = DnsProxyStatus.fromRefusal(reason)
            }
            publishState()
        }
        shutDownForeground()
    }

    /** Called on the DNS worker thread when the runtime stops itself. */
    private fun handleRuntimeStopped(runtime: DnsProxyRuntime, reason: DnsRuntimeStopReason) {
        val decision = synchronized(lifecycle) {
            // A report from a runtime this service no longer owns (an earlier session, or one already
            // being stopped) must not affect the current state.
            if (runtime !== dnsRuntime) return
            val stopDecision = lifecycle.onRuntimeFailed(runtimeStopMessage(reason))
            applyStopDecision(stopDecision)
            if (stopDecision == VpnLifecycleController.StopDecision.CloseTunnel) {
                dnsProxyStatus = DnsProxyStatus.fromStopReason(reason)
            }
            publishState()
            stopDecision
        }
        if (decision == VpnLifecycleController.StopDecision.CloseTunnel) shutDownForeground()
    }

    private fun stopTunnel() {
        synchronized(lifecycle) {
            applyStopDecision(lifecycle.onStopRequested())
            publishState()
        }
        shutDownForeground()
    }

    override fun onRevoke() {
        synchronized(lifecycle) {
            applyStopDecision(lifecycle.onRevoked())
            publishState()
        }
        shutDownForeground()
        super.onRevoke()
    }

    override fun onDestroy() {
        // Safety net for unexpected teardown paths (the system killing the service without a
        // preceding explicit stop or revoke): must not leave VpnRuntimeStatus truthfully
        // reporting RUNNING/tunnelEstablished=true after the process is gone. Reuses the same
        // stop-shaped transition as an explicit stop, so this is idempotent with any stop/revoke
        // that already ran.
        synchronized(lifecycle) {
            applyStopDecision(lifecycle.onStopRequested())
            publishState()
        }
        super.onDestroy()
    }

    private fun applyStopDecision(decision: VpnLifecycleController.StopDecision) {
        when (decision) {
            VpnLifecycleController.StopDecision.CloseTunnel -> {
                closeTunnel()
                dnsProxyStatus = DnsProxyStatus.NOT_RUNNING
            }

            VpnLifecycleController.StopDecision.NoOp -> Unit
        }
    }

    private fun closeTunnel() {
        // Non-blocking: signals the worker, which closes its own duplicate descriptor on exit.
        dnsRuntime?.stop()
        dnsRuntime = null

        val descriptor = tunnel ?: return
        tunnel = null
        try {
            descriptor.close()
        } catch (e: IOException) {
            Log.w(TAG, "Error closing TUN descriptor", e)
        }
    }

    private fun shutDownForeground() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun publishState() {
        synchronized(lifecycle) {
            val signals = lifecycle.signals(vpnPermissionGranted = true)
            VpnRuntimeStatus.update(
                VpnRuntimeFacts(
                    serviceLifecycleState = signals.serviceLifecycleState,
                    tunnelEstablished = signals.tunnelEstablished,
                    fatalError = signals.fatalError,
                    dnsProxyStatus = dnsProxyStatus,
                ),
            )
        }
    }

    private fun buildNotification(): Notification {
        ensureNotificationChannel()

        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(NOTIFICATION_TITLE)
            .setContentText(NOTIFICATION_TEXT)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW,
        )
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "LocalProtectionVpn"

        const val ACTION_START = "com.muslimrecovery.protection.vpn.action.START"
        const val ACTION_STOP = "com.muslimrecovery.protection.vpn.action.STOP"

        private const val SESSION_NAME = "Muslim Recovery Protection (M1-05 DNS experiment)"

        /**
         * D11 DNS-only address pair: a private /32 for the TUN interface and a distinct private /32
         * for the virtual DNS server. Deliberately not 10.0.0.x, which common home routers use for
         * their own gateway/DNS address.
         */
        private const val TUN_ADDRESS = "10.111.222.2"
        private const val VIRTUAL_DNS_ADDRESS = "10.111.222.1"
        private const val HOST_PREFIX_LENGTH = 32

        private val VIRTUAL_DNS_IPV4 = checkNotNull(Ipv4Address.parse(VIRTUAL_DNS_ADDRESS))
        private val TUN_IPV4 = checkNotNull(Ipv4Address.parse(TUN_ADDRESS))

        /** Upstream selection loop guard: the proxy must never forward to its own addresses. */
        private val EXCLUDED_UPSTREAM_ADDRESSES: Set<InetAddress> = setOf(
            InetAddress.getByAddress(VIRTUAL_DNS_IPV4.toByteArray()),
            InetAddress.getByAddress(TUN_IPV4.toByteArray()),
        )

        private const val NOTIFICATION_ID = 1
        private const val NOTIFICATION_CHANNEL_ID = "vpn_lifecycle_channel"
        private const val NOTIFICATION_CHANNEL_NAME = "Protection VPN service"

        // Deliberately does not say "Protected": M1-05 is a standard-DNS experiment only.
        private const val NOTIFICATION_TITLE = "VPN DNS experiment active"
        private const val NOTIFICATION_TEXT = "Standard DNS test only — not full protection"

        /** Diagnostic reasons (never user-facing copy; never contain hostnames). */
        private fun refusalMessage(reason: UpstreamRefusalReason): String = when (reason) {
            UpstreamRefusalReason.PRIVATE_DNS_ACTIVE ->
                "DNS experiment refused: Private DNS is active (plaintext forwarding not allowed)"
            UpstreamRefusalReason.NO_UNDERLYING_NETWORK -> "DNS experiment refused: no underlying network"
            UpstreamRefusalReason.UNDERLYING_NETWORK_IS_VPN -> "DNS experiment refused: underlying network is a VPN"
            UpstreamRefusalReason.NO_USABLE_DNS_SERVER -> "DNS experiment refused: no usable underlying DNS server"
        }

        private fun runtimeStopMessage(reason: DnsRuntimeStopReason): String = when (reason) {
            DnsRuntimeStopReason.PRIVATE_DNS_ACTIVE ->
                "DNS experiment stopped: Private DNS became active (plaintext forwarding not allowed)"
            DnsRuntimeStopReason.UPSTREAM_UNAVAILABLE -> "DNS experiment stopped: underlying network DNS unavailable"
            DnsRuntimeStopReason.TUNNEL_IO_FAILED -> "DNS experiment stopped: TUN I/O failed"
        }
    }
}

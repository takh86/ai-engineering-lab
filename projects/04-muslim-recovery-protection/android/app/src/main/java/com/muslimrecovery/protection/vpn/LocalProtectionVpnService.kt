package com.muslimrecovery.protection.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.muslimrecovery.protection.MainActivity
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState
import java.io.IOException

/**
 * M1-04: VPN lifecycle foundation only. This service proves that a local TUN interface can be
 * established and torn down safely under Android's real VpnService/foreground-service
 * contracts. It does NOT read, write, parse, or forward any packets, and configures no route
 * (no `addRoute`, no default `0.0.0.0/0`) and no DNS server — so establishing this tunnel has
 * no effect on the device's normal network traffic. Filtering does not exist yet: see
 * [VpnLifecycleController] for why a running tunnel can never evaluate to `Protected`.
 *
 * All lifecycle decisions (idempotent start/stop, failure handling, revoke) are delegated to
 * [VpnLifecycleController], a pure class with no Android dependency, so that decision logic is
 * unit tested off-device. This class only does the Android-framework side effects the
 * controller's decisions call for: building the TUN, running as a foreground service, and
 * publishing the resulting facts to [VpnRuntimeStatus] for the UI to read.
 *
 * [tunnel] is a resource jointly owned with [lifecycle]'s state: every read or write of it is
 * done inside `synchronized(lifecycle)`, the same monitor [lifecycle]'s own `@Synchronized`
 * methods use. This closes a real race Android's contract allows: [onRevoke] "might not happen
 * on the main thread" per the platform docs, so a revoke can arrive while [establishTunnel] is
 * still in flight on another thread. Without this lock, a tunnel could finish establishing
 * after a concurrent revoke already moved the controller back to STOPPED, get assigned to
 * [tunnel] anyway, and never be closed by anything — a leaked native file descriptor.
 */
class LocalProtectionVpnService : VpnService() {

    private val lifecycle = VpnLifecycleController()
    private var tunnel: ParcelFileDescriptor? = null

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
                // Must call startForeground() promptly after the service is started, before any
                // further work, per Android's foreground-service contract.
                startForeground(NOTIFICATION_ID, buildNotification())
                publishState()
                establishTunnel()
            }
        }
    }

    private fun establishTunnel() {
        val established = try {
            Builder()
                .setSession(SESSION_NAME)
                .addAddress(LOCAL_TUNNEL_ADDRESS, LOCAL_TUNNEL_PREFIX_LENGTH)
                // Deliberately no addRoute()/addDnsServer(): M1-04 proves lifecycle only. With
                // no route configured, this tunnel carries none of the device's real traffic.
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

            if (accepted) {
                tunnel = established
                publishState()
            } else {
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
            }
        }
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
        // Safety net: guarantees the descriptor is released even on unexpected teardown paths.
        synchronized(lifecycle) {
            closeTunnel()
        }
        super.onDestroy()
    }

    private fun applyStopDecision(decision: VpnLifecycleController.StopDecision) {
        when (decision) {
            VpnLifecycleController.StopDecision.CloseTunnel -> closeTunnel()
            VpnLifecycleController.StopDecision.NoOp -> Unit
        }
    }

    private fun closeTunnel() {
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
        val signals = lifecycle.signals(vpnPermissionGranted = true)
        VpnRuntimeStatus.update(
            VpnRuntimeFacts(
                serviceLifecycleState = signals.serviceLifecycleState,
                tunnelEstablished = signals.tunnelEstablished,
                fatalError = signals.fatalError,
            ),
        )
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

        private const val SESSION_NAME = "Muslim Recovery Protection (lifecycle only)"
        private const val LOCAL_TUNNEL_ADDRESS = "10.0.0.2"
        private const val LOCAL_TUNNEL_PREFIX_LENGTH = 32

        private const val NOTIFICATION_ID = 1
        private const val NOTIFICATION_CHANNEL_ID = "vpn_lifecycle_channel"
        private const val NOTIFICATION_CHANNEL_NAME = "Protection VPN service"

        // Deliberately does not say "Protected": M1-04 implements no filtering.
        private const val NOTIFICATION_TITLE = "VPN protection service active"
        private const val NOTIFICATION_TEXT = "Filtering not active yet"
    }
}

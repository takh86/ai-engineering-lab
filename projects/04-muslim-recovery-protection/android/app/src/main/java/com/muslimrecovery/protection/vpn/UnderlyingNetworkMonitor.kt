package com.muslimrecovery.protection.vpn

import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.muslimrecovery.protection.dns.UnderlyingNetworkDnsFacts
import com.muslimrecovery.protection.dns.UpstreamRefusalReason
import java.net.InetAddress
import java.util.concurrent.atomic.AtomicBoolean

/**
 * M1-07 (M-1): one DNS-experiment session's watch over the underlying network captured at startup.
 * It only REPORTS "the captured network is no longer a trustworthy upstream path" to [Listener]. It
 * never stops anything itself: [LocalProtectionVpnService] and its lifecycle controller own the
 * shutdown. It never switches the session to another network (automatic handover is out of scope).
 *
 * It registers one NetworkCallback for physical Internet networks (`INTERNET` + `NOT_VPN`):
 * - API 31+: `registerBestMatchingNetworkCallback`. Another network becoming the best match means
 *   the captured one is no longer the preferred physical path. In AOSP the current best network is
 *   also delivered at registration (observed behaviour, not stated in the docs), so a different
 *   best network then stops the session right away. The best match for this request and
 *   `getActiveNetwork()` are not documented to be identical, so a per-app network preference could
 *   cause such a stop immediately after Start. That is fail-closed; device testing must check it.
 * - API 24–30: `registerNetworkCallback`, which reports every matching network. Only the captured
 *   network's events matter there. A change of preferred network is caught through `onLosing`
 *   ("Read network state" guide: when Wi-Fi becomes default, "the mobile network goes to the
 *   background, and the regular network callback receives a call to onLosing()"). It is also caught
 *   through `onLost`, or through the loss of FOREGROUND (API 28+), VALIDATED or INTERNET.
 * - Limit (all API levels): if the captured network is already gone at registration and nothing
 *   else matches, no callback arrives. The DNS worker's 2 s re-check then stops the session.
 *
 * Policy decisions come only from the callback payloads, never from synchronous ConnectivityManager
 * getters, which the NetworkCallback docs say must not be called from callbacks. The pure
 * [CapturedNetworkWatch] makes them. Deliberately NOT `registerDefaultNetworkCallback` or
 * `getActiveNetwork` after the VPN is up. Both track this app's default network. The
 * `registerDefaultNetworkCallback` docs say that "may be a physical network or a virtual network,
 * such as a VPN that applies to the application", i.e. possibly this app's own VPN.
 *
 * Race safety: a stale callback (after [stop], or from an earlier session) is dropped by the closed
 * watch. The service also ignores reports from any monitor that is not its current one.
 */
internal class UnderlyingNetworkMonitor(
    private val connectivityManager: ConnectivityManager,
    captured: Network,
    initialFacts: UnderlyingNetworkDnsFacts,
    excludedAddresses: Set<InetAddress>,
    private val listener: Listener,
) {

    fun interface Listener {
        /** Called at most once per monitor, on the callback's thread. */
        fun onUnderlyingNetworkInvalidated(monitor: UnderlyingNetworkMonitor, reason: UpstreamRefusalReason)
    }

    private val tracksBestNetwork = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    private val watch = CapturedNetworkWatch(captured, initialFacts, excludedAddresses, tracksBestNetwork)
    private val registered = AtomicBoolean(false)

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = report(watch.onAvailable(network))

        override fun onLosing(network: Network, maxMsToLive: Int) = report(watch.onLosing(network))

        override fun onLost(network: Network) = report(watch.onLost(network))

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) =
            report(watch.onCapabilitiesChanged(network, UnderlyingNetworkInspector.capabilityFacts(networkCapabilities)))

        override fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) =
            report(watch.onLinkPropertiesChanged(network, UnderlyingNetworkInspector.linkFacts(linkProperties)))

        // API 29+; never invoked on older platforms.
        override fun onBlockedStatusChanged(network: Network, blocked: Boolean) =
            report(watch.onBlockedStatusChanged(network, blocked))
    }

    /**
     * Registers the callback. Throws [RuntimeException] if it cannot be registered (e.g. the
     * per-app callback limit); the caller must then fail the session closed.
     */
    fun start() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            connectivityManager.registerBestMatchingNetworkCallback(request, callback, Handler(Looper.getMainLooper()))
        } else {
            connectivityManager.registerNetworkCallback(request, callback)
        }
        registered.set(true)
    }

    /**
     * Idempotent. [start] and [stop] are both called under the service's lifecycle lock, so they
     * never interleave. Once it returns, the watch accepts no further reports. The service drops a
     * report already in flight on the callback thread, because this monitor is no longer its
     * current one.
     */
    fun stop() {
        watch.close()
        if (registered.compareAndSet(true, false)) {
            try {
                connectivityManager.unregisterNetworkCallback(callback)
            } catch (e: RuntimeException) {
                // Already unregistered by the framework (e.g. process teardown): nothing to release.
            }
        }
    }

    private fun report(reason: UpstreamRefusalReason?) {
        if (reason != null) listener.onUnderlyingNetworkInvalidated(this, reason)
    }
}

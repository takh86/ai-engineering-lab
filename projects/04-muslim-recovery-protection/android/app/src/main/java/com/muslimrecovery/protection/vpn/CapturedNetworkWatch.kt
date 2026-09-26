package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.dns.UnderlyingNetworkCapabilityFacts
import com.muslimrecovery.protection.dns.UnderlyingNetworkDnsFacts
import com.muslimrecovery.protection.dns.UnderlyingNetworkLinkFacts
import com.muslimrecovery.protection.dns.UpstreamDnsSelection
import com.muslimrecovery.protection.dns.UpstreamDnsSelector
import com.muslimrecovery.protection.dns.UpstreamRefusalReason
import java.net.InetAddress

/**
 * M1-07 (M-1): pure, session-scoped policy that turns ConnectivityManager's asynchronous reports
 * into "the underlying network captured when this session started is no longer a trustworthy
 * upstream path". It has no Android dependency, so it is unit tested off-device.
 * [UnderlyingNetworkMonitor] feeds it the callback payloads. [N] is the network identity
 * (`android.net.Network` in production).
 *
 * The policy stops the session truthfully rather than handing over. It never picks another network:
 * - events about other networks are ignored, except that with [tracksBestNetwork] (API 31+
 *   best-matching callback) another network becoming the best match invalidates the captured one;
 * - the captured network "about to be lost" (`onLosing`, e.g. mobile data moved to the background
 *   after Wi-Fi became default) invalidates it, in both modes;
 * - [UpstreamDnsSelector] decides validity from the latest capabilities, link properties and
 *   blocked status of the captured network. That is the same policy startup used, so within one
 *   snapshot Private DNS is reported ahead of the validation, usability and DNS-server checks.
 *   Across separate events, the first failing report decides the stop reason; the session stops
 *   either way, and nothing is ever downgraded;
 * - at most ONE invalidation is ever returned, and nothing after [close]. Duplicate or racing
 *   reports (lost + capability loss + Private DNS) produce a single stop request, and a callback
 *   that arrives after its session was stopped is ignored.
 *
 * Thread-safe. It returns the reason instead of calling out, so callers never invoke the lifecycle
 * while holding this object's lock.
 */
internal class CapturedNetworkWatch<N : Any>(
    private val captured: N,
    initialFacts: UnderlyingNetworkDnsFacts,
    private val excludedAddresses: Set<InetAddress>,
    private val tracksBestNetwork: Boolean,
) {
    private var facts = initialFacts
    private var closed = false
    private var invalidated = false

    /** With [tracksBestNetwork], [network] is the new best match for the physical-network request. */
    @Synchronized
    fun onAvailable(network: N): UpstreamRefusalReason? =
        if (tracksBestNetwork && network != captured) {
            invalidate(UpstreamRefusalReason.UNDERLYING_NETWORK_SUPERSEDED)
        } else {
            null
        }

    /**
     * `onLosing`: the network "is about to be lost, typically because there are no outstanding
     * requests left for it", e.g. it is being replaced as the default network. The session does not
     * wait for it to linger out or move to the background, where this app cannot use it.
     */
    @Synchronized
    fun onLosing(network: N): UpstreamRefusalReason? =
        if (network == captured) invalidate(UpstreamRefusalReason.UNDERLYING_NETWORK_SUPERSEDED) else null

    /** The network disconnected or no longer satisfies the request (e.g. lost INTERNET). */
    @Synchronized
    fun onLost(network: N): UpstreamRefusalReason? =
        if (network == captured) invalidate(UpstreamRefusalReason.NO_UNDERLYING_NETWORK) else null

    @Synchronized
    fun onCapabilitiesChanged(network: N, capabilities: UnderlyingNetworkCapabilityFacts): UpstreamRefusalReason? =
        update(network) { it.copy(capabilities = capabilities) }

    @Synchronized
    fun onLinkPropertiesChanged(network: N, link: UnderlyingNetworkLinkFacts): UpstreamRefusalReason? =
        update(network) { it.copy(link = link) }

    @Synchronized
    fun onBlockedStatusChanged(network: N, blocked: Boolean): UpstreamRefusalReason? =
        update(network) { it.copy(isBlockedForApp = blocked) }

    /** The session is over: every later report is ignored. Idempotent. */
    @Synchronized
    fun close() {
        closed = true
    }

    private fun update(
        network: N,
        change: (UnderlyingNetworkDnsFacts) -> UnderlyingNetworkDnsFacts,
    ): UpstreamRefusalReason? {
        if (network != captured || closed || invalidated) return null
        facts = change(facts)
        return when (val selection = UpstreamDnsSelector.select(facts, excludedAddresses)) {
            is UpstreamDnsSelection.Selected -> null
            is UpstreamDnsSelection.Refused -> invalidate(selection.reason)
        }
    }

    private fun invalidate(reason: UpstreamRefusalReason): UpstreamRefusalReason? {
        if (closed || invalidated) return null
        invalidated = true
        return reason
    }
}

package com.muslimrecovery.protection.dns

import java.net.Inet4Address
import java.net.InetAddress

/**
 * What Android's `NetworkCapabilities` says about the underlying (non-VPN) network. Plain data so
 * the policy is JVM-testable.
 */
data class UnderlyingNetworkCapabilityFacts(
    val isVpn: Boolean,
    val hasInternet: Boolean,
    /** `NET_CAPABILITY_VALIDATED`: the system probed the network and found working Internet access. */
    val isValidated: Boolean,
    /**
     * `NET_CAPABILITY_FOREGROUND` (API 28+): the network "is available for use by apps, and not a
     * network that is being kept up in the background". Not observable below API 28 (reported true).
     */
    val isForeground: Boolean,
    /**
     * No `NET_CAPABILITY_NOT_SUSPENDED` (API 28+): the network is temporarily unable to transfer
     * data. Not observable below API 28 (reported false).
     */
    val isSuspended: Boolean,
)

/** What Android's `LinkProperties` says about the underlying network. */
data class UnderlyingNetworkLinkFacts(
    /** `LinkProperties.isPrivateDnsActive()` (API 28+); always false below API 28, where it does not exist. */
    val privateDnsActive: Boolean,
    val dnsServers: List<InetAddress>,
)

/**
 * Facts about the underlying (non-VPN) network the DNS experiment would forward through, as read
 * from Android's ConnectivityManager.
 */
data class UnderlyingNetworkDnsFacts(
    val capabilities: UnderlyingNetworkCapabilityFacts,
    val link: UnderlyingNetworkLinkFacts,
    /**
     * `NetworkCallback.onBlockedStatusChanged` (API 29+): access to the network is blocked for this
     * app. Only a network callback reports it (there is no synchronous getter), so synchronous
     * re-checks pass false.
     */
    val isBlockedForApp: Boolean,
)

enum class UpstreamRefusalReason {
    NO_UNDERLYING_NETWORK,
    UNDERLYING_NETWORK_IS_VPN,
    PRIVATE_DNS_ACTIVE,

    /** The network does not have (or lost) `NET_CAPABILITY_VALIDATED`. */
    UNDERLYING_NETWORK_NOT_VALIDATED,

    /** The network is kept in the background, is suspended, or is blocked for this app. */
    UNDERLYING_NETWORK_NOT_USABLE,

    /**
     * Another physical network became the best match while the session was running. Only the
     * session's network monitor reports this (API 31+); [UpstreamDnsSelector] never returns it.
     */
    UNDERLYING_NETWORK_SUPERSEDED,
    NO_USABLE_DNS_SERVER,
}

sealed interface UpstreamDnsSelection {
    data class Selected(val server: InetAddress) : UpstreamDnsSelection
    data class Refused(val reason: UpstreamRefusalReason) : UpstreamDnsSelection
}

/**
 * Chooses the plaintext upstream DNS server for allowed queries — or refuses to choose one.
 *
 * Private DNS is checked BEFORE any server is considered: when Private DNS is active on the
 * underlying network, Android's own documentation says applications must not send unencrypted DNS
 * queries, so the experiment refuses rather than silently downgrading it to plaintext. The
 * underlying network's own DNS servers are used (no hardcoded public resolver); IPv4 servers are
 * preferred. The virtual DNS / TUN addresses are excluded so the proxy can never forward to itself.
 *
 * M1-07 (M-1): the same policy decides whether the network captured at startup is still a
 * trustworthy upstream path while the session runs. It must also be validated and usable by this
 * app (foreground, not suspended, not blocked). Otherwise allowed queries would keep failing while
 * the experiment still looked RUNNING.
 */
object UpstreamDnsSelector {

    fun select(facts: UnderlyingNetworkDnsFacts?, excludedAddresses: Set<InetAddress>): UpstreamDnsSelection {
        if (facts == null || !facts.capabilities.hasInternet) return refuse(UpstreamRefusalReason.NO_UNDERLYING_NETWORK)
        val capabilities = facts.capabilities
        if (capabilities.isVpn) return refuse(UpstreamRefusalReason.UNDERLYING_NETWORK_IS_VPN)
        if (facts.link.privateDnsActive) return refuse(UpstreamRefusalReason.PRIVATE_DNS_ACTIVE)
        if (!capabilities.isValidated) return refuse(UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_VALIDATED)
        if (!capabilities.isForeground || capabilities.isSuspended || facts.isBlockedForApp) {
            return refuse(UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_USABLE)
        }

        val usable = facts.link.dnsServers.filter { server ->
            server !in excludedAddresses &&
                !server.isLoopbackAddress &&
                !server.isAnyLocalAddress &&
                !server.isMulticastAddress
        }
        val chosen = usable.firstOrNull { it is Inet4Address } ?: usable.firstOrNull()
            ?: return refuse(UpstreamRefusalReason.NO_USABLE_DNS_SERVER)
        return UpstreamDnsSelection.Selected(chosen)
    }

    private fun refuse(reason: UpstreamRefusalReason) = UpstreamDnsSelection.Refused(reason)
}

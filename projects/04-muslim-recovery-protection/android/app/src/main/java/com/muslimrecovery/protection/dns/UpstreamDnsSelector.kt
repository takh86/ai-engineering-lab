package com.muslimrecovery.protection.dns

import java.net.Inet4Address
import java.net.InetAddress

/**
 * Facts about the underlying (non-VPN) network the DNS experiment would forward through, as read
 * from Android's ConnectivityManager. Plain data so the selection policy is JVM-testable.
 */
data class UnderlyingNetworkDnsFacts(
    val isVpn: Boolean,
    val hasInternet: Boolean,
    /** `LinkProperties.isPrivateDnsActive()` (API 28+); always false below API 28, where it does not exist. */
    val privateDnsActive: Boolean,
    val dnsServers: List<InetAddress>,
)

enum class UpstreamRefusalReason {
    NO_UNDERLYING_NETWORK,
    UNDERLYING_NETWORK_IS_VPN,
    PRIVATE_DNS_ACTIVE,
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
 */
object UpstreamDnsSelector {

    fun select(facts: UnderlyingNetworkDnsFacts?, excludedAddresses: Set<InetAddress>): UpstreamDnsSelection {
        if (facts == null || !facts.hasInternet) return refuse(UpstreamRefusalReason.NO_UNDERLYING_NETWORK)
        if (facts.isVpn) return refuse(UpstreamRefusalReason.UNDERLYING_NETWORK_IS_VPN)
        if (facts.privateDnsActive) return refuse(UpstreamRefusalReason.PRIVATE_DNS_ACTIVE)

        val usable = facts.dnsServers.filter { server ->
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

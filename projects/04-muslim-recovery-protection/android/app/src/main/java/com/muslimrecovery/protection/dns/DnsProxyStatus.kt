package com.muslimrecovery.protection.dns

/**
 * INTERNAL, EXPERIMENTAL M1-05 fact about the standard-DNS proxy, for the development harness only.
 *
 * This is deliberately NOT `ProtectionSignals.filteringOperational` and must never be mapped onto
 * it: even [RUNNING] only means "standard plaintext system DNS is being filtered for the controlled
 * test rules". Private DNS, DoH, browser Secure DNS, TCP DNS, IPv6 DNS transport and reboot/Always-on
 * are all untested, so `ProtectionState.Protected` stays unreachable (D8, D11).
 */
enum class DnsProxyStatus {
    NOT_RUNNING,
    RUNNING,
    REFUSED_PRIVATE_DNS_ACTIVE,
    UNAVAILABLE_NO_UPSTREAM,
    FAILED,
    ;

    /** True only while standard DNS queries are actually being intercepted and answered. */
    val isOperational: Boolean get() = this == RUNNING

    companion object {
        fun fromRefusal(reason: UpstreamRefusalReason): DnsProxyStatus = when (reason) {
            UpstreamRefusalReason.PRIVATE_DNS_ACTIVE -> REFUSED_PRIVATE_DNS_ACTIVE
            UpstreamRefusalReason.NO_UNDERLYING_NETWORK,
            UpstreamRefusalReason.UNDERLYING_NETWORK_IS_VPN,
            UpstreamRefusalReason.NO_USABLE_DNS_SERVER,
            -> UNAVAILABLE_NO_UPSTREAM
        }

        fun fromStopReason(reason: DnsRuntimeStopReason): DnsProxyStatus = when (reason) {
            DnsRuntimeStopReason.PRIVATE_DNS_ACTIVE -> REFUSED_PRIVATE_DNS_ACTIVE
            DnsRuntimeStopReason.UPSTREAM_UNAVAILABLE -> UNAVAILABLE_NO_UPSTREAM
            DnsRuntimeStopReason.TUNNEL_IO_FAILED -> FAILED
        }
    }
}

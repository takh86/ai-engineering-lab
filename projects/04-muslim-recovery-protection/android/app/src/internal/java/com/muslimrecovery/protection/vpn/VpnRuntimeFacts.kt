package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.dns.DnsProxyStatus
import com.muslimrecovery.protection.domain.protection.FatalError
import com.muslimrecovery.protection.domain.protection.ProtectionSignals
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState

/**
 * The runtime facts [LocalProtectionVpnService] actually owns (lifecycle, tunnel, fatal error, and —
 * from M1-05 — the INTERNAL experimental [dnsProxyStatus]). Deliberately excludes VPN permission —
 * that is a UI-observable Android fact ([android.net.VpnService.prepare] returning null), not
 * something the service tracks.
 */
data class VpnRuntimeFacts(
    val serviceLifecycleState: ServiceLifecycleState = ServiceLifecycleState.STOPPED,
    val tunnelEstablished: Boolean = false,
    val fatalError: FatalError? = null,
    val dnsProxyStatus: DnsProxyStatus = DnsProxyStatus.NOT_RUNNING,
) {

    /**
     * The public [ProtectionSignals] for these facts. [dnsProxyStatus] is intentionally NOT an input:
     * `filteringOperational` is hardcoded false because M1-05's standard-DNS experiment — even when
     * [DnsProxyStatus.RUNNING] — is not verified protection (Private DNS, DoH, browser Secure DNS,
     * TCP DNS, IPv6, reboot/Always-on are untested; D11). `ProtectionState.Protected` must stay
     * unreachable.
     */
    fun toProtectionSignals(vpnPermissionGranted: Boolean): ProtectionSignals = ProtectionSignals(
        vpnPermissionGranted = vpnPermissionGranted,
        serviceLifecycleState = serviceLifecycleState,
        tunnelEstablished = tunnelEstablished,
        filteringOperational = false,
        fatalError = fatalError,
    )
}

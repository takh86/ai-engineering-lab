package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.dns.DnsProxyStatus
import com.muslimrecovery.protection.domain.protection.DegradedReason
import com.muslimrecovery.protection.domain.protection.ProtectionState
import com.muslimrecovery.protection.domain.protection.ProtectionStateEvaluator
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * The M1-05 protection invariant: the standard-DNS experiment — even fully running — must never make
 * `filteringOperational` true or `ProtectionState.Protected` reachable (D8, D11).
 */
class VpnRuntimeFactsTest {

    @Test
    fun `running DNS experiment on an established tunnel is Degraded, never Protected`() {
        val facts = VpnRuntimeFacts(
            serviceLifecycleState = ServiceLifecycleState.RUNNING,
            tunnelEstablished = true,
            fatalError = null,
            dnsProxyStatus = DnsProxyStatus.RUNNING,
        )

        val signals = facts.toProtectionSignals(vpnPermissionGranted = true)

        assertFalse(signals.filteringOperational)
        assertEquals(
            ProtectionState.Degraded(setOf(DegradedReason.FILTERING_NOT_OPERATIONAL)),
            ProtectionStateEvaluator.evaluate(signals),
        )
    }

    @Test
    fun `no combination of runtime facts and DNS proxy status reaches Protected`() {
        for (lifecycle in ServiceLifecycleState.values()) {
            for (tunnel in listOf(true, false)) {
                for (dnsStatus in DnsProxyStatus.values()) {
                    for (permission in listOf(true, false)) {
                        val signals = VpnRuntimeFacts(lifecycle, tunnel, null, dnsStatus).toProtectionSignals(permission)

                        assertFalse(signals.filteringOperational)
                        assertNotEquals(ProtectionState.Protected, ProtectionStateEvaluator.evaluate(signals))
                    }
                }
            }
        }
    }

    @Test
    fun `only the RUNNING experimental status counts as intercepting, and only internally`() {
        assertEquals(listOf(DnsProxyStatus.RUNNING), DnsProxyStatus.values().filter { it.isInterceptingStandardDns })
    }

    @Test
    fun `Private DNS refusal leaves the experiment non-operational and the state not Protected`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onStartupRefused("DNS experiment refused: Private DNS is active")
        val facts = VpnRuntimeFacts(
            serviceLifecycleState = controller.signals(true).serviceLifecycleState,
            tunnelEstablished = controller.signals(true).tunnelEstablished,
            fatalError = controller.signals(true).fatalError,
            dnsProxyStatus = DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE,
        )

        val state = ProtectionStateEvaluator.evaluate(facts.toProtectionSignals(vpnPermissionGranted = true))

        assertFalse(facts.dnsProxyStatus.isInterceptingStandardDns)
        assertEquals(ProtectionState.Error("DNS experiment refused: Private DNS is active"), state)
    }
}

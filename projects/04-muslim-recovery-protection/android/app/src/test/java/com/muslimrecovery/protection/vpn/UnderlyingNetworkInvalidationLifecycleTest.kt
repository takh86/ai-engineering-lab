package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.dns.DnsProxyStatus
import com.muslimrecovery.protection.dns.UpstreamRefusalReason
import com.muslimrecovery.protection.domain.protection.ProtectionState
import com.muslimrecovery.protection.domain.protection.ProtectionStateEvaluator
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * M1-07 (M-1): an underlying-network invalidation is handed to the EXISTING lifecycle authority
 * ([VpnLifecycleController.onRuntimeFailed]), exactly like a DNS-worker self-stop. These tests pin
 * down the externally visible result: truthful stopped/error state, the proxy no longer RUNNING,
 * `filteringOperational` false, `ProtectionState.Protected` unreachable, and a single effective
 * stop whatever it races with.
 */
class UnderlyingNetworkInvalidationLifecycleTest {

    private fun runningController() = VpnLifecycleController().apply {
        onStartRequested()
        onTunnelEstablished()
    }

    /** What the service publishes after handling the stop decision for [reason]. */
    private fun publishedFacts(controller: VpnLifecycleController, dnsProxyStatus: DnsProxyStatus): VpnRuntimeFacts {
        val signals = controller.signals(vpnPermissionGranted = true)
        return VpnRuntimeFacts(signals.serviceLifecycleState, signals.tunnelEstablished, signals.fatalError, dnsProxyStatus)
    }

    @Test
    fun `every network invalidation stops the running session truthfully and never reports Protected`() {
        for (reason in UpstreamRefusalReason.values()) {
            val controller = runningController()

            val decision = controller.onRuntimeFailed("DNS experiment stopped: $reason")
            val facts = publishedFacts(controller, DnsProxyStatus.fromRefusal(reason))
            val signals = facts.toProtectionSignals(vpnPermissionGranted = true)
            val state = ProtectionStateEvaluator.evaluate(signals)

            assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, decision)
            assertEquals(ServiceLifecycleState.STOPPED, facts.serviceLifecycleState)
            assertFalse(facts.tunnelEstablished)
            assertFalse("proxy must not stay RUNNING for $reason", facts.dnsProxyStatus.isInterceptingStandardDns)
            assertFalse(signals.filteringOperational)
            assertEquals(ProtectionState.Error("DNS experiment stopped: $reason"), state)
            assertNotEquals(ProtectionState.Protected, state)
        }
    }

    @Test
    fun `after an invalidation stop the user can start a fresh session manually`() {
        val controller = runningController()
        controller.onRuntimeFailed("DNS experiment stopped: underlying network lost (no automatic handover)")

        val decision = controller.onStartRequested()
        controller.onTunnelEstablished()

        assertEquals(VpnLifecycleController.StartDecision.ProceedToEstablish, decision)
        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.RUNNING, signals.serviceLifecycleState)
        assertNull(signals.fatalError)
        assertFalse(signals.filteringOperational)
        assertNotEquals(ProtectionState.Protected, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `an explicit stop that wins the race turns a late invalidation into a no-op, not an error`() {
        val controller = runningController()
        controller.onStopRequested()

        val late = controller.onRuntimeFailed("DNS experiment stopped: another network became preferred")

        assertEquals(VpnLifecycleController.StopDecision.NoOp, late)
        assertEquals(ProtectionState.Stopped, ProtectionStateEvaluator.evaluate(controller.signals(true)))
    }

    @Test
    fun `revoke racing an invalidation closes the tunnel exactly once in either order`() {
        val revokeFirst = runningController()
        val revokeDecisions = listOf(
            revokeFirst.onRevoked(),
            revokeFirst.onRuntimeFailed("DNS experiment stopped: underlying network lost"),
        )
        assertEquals(1, revokeDecisions.count { it == VpnLifecycleController.StopDecision.CloseTunnel })
        assertNull(revokeFirst.signals(true).fatalError)

        val invalidationFirst = runningController()
        val invalidationDecisions = listOf(
            invalidationFirst.onRuntimeFailed("DNS experiment stopped: underlying network lost"),
            invalidationFirst.onRevoked(),
        )
        assertEquals(1, invalidationDecisions.count { it == VpnLifecycleController.StopDecision.CloseTunnel })
        // The revoke does not erase the truthful reason the session had already stopped for.
        assertEquals(
            "DNS experiment stopped: underlying network lost",
            invalidationFirst.signals(true).fatalError?.reason,
        )
        assertEquals(ServiceLifecycleState.STOPPED, invalidationFirst.signals(true).serviceLifecycleState)
    }

    @Test
    fun `the DNS worker self-stop and a network invalidation racing close the tunnel exactly once`() {
        val controller = runningController()

        val first = controller.onRuntimeFailed("DNS experiment stopped: underlying network DNS unavailable")
        val second = controller.onRuntimeFailed("DNS experiment stopped: underlying network lost validated Internet access")

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, first)
        assertEquals(VpnLifecycleController.StopDecision.NoOp, second)
        assertEquals(
            "DNS experiment stopped: underlying network DNS unavailable",
            controller.signals(true).fatalError?.reason,
        )
        assertTrue(ProtectionStateEvaluator.evaluate(controller.signals(true)) is ProtectionState.Error)
    }
}

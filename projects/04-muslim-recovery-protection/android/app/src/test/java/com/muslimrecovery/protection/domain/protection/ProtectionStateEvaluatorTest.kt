package com.muslimrecovery.protection.domain.protection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProtectionStateEvaluatorTest {

    private fun healthySignals(
        vpnPermissionGranted: Boolean = true,
        serviceLifecycleState: ServiceLifecycleState = ServiceLifecycleState.RUNNING,
        tunnelEstablished: Boolean = true,
        filteringOperational: Boolean = true,
        userIntentEnabled: Boolean = true,
        fatalError: FatalError? = null,
    ) = ProtectionSignals(
        vpnPermissionGranted = vpnPermissionGranted,
        serviceLifecycleState = serviceLifecycleState,
        tunnelEstablished = tunnelEstablished,
        filteringOperational = filteringOperational,
        userIntentEnabled = userIntentEnabled,
        fatalError = fatalError,
    )

    @Test
    fun `missing permission returns PermissionRequired`() {
        val signals = healthySignals(vpnPermissionGranted = false)

        assertEquals(ProtectionState.PermissionRequired, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `permission granted but service stopped returns Stopped`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.STOPPED,
            userIntentEnabled = true,
        )

        assertEquals(ProtectionState.Stopped, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `service starting returns Starting`() {
        val signals = healthySignals(serviceLifecycleState = ServiceLifecycleState.STARTING)

        assertEquals(ProtectionState.Starting, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `service running with tunnel established and filtering operational returns Protected`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.RUNNING,
            tunnelEstablished = true,
            filteringOperational = true,
        )

        assertEquals(ProtectionState.Protected, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `service running but tunnel unavailable returns Degraded`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.RUNNING,
            tunnelEstablished = false,
            filteringOperational = true,
        )

        val result = ProtectionStateEvaluator.evaluate(signals)

        assertTrue(result is ProtectionState.Degraded)
        assertEquals(
            setOf(DegradedReason.TUNNEL_NOT_ESTABLISHED),
            (result as ProtectionState.Degraded).reasons,
        )
    }

    @Test
    fun `tunnel established but filtering unhealthy returns Degraded`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.RUNNING,
            tunnelEstablished = true,
            filteringOperational = false,
        )

        val result = ProtectionStateEvaluator.evaluate(signals)

        assertTrue(result is ProtectionState.Degraded)
        assertEquals(
            setOf(DegradedReason.FILTERING_NOT_OPERATIONAL),
            (result as ProtectionState.Degraded).reasons,
        )
    }

    @Test
    fun `fatal runtime error returns Error`() {
        val signals = healthySignals(fatalError = FatalError("native tunnel crash"))

        val result = ProtectionStateEvaluator.evaluate(signals)

        assertEquals(ProtectionState.Error("native tunnel crash"), result)
    }

    @Test
    fun `user intent enabled with unhealthy runtime never returns Protected`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.STOPPED,
            userIntentEnabled = true,
            tunnelEstablished = false,
            filteringOperational = false,
        )

        val result = ProtectionStateEvaluator.evaluate(signals)

        assertTrue(result !is ProtectionState.Protected)
        assertEquals(ProtectionState.Stopped, result)
    }

    @Test
    fun `service stopped and never configured returns NotConfigured`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.STOPPED,
            userIntentEnabled = false,
        )

        assertEquals(ProtectionState.NotConfigured, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `both tunnel and filtering unhealthy while running reports both reasons`() {
        val signals = healthySignals(
            serviceLifecycleState = ServiceLifecycleState.RUNNING,
            tunnelEstablished = false,
            filteringOperational = false,
        )

        val result = ProtectionStateEvaluator.evaluate(signals)

        assertTrue(result is ProtectionState.Degraded)
        assertEquals(
            setOf(DegradedReason.TUNNEL_NOT_ESTABLISHED, DegradedReason.FILTERING_NOT_OPERATIONAL),
            (result as ProtectionState.Degraded).reasons,
        )
    }

    @Test
    fun `fatal error takes precedence over missing permission`() {
        val signals = healthySignals(
            vpnPermissionGranted = false,
            fatalError = FatalError("out of memory"),
        )

        assertEquals(ProtectionState.Error("out of memory"), ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `missing permission takes precedence over running lifecycle state`() {
        val signals = healthySignals(
            vpnPermissionGranted = false,
            serviceLifecycleState = ServiceLifecycleState.RUNNING,
            tunnelEstablished = true,
            filteringOperational = true,
        )

        assertEquals(ProtectionState.PermissionRequired, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `evaluate is deterministic for identical signals`() {
        val signals = healthySignals()

        val first = ProtectionStateEvaluator.evaluate(signals)
        val second = ProtectionStateEvaluator.evaluate(signals)

        assertEquals(first, second)
    }
}

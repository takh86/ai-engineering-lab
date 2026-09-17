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
        fatalError: FatalError? = null,
    ) = ProtectionSignals(
        vpnPermissionGranted = vpnPermissionGranted,
        serviceLifecycleState = serviceLifecycleState,
        tunnelEstablished = tunnelEstablished,
        filteringOperational = filteringOperational,
        fatalError = fatalError,
    )

    @Test
    fun `missing permission returns PermissionRequired`() {
        val signals = healthySignals(vpnPermissionGranted = false)

        assertEquals(ProtectionState.PermissionRequired, ProtectionStateEvaluator.evaluate(signals))
    }

    @Test
    fun `permission granted but service stopped returns Stopped`() {
        val signals = healthySignals(serviceLifecycleState = ServiceLifecycleState.STOPPED)

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
    fun `ProtectionSignals contains no configuration or user intent fields`() {
        val forbiddenKeywords = listOf("intent", "config", "preference", "enabled")
        val fieldNames = ProtectionSignals::class.java.declaredFields.map { it.name.lowercase() }

        fieldNames.forEach { name ->
            forbiddenKeywords.forEach { keyword ->
                assertTrue(
                    "ProtectionSignals field '$name' looks like saved configuration/user intent, " +
                        "not a verifiable runtime fact",
                    !name.contains(keyword),
                )
            }
        }
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

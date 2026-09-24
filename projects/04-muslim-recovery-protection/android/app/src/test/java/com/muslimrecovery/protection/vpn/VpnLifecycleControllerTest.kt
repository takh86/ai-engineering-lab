package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.domain.protection.DegradedReason
import com.muslimrecovery.protection.domain.protection.ProtectionState
import com.muslimrecovery.protection.domain.protection.ProtectionStateEvaluator
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VpnLifecycleControllerTest {

    @Test
    fun `fresh controller reports Stopped with no tunnel and no error`() {
        val controller = VpnLifecycleController()

        val signals = controller.signals(vpnPermissionGranted = true)

        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
        assertFalse(signals.filteringOperational)
        assertNull(signals.fatalError)
    }

    @Test
    fun `start request from Stopped proceeds to establish and moves to Starting`() {
        val controller = VpnLifecycleController()

        val decision = controller.onStartRequested()

        assertEquals(VpnLifecycleController.StartDecision.ProceedToEstablish, decision)
        assertEquals(ServiceLifecycleState.STARTING, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `repeated start request while starting is a no-op`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        val second = controller.onStartRequested()

        assertEquals(VpnLifecycleController.StartDecision.AlreadyInProgress, second)
    }

    @Test
    fun `repeated start request while running is a no-op`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val second = controller.onStartRequested()

        assertEquals(VpnLifecycleController.StartDecision.AlreadyInProgress, second)
        assertEquals(ServiceLifecycleState.RUNNING, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `tunnel established transitions Starting to Running with tunnelEstablished true`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        controller.onTunnelEstablished()

        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.RUNNING, signals.serviceLifecycleState)
        assertTrue(signals.tunnelEstablished)
    }

    @Test
    fun `tunnel established is ignored when not Starting`() {
        val controller = VpnLifecycleController()

        controller.onTunnelEstablished()

        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
    }

    @Test
    fun `establish failure returns to Stopped and records a fatal error`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        controller.onEstablishFailed("TUN establishment failed")

        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
        assertEquals("TUN establishment failed", signals.fatalError?.reason)
    }

    @Test
    fun `starting again after a failure clears the previous fatal error`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onEstablishFailed("TUN establishment failed")

        controller.onStartRequested()

        assertNull(controller.signals(vpnPermissionGranted = true).fatalError)
    }

    @Test
    fun `stop request from Running closes the tunnel and returns to Stopped`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val decision = controller.onStopRequested()

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, decision)
        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
    }

    @Test
    fun `repeated stop request when already stopped is a no-op`() {
        val controller = VpnLifecycleController()

        val decision = controller.onStopRequested()

        assertEquals(VpnLifecycleController.StopDecision.NoOp, decision)
    }

    @Test
    fun `stop is idempotent when called twice after running`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val first = controller.onStopRequested()
        val second = controller.onStopRequested()

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, first)
        assertEquals(VpnLifecycleController.StopDecision.NoOp, second)
    }

    @Test
    fun `revoke while running behaves like stop and closes the tunnel`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val decision = controller.onRevoked()

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, decision)
        assertEquals(ServiceLifecycleState.STOPPED, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `stop request while still starting reports CloseTunnel and returns to Stopped`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        val decision = controller.onStopRequested()

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, decision)
        assertEquals(ServiceLifecycleState.STOPPED, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `revoke while still starting behaves like stop`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        val decision = controller.onRevoked()

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, decision)
        assertEquals(ServiceLifecycleState.STOPPED, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `a tunnel established callback that arrives after a revoke raced in while starting is rejected`() {
        // Models LocalProtectionVpnService's real race: establish() is in flight on one thread
        // while onRevoke() arrives on another (Android does not guarantee onRevoke runs on the
        // main thread) and completes first.
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onRevoked()

        controller.onTunnelEstablished()

        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
    }

    @Test
    fun `full restart cycle works after a clean stop`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()
        controller.onStopRequested()

        val decision = controller.onStartRequested()
        controller.onTunnelEstablished()

        assertEquals(VpnLifecycleController.StartDecision.ProceedToEstablish, decision)
        assertEquals(ServiceLifecycleState.RUNNING, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `a running tunnel never evaluates to Protected because filtering is not operational`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val state = ProtectionStateEvaluator.evaluate(controller.signals(vpnPermissionGranted = true))

        assertTrue(state is ProtectionState.Degraded)
        assertEquals(setOf(DegradedReason.FILTERING_NOT_OPERATIONAL), (state as ProtectionState.Degraded).reasons)
    }

    @Test
    fun `missing permission reports PermissionRequired even while the controller is running`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val state = ProtectionStateEvaluator.evaluate(controller.signals(vpnPermissionGranted = false))

        assertEquals(ProtectionState.PermissionRequired, state)
    }

    @Test
    fun `establish failure never evaluates to Protected`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        controller.onEstablishFailed("TUN establishment failed")

        val state = ProtectionStateEvaluator.evaluate(controller.signals(vpnPermissionGranted = true))

        assertTrue(state is ProtectionState.Error)
    }

    @Test
    fun `foreground start failure returns to Stopped and records a fatal error`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        controller.onForegroundStartFailed("Foreground service start failed")

        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
        assertEquals("Foreground service start failed", signals.fatalError?.reason)
    }

    @Test
    fun `foreground start failure never evaluates to Protected`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()

        controller.onForegroundStartFailed("Foreground service start failed")

        val state = ProtectionStateEvaluator.evaluate(controller.signals(vpnPermissionGranted = true))

        assertTrue(state is ProtectionState.Error)
    }

    @Test
    fun `starting again after a foreground start failure clears the previous fatal error`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onForegroundStartFailed("Foreground service start failed")

        controller.onStartRequested()

        assertNull(controller.signals(vpnPermissionGranted = true).fatalError)
    }

    @Test
    fun `an unexpected teardown from Running reports CloseTunnel and truthfully returns to Stopped`() {
        // Models LocalProtectionVpnService#onDestroy as a safety net: the system tears the
        // service down without a preceding explicit stop or revoke. Must not leave the
        // runtime facts claiming RUNNING/tunnelEstablished=true afterward.
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()

        val decision = controller.onStopRequested()

        assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, decision)
        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertFalse(signals.tunnelEstablished)
    }

    @Test
    fun `an unexpected teardown after an explicit stop already ran is a no-op`() {
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onTunnelEstablished()
        controller.onStopRequested()

        val decision = controller.onStopRequested()

        assertEquals(VpnLifecycleController.StopDecision.NoOp, decision)
        assertEquals(ServiceLifecycleState.STOPPED, controller.signals(true).serviceLifecycleState)
    }

    @Test
    fun `a fatal error survives an unexpected teardown that follows a startup failure`() {
        // Models LocalProtectionVpnService#onDestroy firing (as a safety net) after
        // onForegroundStartFailed already recorded a fatal error: onStopRequested() must not
        // silently downgrade that to a plain, error-free Stopped state.
        val controller = VpnLifecycleController()
        controller.onStartRequested()
        controller.onForegroundStartFailed("Foreground service start failed")

        controller.onStopRequested()

        val signals = controller.signals(vpnPermissionGranted = true)
        assertEquals(ServiceLifecycleState.STOPPED, signals.serviceLifecycleState)
        assertEquals("Foreground service start failed", signals.fatalError?.reason)
    }
}

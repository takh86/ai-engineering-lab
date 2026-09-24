package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.domain.protection.FatalError
import com.muslimrecovery.protection.domain.protection.ProtectionSignals
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState

/**
 * Pure lifecycle policy for the local protection VPN tunnel (M1-04: lifecycle only, no
 * filtering). Owns no Android framework resources itself — [LocalProtectionVpnService] holds
 * the real [android.os.ParcelFileDescriptor] and calls into this controller only to decide
 * what to do next, so the decision logic can be unit tested off-device.
 *
 * [filteringOperational] is hardcoded false in [signals] regardless of tunnel state, because
 * M1-04 implements no filtering — this is what keeps a fully-established tunnel from ever
 * evaluating to [com.muslimrecovery.protection.domain.protection.ProtectionState.Protected].
 *
 * Methods are synchronized because Android may call [android.net.VpnService.onRevoke] on a
 * thread other than the one driving onStartCommand.
 */
class VpnLifecycleController {

    private var lifecycleState: ServiceLifecycleState = ServiceLifecycleState.STOPPED
    private var tunnelEstablished: Boolean = false
    private var fatalError: FatalError? = null

    @Synchronized
    fun onStartRequested(): StartDecision {
        return when (lifecycleState) {
            ServiceLifecycleState.STOPPED -> {
                lifecycleState = ServiceLifecycleState.STARTING
                tunnelEstablished = false
                fatalError = null
                StartDecision.ProceedToEstablish
            }

            ServiceLifecycleState.STARTING,
            ServiceLifecycleState.RUNNING,
            -> StartDecision.AlreadyInProgress
        }
    }

    @Synchronized
    fun onTunnelEstablished() {
        if (lifecycleState != ServiceLifecycleState.STARTING) return
        tunnelEstablished = true
        lifecycleState = ServiceLifecycleState.RUNNING
    }

    @Synchronized
    fun onEstablishFailed(reason: String) = failStartup(reason)

    /**
     * Distinct from [onEstablishFailed]: covers the earlier failure point where
     * [android.app.Service.startForeground] itself throws (foreground-service restrictions,
     * FGS type eligibility, or permissions) before [android.net.VpnService.Builder.establish]
     * is ever called. Kept as its own method, rather than reusing [onEstablishFailed], so the
     * state machine names each failure point truthfully; both currently resolve to the same
     * STOPPED+fatalError transition.
     */
    @Synchronized
    fun onForegroundStartFailed(reason: String) = failStartup(reason)

    private fun failStartup(reason: String) {
        lifecycleState = ServiceLifecycleState.STOPPED
        tunnelEstablished = false
        fatalError = FatalError(reason)
    }

    @Synchronized
    fun onStopRequested(): StopDecision {
        val wasActive = lifecycleState != ServiceLifecycleState.STOPPED || tunnelEstablished
        lifecycleState = ServiceLifecycleState.STOPPED
        tunnelEstablished = false
        return if (wasActive) StopDecision.CloseTunnel else StopDecision.NoOp
    }

    /** Android's revoke contract is stop-shaped: clean up and go to STOPPED. */
    @Synchronized
    fun onRevoked(): StopDecision = onStopRequested()

    @Synchronized
    fun signals(vpnPermissionGranted: Boolean): ProtectionSignals = ProtectionSignals(
        vpnPermissionGranted = vpnPermissionGranted,
        serviceLifecycleState = lifecycleState,
        tunnelEstablished = tunnelEstablished,
        filteringOperational = false,
        fatalError = fatalError,
    )

    enum class StartDecision {
        /** Caller should proceed to call [android.net.VpnService.Builder.establish]. */
        ProceedToEstablish,

        /** Already starting or running; caller should treat this as a no-op. */
        AlreadyInProgress,
    }

    enum class StopDecision {
        /** Caller should close its held [android.os.ParcelFileDescriptor], if any. */
        CloseTunnel,

        /** Nothing was active; caller has nothing to clean up. */
        NoOp,
    }
}

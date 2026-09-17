package com.muslimrecovery.protection.domain.protection

/**
 * Pure, deterministic evaluation of [ProtectionSignals] into a [ProtectionState].
 *
 * Evaluation order (highest priority first):
 * 1. A [FatalError] signal always wins — the runtime state can no longer be trusted.
 * 2. Missing VPN permission always wins next — protection cannot run without it, and this
 *    must be reported even if a user previously enabled protection.
 * 3. Service lifecycle state (stopped / starting / running) determines the broad state.
 * 4. Only when the service is actually RUNNING are tunnel/filtering health checked to decide
 *    between [ProtectionState.Protected] and [ProtectionState.Degraded].
 *
 * This evaluator reads [ProtectionSignals] only — it has no knowledge of saved user/config
 * intent, so configuration/preferences can never influence the result.
 */
object ProtectionStateEvaluator {

    fun evaluate(signals: ProtectionSignals): ProtectionState {
        signals.fatalError?.let { return ProtectionState.Error(it.reason) }

        if (!signals.vpnPermissionGranted) {
            return ProtectionState.PermissionRequired
        }

        return when (signals.serviceLifecycleState) {
            ServiceLifecycleState.STOPPED -> ProtectionState.Stopped

            ServiceLifecycleState.STARTING -> ProtectionState.Starting

            ServiceLifecycleState.RUNNING -> evaluateRunning(signals)
        }
    }

    private fun evaluateRunning(signals: ProtectionSignals): ProtectionState {
        val reasons = buildSet {
            if (!signals.tunnelEstablished) add(DegradedReason.TUNNEL_NOT_ESTABLISHED)
            if (!signals.filteringOperational) add(DegradedReason.FILTERING_NOT_OPERATIONAL)
        }

        return if (reasons.isEmpty()) ProtectionState.Protected else ProtectionState.Degraded(reasons)
    }
}

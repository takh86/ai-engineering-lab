package com.muslimrecovery.protection.domain.protection

/**
 * A specific reason why an otherwise-running protection service is not fully healthy.
 */
enum class DegradedReason {
    TUNNEL_NOT_ESTABLISHED,
    FILTERING_NOT_OPERATIONAL,
}

/**
 * The truthful domain protection state, consumed by UI. This is derived exclusively from
 * [ProtectionSignals] runtime facts by [ProtectionStateEvaluator] — it is never set directly
 * from a saved preference, toggle, or user intent. This model represents actual runtime
 * protection state only; user intent/configuration is intentionally outside it. A separate
 * setup/onboarding state may be introduced later if needed, but it must not be merged into
 * this type.
 *
 * [Protected] is the only state that claims protection is actually active right now.
 * [Error.reason] is a diagnostic string for logging/debugging — it is not user-facing copy
 * and must not be rendered to users directly.
 */
sealed interface ProtectionState {

    /** The VPN permission required to run the protection service has not been granted. */
    data object PermissionRequired : ProtectionState

    /** The protection service is in the process of starting up. */
    data object Starting : ProtectionState

    /** All runtime conditions required for real protection are verified and healthy. */
    data object Protected : ProtectionState

    /** The service is running but at least one required runtime condition is unhealthy. */
    data class Degraded(val reasons: Set<DegradedReason>) : ProtectionState

    /** Permission is granted, but the protection service is not running. */
    data object Stopped : ProtectionState

    /** A fatal, unrecoverable runtime failure occurred. */
    data class Error(val reason: String) : ProtectionState
}

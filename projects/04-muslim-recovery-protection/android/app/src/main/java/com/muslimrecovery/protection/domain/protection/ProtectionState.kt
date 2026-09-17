package com.muslimrecovery.protection.domain.protection

/**
 * A specific reason why an otherwise-running protection service is not fully healthy.
 */
enum class DegradedReason {
    TUNNEL_NOT_ESTABLISHED,
    FILTERING_NOT_OPERATIONAL,
}

/**
 * The truthful, user-visible protection state. This is derived exclusively from
 * [ProtectionSignals] runtime facts by [ProtectionStateEvaluator] — it is never set directly
 * from a saved preference, toggle, or user intent.
 *
 * [Protected] is the only state that claims the user is actually protected right now.
 */
sealed interface ProtectionState {

    /** No saved user intent to enable protection yet, and the service has never run. */
    data object NotConfigured : ProtectionState

    /** The VPN permission required to run the protection service has not been granted. */
    data object PermissionRequired : ProtectionState

    /** The protection service is in the process of starting up. */
    data object Starting : ProtectionState

    /** All runtime conditions required for real protection are verified and healthy. */
    data object Protected : ProtectionState

    /** The service is running but at least one required runtime condition is unhealthy. */
    data class Degraded(val reasons: Set<DegradedReason>) : ProtectionState

    /** Permission is granted and the user has enabled protection, but the service is not running. */
    data object Stopped : ProtectionState

    /** A fatal, unrecoverable runtime failure occurred. */
    data class Error(val reason: String) : ProtectionState
}

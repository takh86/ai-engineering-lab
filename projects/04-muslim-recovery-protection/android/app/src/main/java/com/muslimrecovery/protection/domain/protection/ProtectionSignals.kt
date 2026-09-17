package com.muslimrecovery.protection.domain.protection

/**
 * The lifecycle phase of the protection service itself, independent of tunnel/filtering health.
 */
enum class ServiceLifecycleState {
    STOPPED,
    STARTING,
    RUNNING,
}

/**
 * A fatal, unrecoverable runtime failure. Presence of this signal always wins over every
 * other signal — including permission and lifecycle state — because a fatal error means the
 * runtime state is no longer trustworthy enough to evaluate normally.
 */
data class FatalError(val reason: String)

/**
 * The complete set of runtime facts the evaluator needs to determine the actual protection
 * state. This is deliberately NOT a persisted/config object — it contains only verifiable
 * runtime facts. Saved user/config intent (e.g. "the user turned protection on") is a
 * separate concept and must never be added here or allowed to influence
 * [ProtectionState.Protected].
 */
data class ProtectionSignals(
    val vpnPermissionGranted: Boolean,
    val serviceLifecycleState: ServiceLifecycleState,
    val tunnelEstablished: Boolean,
    val filteringOperational: Boolean,
    val fatalError: FatalError? = null,
)

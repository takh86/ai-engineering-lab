package com.muslimrecovery.protection.vpn

import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import com.muslimrecovery.protection.domain.protection.FatalError
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState

/**
 * The runtime facts [LocalProtectionVpnService] actually owns (lifecycle, tunnel, fatal error).
 * Deliberately excludes VPN permission — that is a UI-observable Android fact
 * ([android.net.VpnService.prepare] returning null), not something the service tracks, and
 * deliberately excludes filteringOperational — M1-04 has no filtering, so callers must not
 * invent a value for it; combine this with the permission check via
 * [com.muslimrecovery.protection.domain.protection.ProtectionSignals] instead.
 */
data class VpnRuntimeFacts(
    val serviceLifecycleState: ServiceLifecycleState = ServiceLifecycleState.STOPPED,
    val tunnelEstablished: Boolean = false,
    val fatalError: FatalError? = null,
)

/**
 * In-process bridge from [LocalProtectionVpnService] to UI observers (single process, no AIDL/
 * Messenger needed). Not persisted: after process death the default value (STOPPED, no tunnel,
 * no error) is the truthful state, since nothing has reported otherwise.
 */
object VpnRuntimeStatus {
    private val state = mutableStateOf(VpnRuntimeFacts())
    val facts: State<VpnRuntimeFacts> = state

    internal fun update(facts: VpnRuntimeFacts) {
        state.value = facts
    }
}

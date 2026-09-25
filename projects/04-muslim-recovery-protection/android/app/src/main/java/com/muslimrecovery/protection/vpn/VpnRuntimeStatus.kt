package com.muslimrecovery.protection.vpn

import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import com.muslimrecovery.protection.dns.ExperimentalDnsCounters

/**
 * In-process bridge from [LocalProtectionVpnService] to UI observers (single process, no AIDL/
 * Messenger needed). Not persisted: after process death the default value (STOPPED, no tunnel,
 * no error, DNS proxy not running, zero counters) is the truthful state, since nothing has
 * reported otherwise.
 *
 * [dnsCounters] is a separate state from [facts] because it is written by the DNS worker thread,
 * while [facts] is written by the service under its lifecycle lock — keeping them apart means
 * neither writer can overwrite the other's update. Counters are aggregate numbers only.
 */
object VpnRuntimeStatus {
    private val state = mutableStateOf(VpnRuntimeFacts())
    val facts: State<VpnRuntimeFacts> = state

    private val counters = mutableStateOf(ExperimentalDnsCounters())
    val dnsCounters: State<ExperimentalDnsCounters> = counters

    internal fun update(facts: VpnRuntimeFacts) {
        state.value = facts
    }

    internal fun updateDnsCounters(value: ExperimentalDnsCounters) {
        counters.value = value
    }
}

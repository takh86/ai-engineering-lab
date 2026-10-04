package com.muslimrecovery.protection.feature.plan

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Thin controller around the pure [reduce]. The UI shows the store's state, not an optimistic copy: the snapshot only
 * changes when the store's [PlanStore.access] emits. Each edit is exactly one [PlanStore.apply] call.
 * Plain Kotlin (no Android types) so it is JVM-testable; the ViewModel only supplies a scope.
 */
class PlanController(private val store: PlanStore) {
    private val mutable = MutableStateFlow(PlanState())
    private val writeLock = Mutex()

    val state: StateFlow<PlanState> get() = mutable

    /** Collects the store forever; call from a long-lived scope. */
    suspend fun observe() {
        store.access.collect { dispatch(PlanEvent.AccessChanged(it)) }
    }

    /** Pure UI events (no store call). */
    fun dispatch(event: PlanEvent) {
        mutable.update { reduce(it, event) }
    }

    /** Events that may trigger a write: SaveRequested, SaveAsNewRequested, DeleteConfirmed. */
    suspend fun submit(event: PlanEvent) {
        writeLock.withLock {
            var edit: PlanEdit? = null
            mutable.update { before ->
                val after = reduce(before, event)
                edit = if (before.pendingWrite() == null) after.pendingWrite() else null
                after
            }
            val toApply = edit ?: return
            val result = try {
                store.apply(toApply)
            } catch (c: CancellationException) {
                throw c
            } catch (e: Exception) {
                PlanWriteResult.FAILED
            }
            dispatch(PlanEvent.WriteFinished(result))
        }
    }
}

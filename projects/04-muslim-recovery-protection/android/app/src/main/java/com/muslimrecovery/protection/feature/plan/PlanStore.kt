package com.muslimrecovery.protection.feature.plan

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** What the store currently lets F5 see. A locked or unavailable store exposes no content at all. */
sealed interface PlanAccess {
    class Open(val snapshot: PlanSnapshot) : PlanAccess {
        override fun toString() = "PlanAccess.Open(redacted)"
    }

    object Locked : PlanAccess
    object Unavailable : PlanAccess
}

/** One atomic edit. Each edit is exactly one store call (acceptance criterion 2). */
sealed interface PlanEdit {
    class Add(val section: PlanSection, val primary: String, val secondary: String) : PlanEdit {
        override fun toString() = "PlanEdit.Add(redacted)"
    }

    class Update(val section: PlanSection, val id: Long, val primary: String, val secondary: String) : PlanEdit {
        override fun toString() = "PlanEdit.Update(redacted)"
    }

    class Delete(val section: PlanSection, val id: Long) : PlanEdit {
        override fun toString() = "PlanEdit.Delete(redacted)"
    }
}

enum class PlanWriteResult { SUCCESS, NOT_FOUND, REJECTED, FAILED, LOCKED, UNAVAILABLE }

/**
 * Feature-local port for the plan (D1). The real, secure, durable implementation belongs to F7 and is bound by the
 * Integration Agent; F5 never persists anything itself. A write either fully applies or leaves the plan unchanged.
 */
interface PlanStore {
    val access: StateFlow<PlanAccess>

    suspend fun apply(edit: PlanEdit): PlanWriteResult
}

/**
 * Development and test implementation: plan content lives only in this object's memory and is gone with the process.
 * It is NOT a release implementation and it never touches Preferences, DataStore or files (secure durable storage
 * is F7). It re-checks the contract limits so a buggy caller cannot exceed them.
 */
class InMemoryPlanStore(initial: PlanSnapshot = PlanSnapshot()) : PlanStore {
    private enum class Mode { OPEN, LOCKED, UNAVAILABLE }

    private val lock = Any()
    private var data = initial
    private var mode = Mode.OPEN
    private var nextId = 1L + maxOf(
        initial.reasons.maxOfOrNull { it.id } ?: 0L,
        initial.steps.maxOfOrNull { it.id } ?: 0L,
        initial.ifThenPlans.maxOfOrNull { it.id } ?: 0L,
    )
    private val flow = MutableStateFlow<PlanAccess>(PlanAccess.Open(initial))

    override val access: StateFlow<PlanAccess> get() = flow

    /** Simulates the F7 lock event; the content is kept in memory but hidden while locked. */
    fun setLocked() = synchronized(lock) { mode = Mode.LOCKED; publish() }

    fun setUnavailable() = synchronized(lock) { mode = Mode.UNAVAILABLE; publish() }

    fun setOpen() = synchronized(lock) { mode = Mode.OPEN; publish() }

    private fun publish() {
        flow.value = when (mode) {
            Mode.OPEN -> PlanAccess.Open(data)
            Mode.LOCKED -> PlanAccess.Locked
            Mode.UNAVAILABLE -> PlanAccess.Unavailable
        }
    }

    override suspend fun apply(edit: PlanEdit): PlanWriteResult = synchronized(lock) {
        when (mode) {
            Mode.LOCKED -> return PlanWriteResult.LOCKED
            Mode.UNAVAILABLE -> return PlanWriteResult.UNAVAILABLE
            Mode.OPEN -> Unit
        }
        val result = when (edit) {
            is PlanEdit.Add -> add(edit)
            is PlanEdit.Update -> update(edit)
            is PlanEdit.Delete -> delete(edit)
        }
        if (result == PlanWriteResult.SUCCESS) publish()
        result
    }

    private fun add(edit: PlanEdit.Add): PlanWriteResult {
        val v = PlanValidator.validate(edit.section, edit.primary, edit.secondary)
        if (!v.ok || data.count(edit.section) >= PlanLimits.MAX_ITEMS) return PlanWriteResult.REJECTED
        val id = nextId++
        data = when (edit.section) {
            PlanSection.REASONS -> PlanSnapshot(data.reasons + Reason(id, v.primary), data.steps, data.ifThenPlans)
            PlanSection.STEPS -> PlanSnapshot(data.reasons, data.steps + SupportStep(id, v.primary), data.ifThenPlans)
            PlanSection.IF_THEN -> PlanSnapshot(data.reasons, data.steps, data.ifThenPlans + IfThenPlan(id, v.primary, v.secondary))
        }
        return PlanWriteResult.SUCCESS
    }

    private fun update(edit: PlanEdit.Update): PlanWriteResult {
        if (!data.contains(edit.section, edit.id)) return PlanWriteResult.NOT_FOUND
        val v = PlanValidator.validate(edit.section, edit.primary, edit.secondary)
        if (!v.ok) return PlanWriteResult.REJECTED
        data = when (edit.section) {
            PlanSection.REASONS -> PlanSnapshot(
                data.reasons.map { if (it.id == edit.id) Reason(it.id, v.primary) else it }, data.steps, data.ifThenPlans,
            )
            PlanSection.STEPS -> PlanSnapshot(
                data.reasons, data.steps.map { if (it.id == edit.id) SupportStep(it.id, v.primary) else it }, data.ifThenPlans,
            )
            PlanSection.IF_THEN -> PlanSnapshot(
                data.reasons, data.steps,
                data.ifThenPlans.map { if (it.id == edit.id) IfThenPlan(it.id, v.primary, v.secondary) else it },
            )
        }
        return PlanWriteResult.SUCCESS
    }

    private fun delete(edit: PlanEdit.Delete): PlanWriteResult {
        if (!data.contains(edit.section, edit.id)) return PlanWriteResult.NOT_FOUND
        data = when (edit.section) {
            PlanSection.REASONS -> PlanSnapshot(data.reasons.filter { it.id != edit.id }, data.steps, data.ifThenPlans)
            PlanSection.STEPS -> PlanSnapshot(data.reasons, data.steps.filter { it.id != edit.id }, data.ifThenPlans)
            PlanSection.IF_THEN -> PlanSnapshot(data.reasons, data.steps, data.ifThenPlans.filter { it.id != edit.id })
        }
        return PlanWriteResult.SUCCESS
    }
}

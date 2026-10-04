package com.muslimrecovery.protection.feature.plan

enum class PlanAccessKind { LOADING, OPEN, LOCKED, UNAVAILABLE }

/**
 * The inline editor for one item. [itemId] null means a new item. The draft text lives only here (in memory, in the
 * holder that survives rotation); it is never written to saved instance state.
 */
class EditorState(
    val section: PlanSection,
    val itemId: Long?,
    val primary: String = "",
    val secondary: String = "",
    val primaryError: FieldError? = null,
    val secondaryError: FieldError? = null,
    val duplicate: Boolean = false,
    val saving: Boolean = false,
    val writeFailed: Boolean = false,
    val itemGone: Boolean = false,
) {
    fun copy(
        itemId: Long? = this.itemId,
        primary: String = this.primary,
        secondary: String = this.secondary,
        primaryError: FieldError? = this.primaryError,
        secondaryError: FieldError? = this.secondaryError,
        duplicate: Boolean = this.duplicate,
        saving: Boolean = this.saving,
        writeFailed: Boolean = this.writeFailed,
        itemGone: Boolean = this.itemGone,
    ) = EditorState(section, itemId, primary, secondary, primaryError, secondaryError, duplicate, saving, writeFailed, itemGone)

    override fun toString() = "EditorState(redacted)"
}

/** Inline two-step delete confirmation for one item (OD-F5-3). */
class PendingDelete(
    val section: PlanSection,
    val id: Long,
    val inFlight: Boolean = false,
    val failed: Boolean = false,
) {
    override fun toString() = "PendingDelete(redacted)"
}

/**
 * Whole My Plan UI state. Content ([snapshot], [editor]) exists only while [access] is OPEN; any other access wipes
 * it, so a locked or unavailable store can never leave plan text in memory or on screen.
 */
class PlanState(
    val access: PlanAccessKind = PlanAccessKind.LOADING,
    val snapshot: PlanSnapshot = PlanSnapshot(),
    val editor: EditorState? = null,
    val pendingDelete: PendingDelete? = null,
    /** Section whose item limit was hit when the user tried to add (shown as a message, never silently dropped). */
    val limitNotice: PlanSection? = null,
) {
    fun copy(
        access: PlanAccessKind = this.access,
        snapshot: PlanSnapshot = this.snapshot,
        editor: EditorState? = this.editor,
        pendingDelete: PendingDelete? = this.pendingDelete,
        limitNotice: PlanSection? = this.limitNotice,
    ) = PlanState(access, snapshot, editor, pendingDelete, limitNotice)

    override fun toString() = "PlanState(access=$access)"
}

sealed interface PlanEvent {
    class AccessChanged(val access: PlanAccess) : PlanEvent
    class AddRequested(val section: PlanSection) : PlanEvent
    class EditRequested(val section: PlanSection, val id: Long) : PlanEvent
    class PrimaryChanged(val text: String) : PlanEvent {
        override fun toString() = "PrimaryChanged(redacted)"
    }
    class SecondaryChanged(val text: String) : PlanEvent {
        override fun toString() = "SecondaryChanged(redacted)"
    }
    object EditorCancelled : PlanEvent
    object SaveRequested : PlanEvent
    object SaveAsNewRequested : PlanEvent
    class WriteFinished(val result: PlanWriteResult) : PlanEvent
    class DeleteAsked(val section: PlanSection, val id: Long) : PlanEvent
    object DeleteKept : PlanEvent
    object DeleteConfirmed : PlanEvent
    object LimitNoticeDismissed : PlanEvent
}

/** The store edit implied by the state, or null. At most one write is in flight at a time. */
fun PlanState.pendingWrite(): PlanEdit? {
    val e = editor
    if (e != null && e.saving) {
        val v = PlanValidator.validate(e.section, e.primary, e.secondary)
        return if (e.itemId == null) {
            PlanEdit.Add(e.section, v.primary, v.secondary)
        } else {
            PlanEdit.Update(e.section, e.itemId, v.primary, v.secondary)
        }
    }
    val d = pendingDelete
    if (d != null && d.inFlight) return PlanEdit.Delete(d.section, d.id)
    return null
}

private fun PlanState.writeInFlight(): Boolean = (editor?.saving == true) || (pendingDelete?.inFlight == true)

/** Hard cap on what the draft may hold, so a hostile paste cannot balloon memory; the validator still reports TOO_LONG. */
private fun clampDraft(text: String, max: Int): String {
    val limit = max * 2
    return if (text.length <= limit) text else text.substring(0, limit)
}

private fun wiped(access: PlanAccessKind) =
    PlanState(access = access, snapshot = PlanSnapshot(), editor = null, pendingDelete = null, limitNotice = null)

private fun revalidateDuplicate(state: PlanState, editor: EditorState): EditorState =
    editor.copy(
        duplicate = PlanValidator.isDuplicate(
            state.snapshot.rows(editor.section), editor.itemId, editor.primary.trim(), editor.secondary.trim(),
        ),
    )

/** The pure state machine. Never throws; unknown or stale events leave the state unchanged. */
fun reduce(state: PlanState, event: PlanEvent): PlanState {
    if (event is PlanEvent.AccessChanged) return reduceAccess(state, event.access)
    if (event is PlanEvent.WriteFinished) return reduceWrite(state, event.result)
    if (state.access != PlanAccessKind.OPEN) return state
    return when (event) {
        is PlanEvent.AddRequested -> {
            if (state.writeInFlight()) {
                state
            } else if (state.snapshot.count(event.section) >= PlanLimits.MAX_ITEMS) {
                state.copy(editor = null, pendingDelete = null, limitNotice = event.section)
            } else {
                state.copy(editor = EditorState(event.section, null), pendingDelete = null, limitNotice = null)
            }
        }
        is PlanEvent.EditRequested -> {
            val row = state.snapshot.rows(event.section).firstOrNull { it.id == event.id }
            if (state.writeInFlight() || row == null) {
                state
            } else {
                state.copy(
                    editor = revalidateDuplicate(state, EditorState(event.section, event.id, row.primary, row.secondary)),
                    pendingDelete = null,
                    limitNotice = null,
                )
            }
        }
        is PlanEvent.PrimaryChanged -> state.editor.let { e ->
            if (e == null || e.saving) {
                state
            } else {
                val next = e.copy(
                    primary = clampDraft(event.text, PlanLimits.maxPrimary(e.section)),
                    primaryError = null, writeFailed = false,
                )
                state.copy(editor = revalidateDuplicate(state, next))
            }
        }
        is PlanEvent.SecondaryChanged -> state.editor.let { e ->
            if (e == null || e.saving || !PlanLimits.hasSecondary(e.section)) {
                state
            } else {
                val next = e.copy(
                    secondary = clampDraft(event.text, PlanLimits.maxSecondary(e.section)),
                    secondaryError = null, writeFailed = false,
                )
                state.copy(editor = revalidateDuplicate(state, next))
            }
        }
        PlanEvent.EditorCancelled -> if (state.editor?.saving == true) state else state.copy(editor = null)
        PlanEvent.SaveRequested -> save(state, asNew = false)
        PlanEvent.SaveAsNewRequested -> save(state, asNew = true)
        is PlanEvent.DeleteAsked -> {
            if (state.writeInFlight() || !state.snapshot.contains(event.section, event.id)) {
                state
            } else {
                state.copy(editor = null, pendingDelete = PendingDelete(event.section, event.id), limitNotice = null)
            }
        }
        PlanEvent.DeleteKept -> if (state.pendingDelete?.inFlight == true) state else state.copy(pendingDelete = null)
        PlanEvent.DeleteConfirmed -> {
            val d = state.pendingDelete
            if (d == null || d.inFlight || state.writeInFlight()) {
                state
            } else {
                state.copy(pendingDelete = PendingDelete(d.section, d.id, inFlight = true))
            }
        }
        PlanEvent.LimitNoticeDismissed -> state.copy(limitNotice = null)
        is PlanEvent.AccessChanged, is PlanEvent.WriteFinished -> state
    }
}

private fun save(state: PlanState, asNew: Boolean): PlanState {
    val e = state.editor
    if (e == null || state.writeInFlight()) return state
    val target = if (asNew) e.copy(itemId = null, itemGone = false) else e
    val v = PlanValidator.validate(target.section, target.primary, target.secondary)
    if (!v.ok) {
        return state.copy(editor = target.copy(primaryError = v.primaryError, secondaryError = v.secondaryError, writeFailed = false))
    }
    if (target.itemId == null && state.snapshot.count(target.section) >= PlanLimits.MAX_ITEMS) {
        return state.copy(editor = null, limitNotice = target.section)
    }
    return state.copy(
        editor = target.copy(saving = true, writeFailed = false, primaryError = null, secondaryError = null),
        limitNotice = null,
    )
}

private fun reduceAccess(state: PlanState, access: PlanAccess): PlanState = when (access) {
    PlanAccess.Locked -> wiped(PlanAccessKind.LOCKED)
    PlanAccess.Unavailable -> wiped(PlanAccessKind.UNAVAILABLE)
    is PlanAccess.Open -> {
        val snapshot = access.snapshot
        val editor = state.editor?.let { e ->
            // an item deleted elsewhere while being edited is reported; the draft is kept so it can be saved as new
            if (e.itemId != null && !snapshot.contains(e.section, e.itemId) && !e.saving) {
                e.copy(itemGone = true)
            } else {
                e
            }
        }
        val pending = state.pendingDelete?.takeIf { snapshot.contains(it.section, it.id) || it.inFlight }
        val next = state.copy(access = PlanAccessKind.OPEN, snapshot = snapshot, editor = editor, pendingDelete = pending)
        next.copy(editor = next.editor?.let { revalidateDuplicate(next, it) })
    }
}

private fun reduceWrite(state: PlanState, result: PlanWriteResult): PlanState {
    if (state.access != PlanAccessKind.OPEN) return state
    when (result) {
        PlanWriteResult.LOCKED -> return wiped(PlanAccessKind.LOCKED)
        PlanWriteResult.UNAVAILABLE -> return wiped(PlanAccessKind.UNAVAILABLE)
        else -> Unit
    }
    val editor = state.editor
    val pending = state.pendingDelete
    return when {
        editor != null && editor.saving -> when (result) {
            PlanWriteResult.SUCCESS -> state.copy(editor = null)
            PlanWriteResult.NOT_FOUND -> state.copy(editor = editor.copy(saving = false, itemGone = true))
            else -> state.copy(editor = editor.copy(saving = false, writeFailed = true))
        }
        pending != null && pending.inFlight -> when (result) {
            PlanWriteResult.SUCCESS, PlanWriteResult.NOT_FOUND -> state.copy(pendingDelete = null)
            else -> state.copy(pendingDelete = PendingDelete(pending.section, pending.id, inFlight = false, failed = true))
        }
        else -> state
    }
}

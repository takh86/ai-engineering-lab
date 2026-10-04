package com.muslimrecovery.protection.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanReducerTest {
    private fun open(snapshot: PlanSnapshot = PlanSnapshot()) =
        reduce(PlanState(), PlanEvent.AccessChanged(PlanAccess.Open(snapshot)))

    private fun full(section: PlanSection): PlanSnapshot = when (section) {
        PlanSection.REASONS -> PlanSnapshot(reasons = (1L..20L).map { Reason(it, "r$it") })
        PlanSection.STEPS -> PlanSnapshot(steps = (1L..20L).map { SupportStep(it, "s$it") })
        PlanSection.IF_THEN -> PlanSnapshot(ifThenPlans = (1L..20L).map { IfThenPlan(it, "i$it", "a$it") })
    }

    private fun apply(state: PlanState, vararg events: PlanEvent) = events.fold(state) { s, e -> reduce(s, e) }

    @Test
    fun startsLoadingAndOpensWithSnapshot() {
        assertEquals(PlanAccessKind.LOADING, PlanState().access)
        val s = open(PlanSnapshot(reasons = listOf(Reason(1, "a"))))
        assertEquals(PlanAccessKind.OPEN, s.access)
        assertEquals(1, s.snapshot.reasons.size)
    }

    @Test
    fun emptyOpenStateHasNoItemsInAnySection() {
        val s = open()
        PlanSection.values().forEach { assertEquals(0, s.snapshot.count(it)) }
    }

    @Test
    fun addFlowValidatesThenMarksSaving() {
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("   "), PlanEvent.SaveRequested)
        assertEquals(FieldError.EMPTY, s.editor!!.primaryError)
        assertFalse(s.editor!!.saving)
        assertNull(s.pendingWrite())
        s = apply(s, PlanEvent.PrimaryChanged("  because  "), PlanEvent.SaveRequested)
        assertTrue(s.editor!!.saving)
        val edit = s.pendingWrite() as PlanEdit.Add
        assertEquals(PlanSection.REASONS, edit.section)
        assertEquals("because", edit.primary)
    }

    @Test
    fun typingClearsTheFieldErrorAndTheFailureFlag() {
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.STEPS), PlanEvent.SaveRequested)
        assertNotNull(s.editor!!.primaryError)
        s = reduce(s, PlanEvent.PrimaryChanged("x"))
        assertNull(s.editor!!.primaryError)
    }

    @Test
    fun ifThenRequiresBothFields() {
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.IF_THEN), PlanEvent.PrimaryChanged("situation"), PlanEvent.SaveRequested)
        assertEquals(FieldError.EMPTY, s.editor!!.secondaryError)
        assertNull(s.editor!!.primaryError)
        s = apply(s, PlanEvent.SecondaryChanged("action"), PlanEvent.SaveRequested)
        val edit = s.pendingWrite() as PlanEdit.Add
        assertEquals("situation", edit.primary)
        assertEquals("action", edit.secondary)
    }

    @Test
    fun secondaryChangesAreIgnoredOutsideIfThen() {
        val s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.SecondaryChanged("zzz"))
        assertEquals("", s.editor!!.secondary)
    }

    @Test
    fun editRequestPrefillsAndSaveProducesUpdate() {
        val base = open(PlanSnapshot(steps = listOf(SupportStep(7, "walk"))))
        var s = apply(base, PlanEvent.EditRequested(PlanSection.STEPS, 7), PlanEvent.PrimaryChanged("walk fast"), PlanEvent.SaveRequested)
        val edit = s.pendingWrite() as PlanEdit.Update
        assertEquals(7L, edit.id)
        assertEquals("walk fast", edit.primary)
        s = reduce(s, PlanEvent.WriteFinished(PlanWriteResult.SUCCESS))
        assertNull(s.editor)
    }

    @Test
    fun editOfAMissingItemIsIgnored() {
        val s = reduce(open(), PlanEvent.EditRequested(PlanSection.REASONS, 99))
        assertNull(s.editor)
    }

    @Test
    fun duplicateIsFlaggedButStillSavable() {
        val base = open(PlanSnapshot(reasons = listOf(Reason(1, "Family"))))
        val s = apply(base, PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("family"), PlanEvent.SaveRequested)
        assertTrue(s.editor!!.duplicate)
        assertTrue(s.editor!!.saving)
    }

    @Test
    fun editingAnItemDoesNotFlagItselfAsDuplicate() {
        val base = open(PlanSnapshot(reasons = listOf(Reason(1, "Family"))))
        val s = reduce(base, PlanEvent.EditRequested(PlanSection.REASONS, 1))
        assertFalse(s.editor!!.duplicate)
    }

    @Test
    fun deleteIsTwoStepAndKeepIsReversible() {
        val base = open(PlanSnapshot(reasons = listOf(Reason(1, "a"))))
        var s = reduce(base, PlanEvent.DeleteAsked(PlanSection.REASONS, 1))
        assertNotNull(s.pendingDelete)
        assertNull("asking must not write", s.pendingWrite())
        s = reduce(s, PlanEvent.DeleteKept)
        assertNull(s.pendingDelete)
        assertEquals(1, s.snapshot.reasons.size)
        s = apply(s, PlanEvent.DeleteAsked(PlanSection.REASONS, 1), PlanEvent.DeleteConfirmed)
        assertTrue(s.pendingDelete!!.inFlight)
        val edit = s.pendingWrite() as PlanEdit.Delete
        assertEquals(1L, edit.id)
        s = reduce(s, PlanEvent.WriteFinished(PlanWriteResult.SUCCESS))
        assertNull(s.pendingDelete)
    }

    @Test
    fun confirmWithoutAskingDoesNothing() {
        val s = reduce(open(PlanSnapshot(reasons = listOf(Reason(1, "a")))), PlanEvent.DeleteConfirmed)
        assertNull(s.pendingDelete)
        assertNull(s.pendingWrite())
    }

    @Test
    fun deleteFailureKeepsTheConfirmationWithRetry() {
        var s = apply(
            open(PlanSnapshot(reasons = listOf(Reason(1, "a")))),
            PlanEvent.DeleteAsked(PlanSection.REASONS, 1), PlanEvent.DeleteConfirmed, PlanEvent.WriteFinished(PlanWriteResult.FAILED),
        )
        assertTrue(s.pendingDelete!!.failed)
        assertFalse(s.pendingDelete!!.inFlight)
        s = reduce(s, PlanEvent.DeleteConfirmed)
        assertTrue(s.pendingDelete!!.inFlight)
    }

    @Test
    fun deleteOfAnAlreadyRemovedItemJustCloses() {
        val s = apply(
            open(PlanSnapshot(reasons = listOf(Reason(1, "a")))),
            PlanEvent.DeleteAsked(PlanSection.REASONS, 1), PlanEvent.DeleteConfirmed, PlanEvent.WriteFinished(PlanWriteResult.NOT_FOUND),
        )
        assertNull(s.pendingDelete)
    }

    @Test
    fun failedWriteKeepsTheEditorAndDraftForRetry() {
        val s = apply(
            open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("keep me"),
            PlanEvent.SaveRequested, PlanEvent.WriteFinished(PlanWriteResult.FAILED),
        )
        assertTrue(s.editor!!.writeFailed)
        assertFalse(s.editor!!.saving)
        assertEquals("keep me", s.editor!!.primary)
        assertNotNull("retry is possible", reduce(s, PlanEvent.SaveRequested).pendingWrite())
    }

    @Test
    fun rejectedWriteIsTreatedAsAFailure() {
        val s = apply(
            open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("x"),
            PlanEvent.SaveRequested, PlanEvent.WriteFinished(PlanWriteResult.REJECTED),
        )
        assertTrue(s.editor!!.writeFailed)
    }

    @Test
    fun addAtTheLimitShowsNoticeAndOpensNoEditorForEverySection() {
        for (section in PlanSection.values()) {
            val s = reduce(open(full(section)), PlanEvent.AddRequested(section))
            assertNull(section.name, s.editor)
            assertEquals(section, s.limitNotice)
            assertNull(reduce(s, PlanEvent.LimitNoticeDismissed).limitNotice)
        }
    }

    @Test
    fun saveNewAtTheLimitIsRefusedEvenIfTheEditorWasOpenedBefore() {
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("x"))
        s = reduce(s, PlanEvent.AccessChanged(PlanAccess.Open(full(PlanSection.REASONS))))
        s = reduce(s, PlanEvent.SaveRequested)
        assertNull(s.pendingWrite())
        assertEquals(PlanSection.REASONS, s.limitNotice)
    }

    @Test
    fun belowTheLimitAddWorks() {
        val snap = PlanSnapshot(reasons = (1L..19L).map { Reason(it, "r$it") })
        assertNotNull(reduce(open(snap), PlanEvent.AddRequested(PlanSection.REASONS)).editor)
    }

    @Test
    fun hostileDraftIsClampedButStillReportedTooLong() {
        val huge = "a".repeat(5_000_000)
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.STEPS), PlanEvent.PrimaryChanged(huge))
        assertEquals(400, s.editor!!.primary.length)
        s = reduce(s, PlanEvent.SaveRequested)
        assertEquals(FieldError.TOO_LONG, s.editor!!.primaryError)
        assertNull(s.pendingWrite())
    }

    @Test
    fun lockWipesEverythingIncludingTheDraft() {
        val secret = "SENTINEL-draft"
        val s = apply(
            open(PlanSnapshot(reasons = listOf(Reason(1, "SENTINEL-saved")))),
            PlanEvent.AddRequested(PlanSection.STEPS), PlanEvent.PrimaryChanged(secret),
            PlanEvent.AccessChanged(PlanAccess.Locked),
        )
        assertEquals(PlanAccessKind.LOCKED, s.access)
        assertNull(s.editor)
        assertNull(s.pendingDelete)
        assertTrue(s.snapshot.rows(PlanSection.REASONS).isEmpty())
        assertEquals(0, s.snapshot.count(PlanSection.STEPS))
    }

    @Test
    fun unavailableWipesAndIgnoresUiEvents() {
        var s = reduce(open(PlanSnapshot(reasons = listOf(Reason(1, "a")))), PlanEvent.AccessChanged(PlanAccess.Unavailable))
        assertEquals(PlanAccessKind.UNAVAILABLE, s.access)
        s = apply(s, PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.EditRequested(PlanSection.REASONS, 1))
        assertNull(s.editor)
        assertTrue(s.snapshot.rows(PlanSection.REASONS).isEmpty())
    }

    @Test
    fun lockResultFromAWriteWipesTheState() {
        val s = apply(
            open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("draft"),
            PlanEvent.SaveRequested, PlanEvent.WriteFinished(PlanWriteResult.LOCKED),
        )
        assertEquals(PlanAccessKind.LOCKED, s.access)
        assertNull(s.editor)
    }

    @Test
    fun lateWriteResultAfterLockIsIgnored() {
        val locked = reduce(open(), PlanEvent.AccessChanged(PlanAccess.Locked))
        assertSame(locked, reduce(locked, PlanEvent.WriteFinished(PlanWriteResult.SUCCESS)))
    }

    @Test
    fun reopeningAfterLockShowsTheStoreSnapshotWithNoStaleDraft() {
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("draft"), PlanEvent.AccessChanged(PlanAccess.Locked))
        s = reduce(s, PlanEvent.AccessChanged(PlanAccess.Open(PlanSnapshot(reasons = listOf(Reason(1, "kept"))))))
        assertNull(s.editor)
        assertEquals(1, s.snapshot.reasons.size)
    }

    @Test
    fun itemDeletedElsewhereWhileEditingIsReportedAndSaveAsNewKeepsTheDraft() {
        var s = apply(
            open(PlanSnapshot(reasons = listOf(Reason(1, "a")))),
            PlanEvent.EditRequested(PlanSection.REASONS, 1), PlanEvent.PrimaryChanged("edited"),
            PlanEvent.AccessChanged(PlanAccess.Open(PlanSnapshot())),
        )
        assertTrue(s.editor!!.itemGone)
        assertEquals("edited", s.editor!!.primary)
        s = reduce(s, PlanEvent.SaveAsNewRequested)
        val edit = s.pendingWrite() as PlanEdit.Add
        assertEquals("edited", edit.primary)
    }

    @Test
    fun updateNotFoundReportsItemGone() {
        val s = apply(
            open(PlanSnapshot(reasons = listOf(Reason(1, "a")))),
            PlanEvent.EditRequested(PlanSection.REASONS, 1), PlanEvent.PrimaryChanged("b"),
            PlanEvent.SaveRequested, PlanEvent.WriteFinished(PlanWriteResult.NOT_FOUND),
        )
        assertTrue(s.editor!!.itemGone)
        assertFalse(s.editor!!.saving)
    }

    @Test
    fun onlyOneWriteInFlightAndNoEditsWhileSaving() {
        var s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("x"), PlanEvent.SaveRequested)
        val frozen = s.editor
        s = apply(s, PlanEvent.PrimaryChanged("changed"), PlanEvent.EditorCancelled, PlanEvent.AddRequested(PlanSection.STEPS))
        assertEquals(frozen!!.primary, s.editor!!.primary)
        assertTrue(s.editor!!.saving)
    }

    @Test
    fun cancelDiscardsTheDraft() {
        val s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("x"), PlanEvent.EditorCancelled)
        assertNull(s.editor)
    }

    @Test
    fun openingAnotherEditorReplacesTheFirst() {
        val s = apply(open(), PlanEvent.AddRequested(PlanSection.REASONS), PlanEvent.PrimaryChanged("x"), PlanEvent.AddRequested(PlanSection.STEPS))
        assertEquals(PlanSection.STEPS, s.editor!!.section)
        assertEquals("", s.editor!!.primary)
    }

    @Test
    fun stateAndEditorAreNotParcelableOrSerializable() {
        for (c in listOf(PlanState::class.java, EditorState::class.java, PlanSnapshot::class.java, Reason::class.java)) {
            val names = generateSequence<Class<*>>(c) { it.superclass }.flatMap { it.interfaces.asSequence() }.map { it.name }.toList()
            assertTrue("$c implements $names", names.none { it == "java.io.Serializable" || it.endsWith("Parcelable") })
        }
    }
}

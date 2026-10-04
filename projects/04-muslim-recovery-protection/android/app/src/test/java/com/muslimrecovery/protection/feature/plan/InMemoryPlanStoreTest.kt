package com.muslimrecovery.protection.feature.plan

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class InMemoryPlanStoreTest {
    private fun open(store: InMemoryPlanStore) = (store.access.value as PlanAccess.Open).snapshot

    @Test
    fun addUpdateDeleteAndIdsAreNeverReused() = runBlocking {
        val s = InMemoryPlanStore()
        assertEquals(PlanWriteResult.SUCCESS, s.apply(PlanEdit.Add(PlanSection.REASONS, " a ", "")))
        val id = open(s).reasons.single().id
        assertEquals("a", open(s).reasons.single().text)
        assertEquals(PlanWriteResult.SUCCESS, s.apply(PlanEdit.Update(PlanSection.REASONS, id, "b", "")))
        assertEquals("b", open(s).reasons.single().text)
        assertEquals(PlanWriteResult.SUCCESS, s.apply(PlanEdit.Delete(PlanSection.REASONS, id)))
        assertTrue(open(s).reasons.isEmpty())
        s.apply(PlanEdit.Add(PlanSection.REASONS, "c", ""))
        assertTrue(open(s).reasons.single().id != id)
    }

    @Test
    fun unknownIdsAreNotFoundAndChangeNothing() = runBlocking {
        val s = InMemoryPlanStore(PlanSnapshot(steps = listOf(SupportStep(1, "x"))))
        assertEquals(PlanWriteResult.NOT_FOUND, s.apply(PlanEdit.Update(PlanSection.STEPS, 9, "y", "")))
        assertEquals(PlanWriteResult.NOT_FOUND, s.apply(PlanEdit.Delete(PlanSection.STEPS, 9)))
        assertEquals("x", open(s).steps.single().text)
    }

    @Test
    fun theStoreRechecksLimitsSoABuggyCallerCannotExceedThem() = runBlocking {
        val s = InMemoryPlanStore()
        assertEquals(PlanWriteResult.REJECTED, s.apply(PlanEdit.Add(PlanSection.STEPS, " ", "")))
        assertEquals(PlanWriteResult.REJECTED, s.apply(PlanEdit.Add(PlanSection.STEPS, "a".repeat(201), "")))
        assertEquals(PlanWriteResult.REJECTED, s.apply(PlanEdit.Add(PlanSection.IF_THEN, "a", "")))
        repeat(20) { assertEquals(PlanWriteResult.SUCCESS, s.apply(PlanEdit.Add(PlanSection.STEPS, "s$it", ""))) }
        assertEquals(PlanWriteResult.REJECTED, s.apply(PlanEdit.Add(PlanSection.STEPS, "one more", "")))
        assertEquals(20, open(s).steps.size)
        val id = open(s).steps.first().id
        assertEquals(PlanWriteResult.REJECTED, s.apply(PlanEdit.Update(PlanSection.STEPS, id, "\u0000", "")))
        assertEquals("s0", open(s).steps.first().text)
    }

    @Test
    fun lockedAndUnavailableRejectWritesAndHideContent() = runBlocking {
        val s = InMemoryPlanStore(PlanSnapshot(reasons = listOf(Reason(1, "x"))))
        s.setLocked()
        assertEquals(PlanAccess.Locked, s.access.value)
        assertEquals(PlanWriteResult.LOCKED, s.apply(PlanEdit.Add(PlanSection.REASONS, "y", "")))
        s.setUnavailable()
        assertEquals(PlanAccess.Unavailable, s.access.value)
        assertEquals(PlanWriteResult.UNAVAILABLE, s.apply(PlanEdit.Delete(PlanSection.REASONS, 1)))
        s.setOpen()
        assertEquals(1, open(s).reasons.size)
    }

    @Test
    fun initialContentSeedsIdsAfterTheLargest() = runBlocking {
        val s = InMemoryPlanStore(PlanSnapshot(reasons = listOf(Reason(41, "x"))))
        s.apply(PlanEdit.Add(PlanSection.STEPS, "n", ""))
        assertEquals(42L, open(s).steps.single().id)
    }
}

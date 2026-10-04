package com.muslimrecovery.protection.feature.plan

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanControllerTest {
    /** Wraps a store, counting calls and optionally failing, throwing or suspending. */
    private class FakeStore(val inner: InMemoryPlanStore = InMemoryPlanStore()) : PlanStore {
        var calls = 0
        var failWith: PlanWriteResult? = null
        var throwing = false
        var gate: CompletableDeferred<Unit>? = null
        override val access get() = inner.access
        override suspend fun apply(edit: PlanEdit): PlanWriteResult {
            calls++
            gate?.await()
            if (throwing) throw IllegalStateException("boom")
            failWith?.let { return it }
            return inner.apply(edit)
        }
    }

    private fun snapshot(c: PlanController): PlanSnapshot = c.state.value.snapshot

    /** Lets queued coroutines (the store collector, parked writers) run on the single runBlocking thread. */
    private suspend fun settle() = repeat(5) { yield() }

    private suspend fun withController(store: PlanStore, body: suspend CoroutineScope.(PlanController) -> Unit) = coroutineScope {
        val c = PlanController(store)
        val job = launch { c.observe() }
        settle()
        body(c)
        settle()
        job.cancel()
    }

    private suspend fun add(c: PlanController, section: PlanSection, p: String, s: String = "") {
        c.dispatch(PlanEvent.AddRequested(section))
        c.dispatch(PlanEvent.PrimaryChanged(p))
        if (s.isNotEmpty()) c.dispatch(PlanEvent.SecondaryChanged(s))
        c.submit(PlanEvent.SaveRequested)
        settle()
    }

    @Test
    fun addEditDeleteForAllThreeSectionsThroughTheStore() = runBlocking {
        withController(FakeStore()) { c ->
            assertEquals(PlanAccessKind.OPEN, c.state.value.access)
            add(c, PlanSection.REASONS, "  family ")
            add(c, PlanSection.STEPS, "walk")
            add(c, PlanSection.IF_THEN, "bored", "call a friend")
            assertEquals(listOf("family"), snapshot(c).reasons.map { it.text })
            assertEquals(listOf("walk"), snapshot(c).steps.map { it.text })
            assertEquals("call a friend", snapshot(c).ifThenPlans.single().thenAction)
            assertNull(c.state.value.editor)

            val id = snapshot(c).ifThenPlans.single().id
            c.dispatch(PlanEvent.EditRequested(PlanSection.IF_THEN, id))
            c.dispatch(PlanEvent.SecondaryChanged("go outside"))
            c.submit(PlanEvent.SaveRequested)
            settle()
            assertEquals("go outside", snapshot(c).ifThenPlans.single().thenAction)
            assertEquals("bored", snapshot(c).ifThenPlans.single().ifSituation)

            val rid = snapshot(c).reasons.single().id
            c.dispatch(PlanEvent.DeleteAsked(PlanSection.REASONS, rid))
            c.submit(PlanEvent.DeleteConfirmed)
            settle()
            assertTrue(snapshot(c).reasons.isEmpty())
            assertEquals(1, snapshot(c).steps.size)
        }
    }

    @Test
    fun invalidInputNeverReachesTheStore() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            add(c, PlanSection.REASONS, "   ")
            assertEquals(0, store.calls)
            assertNotNull(c.state.value.editor!!.primaryError)
        }
    }

    @Test
    fun eachEditIsExactlyOneStoreCall() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            add(c, PlanSection.REASONS, "a")
            assertEquals(1, store.calls)
            c.dispatch(PlanEvent.EditRequested(PlanSection.REASONS, snapshot(c).reasons.single().id))
            c.dispatch(PlanEvent.PrimaryChanged("b"))
            c.submit(PlanEvent.SaveRequested)
            settle()
            assertEquals(2, store.calls)
            c.dispatch(PlanEvent.DeleteAsked(PlanSection.REASONS, snapshot(c).reasons.single().id))
            assertEquals("asking to delete must not call the store", 2, store.calls)
            c.submit(PlanEvent.DeleteConfirmed)
            settle()
            assertEquals(3, store.calls)
        }
    }

    @Test
    fun failingStoreLeavesThePlanUnchangedAndTheEditorIntactThenRetrySucceeds() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            add(c, PlanSection.REASONS, "first")
            store.failWith = PlanWriteResult.FAILED
            add(c, PlanSection.REASONS, "second")
            assertEquals(listOf("first"), snapshot(c).reasons.map { it.text })
            val e = c.state.value.editor!!
            assertTrue(e.writeFailed)
            assertEquals("second", e.primary)
            store.failWith = null
            c.submit(PlanEvent.SaveRequested)
            settle()
            assertEquals(listOf("first", "second"), snapshot(c).reasons.map { it.text })
            assertNull(c.state.value.editor)
        }
    }

    @Test
    fun aThrowingStoreIsTreatedAsAFailureNotACrash() = runBlocking {
        val store = FakeStore().also { it.throwing = true }
        withController(store) { c ->
            add(c, PlanSection.STEPS, "x")
            assertTrue(c.state.value.editor!!.writeFailed)
            assertTrue(snapshot(c).steps.isEmpty())
        }
    }

    @Test
    fun failedDeleteKeepsTheItem() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            add(c, PlanSection.STEPS, "x")
            store.failWith = PlanWriteResult.FAILED
            c.dispatch(PlanEvent.DeleteAsked(PlanSection.STEPS, snapshot(c).steps.single().id))
            c.submit(PlanEvent.DeleteConfirmed)
            settle()
            assertEquals(1, snapshot(c).steps.size)
            assertTrue(c.state.value.pendingDelete!!.failed)
        }
    }

    @Test
    fun slowStoreAllowsOnlyOneWriteAndDoubleTapIsHarmless() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            store.gate = CompletableDeferred()
            c.dispatch(PlanEvent.AddRequested(PlanSection.REASONS))
            c.dispatch(PlanEvent.PrimaryChanged("x"))
            val first = async { c.submit(PlanEvent.SaveRequested) }
            settle()
            assertTrue(c.state.value.editor!!.saving)
            val second = async { c.submit(PlanEvent.SaveRequested) }
            settle()
            assertEquals(1, store.calls)
            store.gate!!.complete(Unit)
            first.await()
            second.await()
            settle()
            assertEquals(1, store.calls)
            assertEquals(1, snapshot(c).reasons.size)
        }
    }

    @Test
    fun lockDuringASlowWriteWipesTheStateAndNothingIsWrittenOrShown() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            store.gate = CompletableDeferred()
            c.dispatch(PlanEvent.AddRequested(PlanSection.REASONS))
            c.dispatch(PlanEvent.PrimaryChanged("SENTINEL-in-flight"))
            val write = async { c.submit(PlanEvent.SaveRequested) }
            settle()
            store.inner.setLocked()
            settle()
            assertEquals(PlanAccessKind.LOCKED, c.state.value.access)
            store.gate!!.complete(Unit)
            write.await()
            settle()
            assertEquals(PlanAccessKind.LOCKED, c.state.value.access)
            assertNull(c.state.value.editor)
            assertTrue(snapshot(c).reasons.isEmpty())
            store.inner.setOpen()
            settle()
            assertTrue("the write hit a locked store and must not have been applied", snapshot(c).reasons.isEmpty())
        }
    }

    @Test
    fun lockedStoreShowsNoContentEvenIfItHeldSome() = runBlocking {
        val store = FakeStore(InMemoryPlanStore(PlanSnapshot(reasons = listOf(Reason(1, "SENTINEL-saved")))))
        withController(store) { c ->
            assertEquals(1, snapshot(c).reasons.size)
            store.inner.setLocked()
            settle()
            assertEquals(PlanAccessKind.LOCKED, c.state.value.access)
            assertTrue(snapshot(c).reasons.isEmpty())
            assertFalse(c.state.value.toString().contains("SENTINEL"))
            store.inner.setUnavailable()
            settle()
            assertEquals(PlanAccessKind.UNAVAILABLE, c.state.value.access)
            store.inner.setOpen()
            settle()
            assertEquals("SENTINEL-saved", snapshot(c).reasons.single().text)
        }
    }

    @Test
    fun itemDeletedElsewhereWhileEditingOffersSaveAsNew() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            add(c, PlanSection.REASONS, "orig")
            val id = snapshot(c).reasons.single().id
            c.dispatch(PlanEvent.EditRequested(PlanSection.REASONS, id))
            c.dispatch(PlanEvent.PrimaryChanged("my edit"))
            store.inner.apply(PlanEdit.Delete(PlanSection.REASONS, id)) // "elsewhere"
            settle()
            assertTrue(c.state.value.editor!!.itemGone)
            c.submit(PlanEvent.SaveAsNewRequested)
            settle()
            assertEquals(listOf("my edit"), snapshot(c).reasons.map { it.text })
            assertNull(c.state.value.editor)
        }
    }

    @Test
    fun maxItemsReachedGivesAMessageNotASilentDrop() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            repeat(20) { add(c, PlanSection.STEPS, "s$it") }
            assertEquals(20, snapshot(c).steps.size)
            c.dispatch(PlanEvent.AddRequested(PlanSection.STEPS))
            assertEquals(PlanSection.STEPS, c.state.value.limitNotice)
            assertNull(c.state.value.editor)
            assertEquals(20, store.calls)
        }
    }

    @Test
    fun cancellingAWriteDoesNotSwallowTheCancellation() = runBlocking {
        val store = FakeStore()
        withController(store) { c ->
            store.gate = CompletableDeferred()
            c.dispatch(PlanEvent.AddRequested(PlanSection.REASONS))
            c.dispatch(PlanEvent.PrimaryChanged("x"))
            val job = launch { c.submit(PlanEvent.SaveRequested) }
            settle()
            job.cancelAndJoin()
            assertTrue(job.isCancelled)
        }
    }
}

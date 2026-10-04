package com.muslimrecovery.protection.feature.onboarding

import com.muslimrecovery.protection.core.design.locale.AppLanguageController
import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class OnboardingStateHolderTest {
    private class FakeLanguage(var language: SupportedLanguage = SupportedLanguage.SYSTEM) : AppLanguageController {
        val calls = mutableListOf<SupportedLanguage>()

        override fun current(): SupportedLanguage = language

        override fun set(language: SupportedLanguage) {
            calls += language
            this.language = language
        }
    }

    /** Counts calls and can suspend until released, to hold a commit in flight. */
    private class GatedStore(private val gate: CompletableDeferred<CommitResult>) : OnboardingStore {
        val calls = AtomicInteger(0)
        val received = mutableListOf<OnboardingCommit>()

        override suspend fun commitOnboarding(commit: OnboardingCommit): CommitResult {
            calls.incrementAndGet()
            received += commit
            return gate.await()
        }
    }

    private class ThrowingStore : OnboardingStore {
        override suspend fun commitOnboarding(commit: OnboardingCommit): CommitResult = throw IllegalStateException("boom with secret text")
    }

    private fun scope(): CoroutineScope = CoroutineScope(Job() + Dispatchers.Unconfined)

    private fun holder(
        store: OnboardingStore,
        language: FakeLanguage = FakeLanguage(),
        faith: Boolean = false,
    ) = OnboardingStateHolder(store, language, scope(), faith)

    private fun OnboardingStateHolder.toFinish(reason: String? = null) {
        onEvent(OnboardingEvent.Next)
        onEvent(OnboardingEvent.Next)
        onEvent(OnboardingEvent.Next)
        if (reason != null) onEvent(OnboardingEvent.ReasonInputChanged(reason))
        onEvent(OnboardingEvent.Next)
    }

    @Test
    fun fullFlowCommitsOnceWithTheFinalChoiceAndHandsOffOnce() {
        val store = InMemoryOnboardingStore()
        val h = holder(store, faith = true)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.SetMode(OnboardingMode.RECOVERY_WITH_FAITH))
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.ReasonInputChanged("my family"))
        h.onEvent(OnboardingEvent.AddReason)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.SetStartPlan(true))
        assertNull(store.snapshot())
        h.submit()
        assertEquals(CommitStatus.Committed, h.state.value.commit)
        assertEquals(OnboardingCommit(OnboardingMode.RECOVERY_WITH_FAITH, listOf("my family")), store.snapshot())
        assertEquals(OnboardingCompletion(startPlan = true), h.takeCompletion())
        assertNull("completion is delivered once", h.takeCompletion())
    }

    @Test
    fun nothingIsWrittenBeforeFinish() {
        val store = InMemoryOnboardingStore()
        val h = holder(store)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.ReasonInputChanged("x"))
        h.onEvent(OnboardingEvent.AddReason)
        h.submit() // not at Finish: ignored
        assertNull(store.snapshot())
        assertEquals(CommitStatus.Idle, h.state.value.commit)
        assertNull(h.takeCompletion())
    }

    @Test
    fun failureLeavesNoStateAndNoCompletionThenRetrySucceeds() {
        val store = InMemoryOnboardingStore()
        val h = holder(store)
        h.toFinish("reason")
        store.failNextCommit(CommitFailure.LOCKED)
        h.submit()
        assertEquals(CommitStatus.Failed(CommitFailure.LOCKED), h.state.value.commit)
        assertNull("no partial data and no completion after a failure", store.snapshot())
        assertNull(h.takeCompletion())
        assertEquals(listOf("reason"), h.state.value.reasons)
        h.submit()
        assertEquals(CommitStatus.Committed, h.state.value.commit)
        assertEquals(listOf("reason"), store.snapshot()?.reasons)
        assertNotNull(h.takeCompletion())
    }

    @Test
    fun aThrowingStoreBecomesAGenericFailureWithoutTheMessage() {
        val h = holder(ThrowingStore())
        h.toFinish()
        h.submit()
        assertEquals(CommitStatus.Failed(CommitFailure.FAILED), h.state.value.commit)
        assertTrue(!h.state.value.toString().contains("secret"))
        assertNull(h.takeCompletion())
    }

    @Test
    fun doubleSubmitWhileInFlightCommitsOnce() {
        val gate = CompletableDeferred<CommitResult>()
        val store = GatedStore(gate)
        val h = holder(store)
        h.toFinish("r")
        h.submit()
        h.submit()
        h.submit()
        assertEquals(CommitStatus.Submitting, h.state.value.commit)
        assertEquals(1, store.calls.get())
        h.onEvent(OnboardingEvent.Back) // frozen while saving
        assertEquals(OnboardingStep.FINISH, h.state.value.step)
        gate.complete(CommitResult.Committed)
        assertEquals(CommitStatus.Committed, h.state.value.commit)
        h.submit()
        assertEquals("a tap after success must not commit again", 1, store.calls.get())
        assertEquals(listOf(OnboardingCommit(OnboardingMode.RECOVERY, listOf("r"))), store.received)
    }

    @Test
    fun controllerCommitsAtMostOnceSuccessfully() = runBlocking {
        val store = InMemoryOnboardingStore()
        val controller = OnboardingController(store)
        val first = OnboardingCommit(OnboardingMode.RECOVERY, listOf("a"))
        assertEquals(CommitResult.Committed, controller.commit(first))
        assertEquals(CommitResult.Committed, controller.commit(OnboardingCommit(OnboardingMode.RECOVERY, listOf("b"))))
        assertEquals(first, store.snapshot())
    }

    @Test
    fun controllerRetriesAfterFailureWithoutPartialData() = runBlocking {
        val store = InMemoryOnboardingStore()
        val controller = OnboardingController(store)
        store.failNextCommit(CommitFailure.UNAVAILABLE)
        val commit = OnboardingCommit(OnboardingMode.RECOVERY, listOf("a"))
        assertEquals(CommitResult.Failure(CommitFailure.UNAVAILABLE), controller.commit(commit))
        assertNull(store.snapshot())
        assertEquals(CommitResult.Committed, controller.commit(commit))
        assertEquals(commit, store.snapshot())
    }

    @Test
    fun languageChangeCallsThePlatformOnceAndKeepsTheDraft() {
        val language = FakeLanguage(SupportedLanguage.ENGLISH)
        val h = holder(InMemoryOnboardingStore(), language)
        assertEquals(SupportedLanguage.ENGLISH, h.state.value.language)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.Next)
        h.onEvent(OnboardingEvent.ReasonInputChanged("draft text"))
        h.onEvent(OnboardingEvent.Back)
        h.onEvent(OnboardingEvent.Back)
        h.onEvent(OnboardingEvent.SetLanguage(SupportedLanguage.ARABIC))
        h.onEvent(OnboardingEvent.SetLanguage(SupportedLanguage.ARABIC)) // same choice again: no second platform call
        assertEquals(listOf(SupportedLanguage.ARABIC), language.calls)
        // The host recreates the screen; the holder (ViewModel) is the same object, so step and draft are intact.
        assertEquals(OnboardingStep.LANGUAGE, h.state.value.step)
        assertEquals("draft text", h.state.value.reasonInput)
        assertEquals(SupportedLanguage.ARABIC, h.state.value.language)
    }

    @Test
    fun languageChangeIsNotForwardedWhileSaving() {
        val gate = CompletableDeferred<CommitResult>()
        val language = FakeLanguage()
        val h = holder(GatedStore(gate), language)
        h.toFinish()
        h.submit()
        h.onEvent(OnboardingEvent.SetLanguage(SupportedLanguage.GERMAN))
        assertTrue(language.calls.isEmpty())
    }

    @Test
    fun theHostCannotInjectInternalCommitEvents() {
        val store = InMemoryOnboardingStore()
        val h = holder(store)
        h.toFinish()
        h.onEvent(OnboardingEvent.Submit)
        h.onEvent(OnboardingEvent.CommitSucceeded)
        assertEquals(CommitStatus.Idle, h.state.value.commit)
        assertNull(h.takeCompletion())
        assertNull(store.snapshot())
    }

    @Test
    fun faithOptionFlagComesFromTheHost() {
        assertTrue(!holder(InMemoryOnboardingStore()).state.value.faithAvailable)
        assertTrue(holder(InMemoryOnboardingStore(), faith = true).state.value.faithAvailable)
    }
}

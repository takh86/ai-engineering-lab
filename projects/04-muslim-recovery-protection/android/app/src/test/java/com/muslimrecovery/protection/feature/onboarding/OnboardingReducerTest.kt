package com.muslimrecovery.protection.feature.onboarding

import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingReducerTest {
    private fun run(start: OnboardingState, vararg events: OnboardingEvent): OnboardingState =
        events.fold(start) { s, e -> reduce(s, e) }

    private fun at(step: OnboardingStep, faith: Boolean = false) = OnboardingState(step = step, faithAvailable = faith)

    @Test
    fun startsAtWelcomeWithRecoveryAsDefaultAndNothingChosen() {
        val s = OnboardingState()
        assertEquals(OnboardingStep.WELCOME, s.step)
        assertEquals(OnboardingMode.RECOVERY, s.mode)
        assertTrue(s.reasons.isEmpty())
        assertEquals(CommitStatus.Idle, s.commit)
    }

    @Test
    fun forwardVisitsEveryStepInOrderAndStopsAtFinish() {
        var s = OnboardingState()
        val seen = mutableListOf(s.step)
        repeat(6) {
            s = reduce(s, OnboardingEvent.Next)
            if (seen.last() != s.step) seen += s.step
        }
        assertEquals(OnboardingStep.entries.toList(), seen)
        assertEquals(OnboardingStep.FINISH, s.step)
    }

    @Test
    fun backWorksOnEveryStepExceptTheFirstAndKeepsTheChoices() {
        var s = run(
            OnboardingState(faithAvailable = true),
            OnboardingEvent.Next,
            OnboardingEvent.SetLanguage(SupportedLanguage.GERMAN),
            OnboardingEvent.Next,
            OnboardingEvent.SetMode(OnboardingMode.RECOVERY_WITH_FAITH),
            OnboardingEvent.Next,
            OnboardingEvent.ReasonInputChanged("  my reason  "),
            OnboardingEvent.Next,
        )
        assertEquals(OnboardingStep.FINISH, s.step)
        for (expected in listOf(OnboardingStep.REASONS, OnboardingStep.MODE, OnboardingStep.LANGUAGE, OnboardingStep.WELCOME)) {
            s = reduce(s, OnboardingEvent.Back)
            assertEquals(expected, s.step)
        }
        assertEquals(OnboardingStep.WELCOME, reduce(s, OnboardingEvent.Back).step)
        assertEquals(SupportedLanguage.GERMAN, s.language)
        assertEquals(OnboardingMode.RECOVERY_WITH_FAITH, s.mode)
        assertEquals(listOf("my reason"), s.reasons)
    }

    @Test
    fun reasonsAreSkippableAndNothingElseIsRequired() {
        val s = run(at(OnboardingStep.REASONS), OnboardingEvent.Next)
        assertEquals(OnboardingStep.FINISH, s.step)
        assertTrue(s.reasons.isEmpty())
        assertTrue(canSubmit(s))
    }

    @Test
    fun faithModeIsRejectedWhileFaithContentIsUnavailable() {
        val s = reduce(at(OnboardingStep.MODE, faith = false), OnboardingEvent.SetMode(OnboardingMode.RECOVERY_WITH_FAITH))
        assertEquals(OnboardingMode.RECOVERY, s.mode)
        val allowed = reduce(at(OnboardingStep.MODE, faith = true), OnboardingEvent.SetMode(OnboardingMode.RECOVERY_WITH_FAITH))
        assertEquals(OnboardingMode.RECOVERY_WITH_FAITH, allowed.mode)
    }

    @Test
    fun blankReasonIsTrimmedAndIgnored() {
        val s = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged(" \t\n "), OnboardingEvent.AddReason)
        assertTrue(s.reasons.isEmpty())
        assertEquals("", s.reasonInput)
        assertNull(s.reasonError)
    }

    @Test
    fun reasonIsTrimmedAndAddedAndInputCleared() {
        val s = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged("  to be present  "), OnboardingEvent.AddReason)
        assertEquals(listOf("to be present"), s.reasons)
        assertEquals("", s.reasonInput)
    }

    @Test
    fun reasonOfExactlyTheLimitIsAcceptedAndOneMoreIsRejectedWithTheTextKept() {
        val ok = "a".repeat(OnboardingLimits.MAX_REASON_LENGTH)
        val accepted = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged(ok), OnboardingEvent.AddReason)
        assertEquals(1, accepted.reasons.size)
        val tooLong = ok + "a"
        val rejected = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged(tooLong))
        assertEquals(ReasonError.TOO_LONG, rejected.reasonError)
        val added = reduce(rejected, OnboardingEvent.AddReason)
        assertTrue(added.reasons.isEmpty())
        assertEquals(tooLong, added.reasonInput)
        assertEquals(ReasonError.TOO_LONG, added.reasonError)
        // fixing the text clears the error
        assertNull(reduce(added, OnboardingEvent.ReasonInputChanged("short")).reasonError)
    }

    @Test
    fun lengthCountsCharactersNotUtf16Units() {
        // 500 supplementary-plane code points are 1000 UTF-16 units but still within the limit
        val emoji = "😀".repeat(OnboardingLimits.MAX_REASON_LENGTH)
        val s = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged(emoji), OnboardingEvent.AddReason)
        assertEquals(1, s.reasons.size)
    }

    @Test
    fun atMostTenReasons() {
        var s = at(OnboardingStep.REASONS)
        repeat(OnboardingLimits.MAX_REASONS) { i ->
            s = run(s, OnboardingEvent.ReasonInputChanged("reason $i"), OnboardingEvent.AddReason)
        }
        assertEquals(OnboardingLimits.MAX_REASONS, s.reasons.size)
        val over = run(s, OnboardingEvent.ReasonInputChanged("one more"), OnboardingEvent.AddReason)
        assertEquals(OnboardingLimits.MAX_REASONS, over.reasons.size)
        assertEquals(ReasonError.TOO_MANY, over.reasonError)
        assertEquals("one more", over.reasonInput)
    }

    @Test
    fun nextWithPendingTextAddsItInsteadOfLosingIt() {
        val s = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged("typed, not added"), OnboardingEvent.Next)
        assertEquals(OnboardingStep.FINISH, s.step)
        assertEquals(listOf("typed, not added"), s.reasons)
    }

    @Test
    fun nextWithUnacceptablePendingTextStaysAndExplains() {
        val s = run(
            at(OnboardingStep.REASONS),
            OnboardingEvent.ReasonInputChanged("a".repeat(OnboardingLimits.MAX_REASON_LENGTH + 1)),
            OnboardingEvent.Next,
        )
        assertEquals(OnboardingStep.REASONS, s.step)
        assertEquals(ReasonError.TOO_LONG, s.reasonError)
    }

    @Test
    fun removeReasonByIndexAndIgnoreBadIndex() {
        val s = run(
            at(OnboardingStep.REASONS),
            OnboardingEvent.ReasonInputChanged("one"), OnboardingEvent.AddReason,
            OnboardingEvent.ReasonInputChanged("two"), OnboardingEvent.AddReason,
            OnboardingEvent.RemoveReason(5), OnboardingEvent.RemoveReason(-1),
        )
        assertEquals(listOf("one", "two"), s.reasons)
        assertEquals(listOf("two"), reduce(s, OnboardingEvent.RemoveReason(0)).reasons)
    }

    @Test
    fun submitIsOnlyPossibleAtFinishAndOnlyOnce() {
        assertFalse(canSubmit(at(OnboardingStep.REASONS)))
        assertEquals(CommitStatus.Idle, reduce(at(OnboardingStep.REASONS), OnboardingEvent.Submit).commit)
        val submitting = reduce(at(OnboardingStep.FINISH), OnboardingEvent.Submit)
        assertEquals(CommitStatus.Submitting, submitting.commit)
        assertFalse(canSubmit(submitting))
        assertEquals(submitting, reduce(submitting, OnboardingEvent.Submit))
    }

    @Test
    fun draftIsFrozenWhileSavingAndAfterCompletion() {
        val submitting = reduce(at(OnboardingStep.FINISH), OnboardingEvent.Submit)
        for (e in listOf(
            OnboardingEvent.Back,
            OnboardingEvent.Next,
            OnboardingEvent.SetMode(OnboardingMode.RECOVERY),
            OnboardingEvent.SetLanguage(SupportedLanguage.ARABIC),
            OnboardingEvent.ReasonInputChanged("x"),
            OnboardingEvent.SetStartPlan(true),
        )) {
            assertEquals(submitting, reduce(submitting, e))
        }
        assertFalse(canGoBack(submitting))
        val done = reduce(submitting, OnboardingEvent.CommitSucceeded)
        assertEquals(CommitStatus.Committed, done.commit)
        assertEquals(done, reduce(done, OnboardingEvent.Back))
        assertEquals(done, reduce(done, OnboardingEvent.CommitFailed(CommitFailure.FAILED)))
        assertEquals(done, reduce(done, OnboardingEvent.Submit))
    }

    @Test
    fun commitOutcomesAreIgnoredWhenNothingIsInFlight() {
        val s = at(OnboardingStep.FINISH)
        assertEquals(s, reduce(s, OnboardingEvent.CommitSucceeded))
        assertEquals(s, reduce(s, OnboardingEvent.CommitFailed(CommitFailure.LOCKED)))
    }

    @Test
    fun failureIsRetryableKeepsTheDraftAndNeverCompletes() {
        val s0 = run(
            at(OnboardingStep.REASONS),
            OnboardingEvent.ReasonInputChanged("keep me"), OnboardingEvent.Next, OnboardingEvent.Submit,
            OnboardingEvent.CommitFailed(CommitFailure.UNAVAILABLE),
        )
        assertEquals(CommitStatus.Failed(CommitFailure.UNAVAILABLE), s0.commit)
        assertEquals(listOf("keep me"), s0.reasons)
        assertEquals(OnboardingStep.FINISH, s0.step)
        assertTrue(canSubmit(s0))
        assertTrue(canGoBack(s0))
        assertEquals(CommitStatus.Submitting, reduce(s0, OnboardingEvent.Submit).commit)
        // going back clears the failure message
        assertEquals(CommitStatus.Idle, reduce(s0, OnboardingEvent.Back).commit)
    }

    @Test
    fun payloadIsTheFinalModeAndReasonsOnly() {
        val s = run(
            OnboardingState(faithAvailable = true),
            OnboardingEvent.SetMode(OnboardingMode.RECOVERY_WITH_FAITH),
            OnboardingEvent.ReasonInputChanged("r1"), OnboardingEvent.AddReason,
            OnboardingEvent.SetStartPlan(true),
        )
        assertEquals(OnboardingCommit(OnboardingMode.RECOVERY_WITH_FAITH, listOf("r1")), commitPayload(s))
    }

    @Test
    fun noPrivateTextInToString() {
        val secret = "very private reason"
        val s = run(at(OnboardingStep.REASONS), OnboardingEvent.ReasonInputChanged(secret))
        assertFalse(s.toString().contains(secret))
        assertFalse(OnboardingEvent.ReasonInputChanged(secret).toString().contains(secret))
        val s2 = reduce(s, OnboardingEvent.AddReason)
        assertFalse(s2.toString().contains(secret))
        assertFalse(commitPayload(s2).toString().contains(secret))
    }

    @Test
    fun startPlanFlagIsAChoiceNotPartOfCommit() {
        val s = reduce(at(OnboardingStep.FINISH), OnboardingEvent.SetStartPlan(true))
        assertTrue(s.startPlan)
        assertEquals(OnboardingCommit(OnboardingMode.RECOVERY, emptyList()), commitPayload(s))
    }
}

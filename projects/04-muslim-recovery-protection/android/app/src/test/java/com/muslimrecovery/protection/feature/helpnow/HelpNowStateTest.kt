package com.muslimrecovery.protection.feature.helpnow

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.reflect.KClass

class HelpNowStateTest {
    private val t0 = 10_000L

    private fun inStep(needs: Set<HelpNeed> = emptySet(), now: Long = t0): HelpNowState {
        var s = HelpNowState()
        for (n in needs) s = reduce(s, HelpNowEvent.ToggleNeed(n))
        return reduce(s, HelpNowEvent.ConfirmNeeds(now))
    }

    @Test
    fun startsInNeedWithNothingSelectedAndTheDefaultDuration() {
        val s = HelpNowState()
        assertEquals(HelpNowPhase.Need, s.phase)
        assertTrue(s.needs.isEmpty())
        assertEquals(90, s.durationSeconds)
        assertEquals(null, s.step)
    }

    @Test
    fun needsToggleOnAndOff() {
        var s = reduce(HelpNowState(), HelpNowEvent.ToggleNeed(HelpNeed.Calm))
        s = reduce(s, HelpNowEvent.ToggleNeed(HelpNeed.Rest))
        assertEquals(setOf(HelpNeed.Calm, HelpNeed.Rest), s.needs)
        s = reduce(s, HelpNowEvent.ToggleNeed(HelpNeed.Calm))
        assertEquals(setOf(HelpNeed.Rest), s.needs)
    }

    @Test
    fun confirmingStartsAStepWithAnAbsoluteDeadline() {
        val s = inStep(setOf(HelpNeed.Movement))
        assertEquals(HelpNowPhase.Step, s.phase)
        assertEquals(HelpStep.ShortWalk, s.step)
        assertEquals(t0 + 90_000L, s.deadlineMillis)
        assertEquals(listOf(HelpStep.ShortWalk), s.triedSteps)
    }

    @Test
    fun skippingClearsTheSelectionAndSuggestsTheDefaultStep() {
        var s = reduce(HelpNowState(), HelpNowEvent.ToggleNeed(HelpNeed.Movement))
        s = reduce(s, HelpNowEvent.SkipNeeds(t0))
        assertEquals(HelpNowPhase.Step, s.phase)
        assertTrue(s.needs.isEmpty())
        assertEquals(HelpStep.SlowBreathing, s.step)
    }

    @Test
    fun fullHappyPathEndsInDone() {
        var s = inStep()
        s = reduce(s, HelpNowEvent.FinishStep)
        assertEquals(HelpNowPhase.Reflect, s.phase)
        s = reduce(s, HelpNowEvent.ContinueFromReflect)
        assertEquals(HelpNowPhase.Reassess, s.phase)
        s = reduce(s, HelpNowEvent.FeelingLighter)
        assertEquals(HelpNowPhase.Done, s.phase)
    }

    @Test
    fun changingTheDurationRestartsTheDeadlineFromNow() {
        val s = reduce(inStep(), HelpNowEvent.SetDuration(120, t0 + 5_000L))
        assertEquals(120, s.durationSeconds)
        assertEquals(t0 + 5_000L + 120_000L, s.deadlineMillis)
    }

    @Test
    fun onlyTheThreeContractDurationsAreAccepted() {
        val s = inStep()
        for (bad in listOf(0, 30, 61, 600, -90)) {
            assertSame(s, reduce(s, HelpNowEvent.SetDuration(bad, t0 + 1)))
        }
        for (good in listOf(60, 90, 120)) {
            assertEquals(good, reduce(s, HelpNowEvent.SetDuration(good, t0)).durationSeconds)
        }
    }

    @Test
    fun stillStrongOffersAnotherStepAndKeepsThePhase() {
        var s = reduce(reduce(reduce(inStep(), HelpNowEvent.FinishStep), HelpNowEvent.ContinueFromReflect), HelpNowEvent.StillStrong)
        assertEquals(HelpNowPhase.Reassess, s.phase)
        assertTrue(s.stillStrong)
        val first = s.step
        s = reduce(s, HelpNowEvent.AnotherStep(t0 + 200_000L))
        assertEquals(HelpNowPhase.Step, s.phase)
        assertFalse(s.stillStrong)
        assertTrue(s.step != first)
        assertEquals(t0 + 200_000L + 90_000L, s.deadlineMillis)
        assertEquals(2, s.triedSteps.size)
    }

    @Test
    fun anotherStepBeforeStillStrongIsIgnored() {
        val s = reduce(reduce(inStep(), HelpNowEvent.FinishStep), HelpNowEvent.ContinueFromReflect)
        assertSame(s, reduce(s, HelpNowEvent.AnotherStep(t0)))
    }

    @Test
    fun everyEventOutsideItsPhaseIsIgnoredSoRapidTapsAreHarmless() {
        val events = listOf(
            HelpNowEvent.ToggleNeed(HelpNeed.Calm), HelpNowEvent.ConfirmNeeds(1), HelpNowEvent.SkipNeeds(1),
            HelpNowEvent.SetDuration(60, 1), HelpNowEvent.FinishStep, HelpNowEvent.ContinueFromReflect,
            HelpNowEvent.FeelingLighter, HelpNowEvent.StillStrong, HelpNowEvent.AnotherStep(1),
        )
        val validIn = mapOf(
            HelpNowPhase.Need to setOf(HelpNowEvent.ToggleNeed::class, HelpNowEvent.ConfirmNeeds::class, HelpNowEvent.SkipNeeds::class),
            HelpNowPhase.Step to setOf(HelpNowEvent.SetDuration::class, HelpNowEvent.FinishStep::class),
            HelpNowPhase.Reflect to setOf(HelpNowEvent.ContinueFromReflect::class),
            HelpNowPhase.Reassess to setOf(HelpNowEvent.FeelingLighter::class, HelpNowEvent.StillStrong::class),
            HelpNowPhase.Done to emptySet<KClass<out HelpNowEvent>>(),
        )
        val states = mapOf(
            HelpNowPhase.Need to HelpNowState(),
            HelpNowPhase.Step to inStep(),
            HelpNowPhase.Reflect to reduce(inStep(), HelpNowEvent.FinishStep),
            HelpNowPhase.Reassess to reduce(reduce(inStep(), HelpNowEvent.FinishStep), HelpNowEvent.ContinueFromReflect),
            HelpNowPhase.Done to reduce(
                reduce(reduce(inStep(), HelpNowEvent.FinishStep), HelpNowEvent.ContinueFromReflect), HelpNowEvent.FeelingLighter,
            ),
        )
        for ((phase, state) in states) {
            assertEquals(phase, state.phase)
            for (event in events) {
                if (event::class !in validIn.getValue(phase)) {
                    assertSame("$phase must ignore ${event::class.simpleName}", state, reduce(state, event))
                }
            }
        }
    }

    @Test
    fun doneIsTerminal() {
        val done = HelpNowState(phase = HelpNowPhase.Done)
        assertSame(done, reduce(done, HelpNowEvent.ConfirmNeeds(1)))
    }

    @Test
    fun cyclingThroughEveryStepSaysSoAndRestartsTheTriedList() {
        var s = inStep()
        repeat(HelpStep.values().size - 1) {
            s = reduce(s, HelpNowEvent.FinishStep)
            s = reduce(s, HelpNowEvent.ContinueFromReflect)
            s = reduce(s, HelpNowEvent.StillStrong)
            s = reduce(s, HelpNowEvent.AnotherStep(t0))
            assertFalse(s.allStepsTried)
        }
        assertEquals(HelpStep.values().size, s.triedSteps.size)
        s = reduce(reduce(reduce(reduce(s, HelpNowEvent.FinishStep), HelpNowEvent.ContinueFromReflect), HelpNowEvent.StillStrong), HelpNowEvent.AnotherStep(t0))
        assertTrue(s.allStepsTried)
        assertEquals(1, s.triedSteps.size)
    }

    @Test
    fun stateHoldsNoPersonalTextTypes() {
        // The state's fields are enums, numbers and booleans only (no String), so personal text cannot enter it.
        val stringFields = HelpNowState::class.java.declaredFields.filter { it.type == String::class.java }
        assertEquals(emptyList<String>(), stringFields.map { it.name })
    }
}

package com.muslimrecovery.protection.feature.helpnow

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SuggestionPolicyTest {
    @Test
    fun noNeedUsesTheDefaultOrder() {
        assertEquals(HelpStep.values().toList(), SuggestionPolicy.ranking(emptySet()))
        assertEquals(Suggestion(HelpStep.SlowBreathing, false), SuggestionPolicy.next(emptySet(), emptyList()))
    }

    @Test
    fun theRankingAlwaysContainsEveryStepExactlyOnce() {
        for (mask in 0 until (1 shl HelpNeed.values().size)) {
            val needs = HelpNeed.values().filterIndexed { i, _ -> mask and (1 shl i) != 0 }.toSet()
            val ranking = SuggestionPolicy.ranking(needs)
            assertEquals("mask $mask", HelpStep.values().toSet(), ranking.toSet())
            assertEquals("mask $mask", ranking.size, ranking.distinct().size)
        }
    }

    @Test
    fun isDeterministicAndIgnoresSelectionOrder() {
        val a = SuggestionPolicy.ranking(linkedSetOf(HelpNeed.Rest, HelpNeed.Movement))
        val b = SuggestionPolicy.ranking(linkedSetOf(HelpNeed.Movement, HelpNeed.Rest))
        assertEquals(a, b)
        repeat(20) { assertEquals(a, SuggestionPolicy.ranking(setOf(HelpNeed.Movement, HelpNeed.Rest))) }
    }

    @Test
    fun needsInfluenceTheFirstSuggestion() {
        assertEquals(HelpStep.ShortWalk, SuggestionPolicy.next(setOf(HelpNeed.Movement), emptyList()).step)
        assertEquals(HelpStep.ChangePlace, SuggestionPolicy.next(setOf(HelpNeed.Connection), emptyList()).step)
    }

    @Test
    fun triedStepsAreSkippedUntilAllAreTriedThenItCycles() {
        val tried = mutableListOf<HelpStep>()
        repeat(HelpStep.values().size) {
            val s = SuggestionPolicy.next(emptySet(), tried)
            assertFalse(s.cycled)
            assertFalse(s.step in tried)
            tried += s.step
        }
        val cycled = SuggestionPolicy.next(emptySet(), tried)
        assertTrue(cycled.cycled)
        assertEquals(HelpStep.SlowBreathing, cycled.step)
    }
}

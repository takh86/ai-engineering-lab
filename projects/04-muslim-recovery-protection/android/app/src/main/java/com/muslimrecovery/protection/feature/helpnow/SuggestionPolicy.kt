package com.muslimrecovery.protection.feature.helpnow

/** A suggested step. [cycled] is true when every step was already tried and the policy started over. */
data class Suggestion(val step: HelpStep, val cycled: Boolean)

/**
 * Deterministic step ordering (contract section 5: no randomness). The ranking is the concatenation of the
 * per-need preferences, in [HelpNeed] declaration order, then every remaining step in [HelpStep] order. No need
 * selected means the default order. The first step not yet tried is suggested; when all were tried the ranking
 * starts over and [Suggestion.cycled] is set so the screen can say so calmly.
 */
object SuggestionPolicy {
    private val preferences: Map<HelpNeed, List<HelpStep>> = mapOf(
        HelpNeed.Calm to listOf(HelpStep.SlowBreathing, HelpStep.NameFiveThings),
        HelpNeed.Distraction to listOf(HelpStep.NameFiveThings, HelpStep.ChangePlace),
        HelpNeed.Movement to listOf(HelpStep.ShortWalk, HelpStep.WaterAndStretch),
        HelpNeed.Connection to listOf(HelpStep.ChangePlace, HelpStep.WaterAndStretch),
        HelpNeed.Rest to listOf(HelpStep.SlowBreathing, HelpStep.WaterAndStretch),
    )

    fun ranking(needs: Set<HelpNeed>): List<HelpStep> {
        val preferred = HelpNeed.values().filter { it in needs }.flatMap { preferences.getValue(it) }
        return (preferred + HelpStep.values().toList()).distinct()
    }

    fun next(needs: Set<HelpNeed>, tried: List<HelpStep>): Suggestion {
        val ranking = ranking(needs)
        val untried = ranking.firstOrNull { it !in tried }
        return if (untried != null) Suggestion(untried, cycled = false) else Suggestion(ranking.first(), cycled = true)
    }
}

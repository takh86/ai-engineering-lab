package com.muslimrecovery.protection.feature.helpnow

/**
 * Pure, in-memory session state. It holds no personal text (the personal tier lives outside this state), nothing
 * Android, and nothing that is persisted. [deadlineMillis] is an ABSOLUTE deadline on the injected monotonic
 * clock, never a tick counter, so backgrounding, rotation and recreation cannot make the timer drift.
 */
data class HelpNowState(
    val phase: HelpNowPhase = HelpNowPhase.Need,
    val needs: Set<HelpNeed> = emptySet(),
    val durationSeconds: Int = HelpNowDurations.DEFAULT_SECONDS,
    val step: HelpStep? = null,
    val deadlineMillis: Long = 0L,
    val triedSteps: List<HelpStep> = emptyList(),
    /** True when the policy cycled through all steps (the screen says so calmly). */
    val allStepsTried: Boolean = false,
    /** Reassess sub-state: "still strong" was chosen, which offers another step and the help slots. */
    val stillStrong: Boolean = false,
)

/** Events carry the monotonic time only where a deadline is set. */
sealed interface HelpNowEvent {
    data class ToggleNeed(val need: HelpNeed) : HelpNowEvent
    data class ConfirmNeeds(val nowMillis: Long) : HelpNowEvent
    data class SkipNeeds(val nowMillis: Long) : HelpNowEvent
    data class SetDuration(val seconds: Int, val nowMillis: Long) : HelpNowEvent
    data object FinishStep : HelpNowEvent
    data object ContinueFromReflect : HelpNowEvent
    data object FeelingLighter : HelpNowEvent
    data object StillStrong : HelpNowEvent
    data class AnotherStep(val nowMillis: Long) : HelpNowEvent
}

/**
 * The state machine. Total and pure: an event that is not valid in the current phase returns the state unchanged
 * (rapid or stray taps are ignored). Leaving Help Now is NOT an event: the route can always close without
 * confirmation, from any phase.
 */
fun reduce(state: HelpNowState, event: HelpNowEvent): HelpNowState = when (state.phase) {
    HelpNowPhase.Need -> when (event) {
        is HelpNowEvent.ToggleNeed -> state.copy(
            needs = if (event.need in state.needs) state.needs - event.need else state.needs + event.need,
        )
        is HelpNowEvent.ConfirmNeeds -> startStep(state, event.nowMillis)
        is HelpNowEvent.SkipNeeds -> startStep(state.copy(needs = emptySet()), event.nowMillis)
        else -> state
    }
    HelpNowPhase.Step -> when (event) {
        is HelpNowEvent.SetDuration ->
            if (HelpNowDurations.isAllowed(event.seconds)) {
                state.copy(durationSeconds = event.seconds, deadlineMillis = deadline(event.nowMillis, event.seconds))
            } else {
                state
            }
        HelpNowEvent.FinishStep -> state.copy(phase = HelpNowPhase.Reflect)
        else -> state
    }
    HelpNowPhase.Reflect -> when (event) {
        HelpNowEvent.ContinueFromReflect -> state.copy(phase = HelpNowPhase.Reassess)
        else -> state
    }
    HelpNowPhase.Reassess -> when (event) {
        HelpNowEvent.FeelingLighter -> state.copy(phase = HelpNowPhase.Done)
        HelpNowEvent.StillStrong -> state.copy(stillStrong = true)
        is HelpNowEvent.AnotherStep -> if (state.stillStrong) startStep(state, event.nowMillis) else state
        else -> state
    }
    HelpNowPhase.Done -> state
}

private fun deadline(nowMillis: Long, seconds: Int): Long = nowMillis + seconds * 1000L

private fun startStep(state: HelpNowState, nowMillis: Long): HelpNowState {
    // When the policy cycles, the tried list restarts with the new suggestion.
    val suggestion = SuggestionPolicy.next(state.needs, state.triedSteps)
    val tried = if (suggestion.cycled) listOf(suggestion.step) else state.triedSteps + suggestion.step
    return state.copy(
        phase = HelpNowPhase.Step,
        step = suggestion.step,
        triedSteps = tried,
        allStepsTried = suggestion.cycled,
        deadlineMillis = deadline(nowMillis, state.durationSeconds),
        stillStrong = false,
    )
}

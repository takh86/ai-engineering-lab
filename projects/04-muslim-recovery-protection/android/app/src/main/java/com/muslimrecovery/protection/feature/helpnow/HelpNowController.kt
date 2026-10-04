package com.muslimrecovery.protection.feature.helpnow

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

/**
 * Thin holder over the pure [reduce]. Reads the injected clock only to stamp events that set a deadline. Observable
 * by Compose through [state]. Holds no personal text and writes nothing anywhere.
 */
class HelpNowController(private val clock: MonotonicClock = AndroidMonotonicClock) {
    var state: HelpNowState by mutableStateOf(HelpNowState())
        private set

    fun nowMillis(): Long = clock.nowMillis()

    fun remainingMillis(): Long = HelpNowTimer.remainingMillis(state.deadlineMillis, clock.nowMillis(), state.durationSeconds)

    fun isExpired(): Boolean = HelpNowTimer.isExpired(state.deadlineMillis, clock.nowMillis())

    fun toggleNeed(need: HelpNeed) = send(HelpNowEvent.ToggleNeed(need))
    fun confirmNeeds() = send(HelpNowEvent.ConfirmNeeds(clock.nowMillis()))
    fun skipNeeds() = send(HelpNowEvent.SkipNeeds(clock.nowMillis()))
    fun setDuration(seconds: Int) = send(HelpNowEvent.SetDuration(seconds, clock.nowMillis()))
    fun finishStep() = send(HelpNowEvent.FinishStep)
    fun continueFromReflect() = send(HelpNowEvent.ContinueFromReflect)
    fun feelingLighter() = send(HelpNowEvent.FeelingLighter)
    fun stillStrong() = send(HelpNowEvent.StillStrong)
    fun anotherStep() = send(HelpNowEvent.AnotherStep(clock.nowMillis()))

    private fun send(event: HelpNowEvent) {
        state = reduce(state, event)
    }
}

/**
 * Keeps the controller across rotation and the locale-change recreate (a ViewModel, not saved instance state: no
 * state is ever copied into framework-managed saved state). Process death starts a fresh session (accepted).
 * The Integration Agent obtains it with `ViewModelProvider(owner, HelpNowViewModel.factory())`.
 */
class HelpNowViewModel(clock: MonotonicClock) : ViewModel() {
    val controller: HelpNowController = HelpNowController(clock)

    companion object {
        fun factory(clock: MonotonicClock = AndroidMonotonicClock): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = HelpNowViewModel(clock) as T
            }
    }
}

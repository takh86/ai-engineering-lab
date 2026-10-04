package com.muslimrecovery.protection.feature.onboarding

import com.muslimrecovery.protection.core.design.locale.AppLanguageController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** What the host receives once, when the commit succeeded. */
data class OnboardingCompletion(val startPlan: Boolean)

/**
 * The state machine plus its ports, as plain Kotlin (no Android types) so JVM tests drive it directly.
 * [OnboardingViewModel] owns one so it survives configuration changes, including the activity recreation that a
 * language change causes. Draft text lives here and nowhere else.
 *
 * Call [onEvent] and [submit] from the main thread. [faithAvailable] is supplied by the host (OD-F1-5: hidden until true).
 */
class OnboardingStateHolder(
    store: OnboardingStore,
    private val languageController: AppLanguageController,
    private val scope: CoroutineScope,
    faithAvailable: Boolean = false,
) {
    private val controller = OnboardingController(store)
    private val mutableState = MutableStateFlow(
        OnboardingState(language = languageController.current(), faithAvailable = faithAvailable),
    )
    private var handedOff = false

    val state: StateFlow<OnboardingState> = mutableState.asStateFlow()

    fun onEvent(event: OnboardingEvent) {
        // Submit is not a user event; it only goes through submit() so the guard and the launch stay together.
        if (event is OnboardingEvent.Submit || event is OnboardingEvent.CommitSucceeded || event is OnboardingEvent.CommitFailed) return
        val before = mutableState.value
        mutableState.value = reduce(before, event)
        if (event is OnboardingEvent.SetLanguage) {
            val after = mutableState.value.language
            // The platform owns the language (single source of truth); only call it when the machine accepted a change.
            if (after != before.language && after == event.language) languageController.set(event.language)
        }
    }

    /** Starts the commit once; extra taps while it is in flight, or after success, do nothing. */
    fun submit() {
        while (true) {
            val current = mutableState.value
            if (!canSubmit(current)) return
            val submitting = reduce(current, OnboardingEvent.Submit)
            if (mutableState.compareAndSet(current, submitting)) {
                val payload = commitPayload(current)
                scope.launch {
                    val outcome = when (val result = controller.commit(payload)) {
                        is CommitResult.Committed -> OnboardingEvent.CommitSucceeded
                        is CommitResult.Failure -> OnboardingEvent.CommitFailed(result.kind)
                    }
                    mutableState.value = reduce(mutableState.value, outcome)
                }
                return
            }
        }
    }

    /** Returns the completion exactly once (a recreated screen cannot deliver it twice), or null if not complete or already taken. */
    @Synchronized
    fun takeCompletion(): OnboardingCompletion? {
        val current = mutableState.value
        if (current.commit !is CommitStatus.Committed || handedOff) return null
        handedOff = true
        return OnboardingCompletion(startPlan = current.startPlan)
    }
}

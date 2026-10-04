package com.muslimrecovery.protection.feature.onboarding

import com.muslimrecovery.protection.core.design.locale.SupportedLanguage

/** The five onboarding steps, in order. */
enum class OnboardingStep {
    WELCOME,
    LANGUAGE,
    MODE,
    REASONS,
    FINISH,
    ;

    fun next(): OnboardingStep? = entries.getOrNull(ordinal + 1)

    fun previous(): OnboardingStep? = entries.getOrNull(ordinal - 1)

    companion object {
        val count: Int = entries.size
    }
}

/**
 * The path the user chooses (D-6). Feature-local on purpose: the shared core/model type is only a proposal (W1-ports,
 * OD-W1-1), so Integration maps this to it later. [RECOVERY_WITH_FAITH] is offered only when faith content is available.
 */
enum class OnboardingMode {
    RECOVERY,
    RECOVERY_WITH_FAITH,
}

/** Bounds for reasons written during onboarding. Assumption [A] in the contract; shared with F5 later (OD-F5-2). */
object OnboardingLimits {
    const val MAX_REASONS: Int = 10
    const val MAX_REASON_LENGTH: Int = 500
}

enum class ReasonError {
    TOO_LONG,
    TOO_MANY,
}

enum class CommitFailure {
    LOCKED,
    UNAVAILABLE,
    FAILED,
}

sealed interface CommitStatus {
    object Idle : CommitStatus

    object Submitting : CommitStatus

    object Committed : CommitStatus

    data class Failed(val failure: CommitFailure) : CommitStatus
}

/**
 * Everything the screens show. Reasons are private (D1): this class lives only in memory (a ViewModel), is never put in
 * saved instance state, and its [toString] is redacted so that an accidental log line cannot leak them.
 */
data class OnboardingState(
    val step: OnboardingStep = OnboardingStep.WELCOME,
    val language: SupportedLanguage = SupportedLanguage.SYSTEM,
    val mode: OnboardingMode = OnboardingMode.RECOVERY,
    val faithAvailable: Boolean = false,
    val reasons: List<String> = emptyList(),
    val reasonInput: String = "",
    val reasonError: ReasonError? = null,
    val startPlan: Boolean = false,
    val commit: CommitStatus = CommitStatus.Idle,
) {
    override fun toString(): String =
        "OnboardingState(step=$step, mode=$mode, reasons=${reasons.size}, input=${reasonInput.length} chars, commit=$commit)"
}

sealed interface OnboardingEvent {
    object Next : OnboardingEvent

    object Back : OnboardingEvent

    data class SetLanguage(val language: SupportedLanguage) : OnboardingEvent

    data class SetMode(val mode: OnboardingMode) : OnboardingEvent

    data class ReasonInputChanged(val text: String) : OnboardingEvent {
        override fun toString(): String = "ReasonInputChanged(${text.length} chars)"
    }

    object AddReason : OnboardingEvent

    data class RemoveReason(val index: Int) : OnboardingEvent

    data class SetStartPlan(val startPlan: Boolean) : OnboardingEvent

    /** Internal: the commit was accepted by the state machine and is now in flight. */
    object Submit : OnboardingEvent

    object CommitSucceeded : OnboardingEvent

    data class CommitFailed(val failure: CommitFailure) : OnboardingEvent
}

/** What the store receives at Finish: the final choice, in one piece. Redacted [toString]. */
data class OnboardingCommit(val mode: OnboardingMode, val reasons: List<String>) {
    override fun toString(): String = "OnboardingCommit(mode=$mode, reasons=${reasons.size})"
}

/** Whether a Finish tap may start a commit now (the single re-entry guard; nothing else is allowed to commit). */
fun canSubmit(state: OnboardingState): Boolean =
    state.step == OnboardingStep.FINISH &&
        (state.commit is CommitStatus.Idle || state.commit is CommitStatus.Failed)

/** Whether the Back control / system back should be handled by onboarding. */
fun canGoBack(state: OnboardingState): Boolean =
    state.step != OnboardingStep.WELCOME &&
        state.commit !is CommitStatus.Submitting &&
        state.commit !is CommitStatus.Committed

fun commitPayload(state: OnboardingState): OnboardingCommit =
    OnboardingCommit(mode = state.mode, reasons = state.reasons.toList())

private fun reasonLength(text: String): Int = text.codePointCount(0, text.length)

/** Pure transition function: no Android types, no I/O. */
fun reduce(state: OnboardingState, event: OnboardingEvent): OnboardingState {
    // While a commit is in flight or done, the draft is frozen except for the commit's own outcome.
    when (state.commit) {
        is CommitStatus.Submitting -> return when (event) {
            is OnboardingEvent.CommitSucceeded -> state.copy(commit = CommitStatus.Committed)
            is OnboardingEvent.CommitFailed -> state.copy(commit = CommitStatus.Failed(event.failure))
            else -> state
        }
        is CommitStatus.Committed -> return state
        else -> Unit
    }
    if (event is OnboardingEvent.CommitSucceeded || event is OnboardingEvent.CommitFailed) return state
    if (event is OnboardingEvent.Submit) {
        return if (canSubmit(state)) state.copy(commit = CommitStatus.Submitting) else state
    }
    // Any other accepted interaction clears an earlier failure message.
    val base = if (state.commit is CommitStatus.Failed) state.copy(commit = CommitStatus.Idle) else state
    return when (event) {
        is OnboardingEvent.SetLanguage -> base.copy(language = event.language)
        is OnboardingEvent.SetMode ->
            if (event.mode == OnboardingMode.RECOVERY_WITH_FAITH && !base.faithAvailable) base else base.copy(mode = event.mode)
        is OnboardingEvent.SetStartPlan -> base.copy(startPlan = event.startPlan)
        is OnboardingEvent.ReasonInputChanged -> base.copy(
            reasonInput = event.text,
            reasonError = if (reasonLength(event.text.trim()) > OnboardingLimits.MAX_REASON_LENGTH) ReasonError.TOO_LONG else null,
        )
        is OnboardingEvent.AddReason -> addPendingReason(base)
        is OnboardingEvent.RemoveReason ->
            if (event.index in base.reasons.indices) {
                base.copy(reasons = base.reasons.filterIndexed { i, _ -> i != event.index }, reasonError = null)
            } else {
                base
            }
        is OnboardingEvent.Back -> {
            val previous = base.step.previous()
            if (previous == null) base else base.copy(step = previous, reasonError = null)
        }
        is OnboardingEvent.Next -> next(base)
        else -> base
    }
}

private fun next(state: OnboardingState): OnboardingState {
    val target = state.step.next() ?: return state
    if (state.step != OnboardingStep.REASONS) return state.copy(step = target)
    // Leaving the reasons step: text typed but not yet added is added now, or the user is told why not (never silently lost).
    val withPending = addPendingReason(state)
    return if (withPending.reasonError != null) withPending else withPending.copy(step = target)
}

/** Trim; blank is ignored; too long or too many is rejected with the text kept so the user can fix it. */
private fun addPendingReason(state: OnboardingState): OnboardingState {
    val text = state.reasonInput.trim()
    if (text.isEmpty()) return state.copy(reasonInput = "", reasonError = null)
    if (reasonLength(text) > OnboardingLimits.MAX_REASON_LENGTH) return state.copy(reasonError = ReasonError.TOO_LONG)
    if (state.reasons.size >= OnboardingLimits.MAX_REASONS) return state.copy(reasonError = ReasonError.TOO_MANY)
    return state.copy(reasons = state.reasons + text, reasonInput = "", reasonError = null)
}

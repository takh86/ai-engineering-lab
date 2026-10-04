package com.muslimrecovery.protection.feature.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDirection
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.design.components.PrimaryButton
import com.muslimrecovery.protection.core.design.components.SectionCard
import com.muslimrecovery.protection.core.design.components.SecondaryButton
import com.muslimrecovery.protection.core.design.components.SelectableOption
import com.muslimrecovery.protection.core.design.components.TabsiraScreen
import com.muslimrecovery.protection.core.design.components.TabsiraTextField
import com.muslimrecovery.protection.core.design.components.TextAction
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing
import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import com.muslimrecovery.protection.core.design.theme.TabsiraDesign

/** Test hooks (no user text). */
const val ONBOARDING_TITLE_TAG = "onboarding_title"
const val ONBOARDING_NEXT_TAG = "onboarding_next"
const val ONBOARDING_BACK_TAG = "onboarding_back"
const val ONBOARDING_REASON_FIELD_TAG = "onboarding_reason_field"

/**
 * Stateless onboarding screen: renders [state] and reports intent through [onEvent] / [onSubmit]. A scrolling
 * [TabsiraScreen] so that 200% font scale and German text never clip; all strings are localized resources and the
 * layout uses start/end only (RTL mirrors by itself).
 */
@Composable
fun OnboardingContent(
    state: OnboardingState,
    onEvent: (OnboardingEvent) -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TabsiraScreen(modifier = modifier, scrollable = true) {
        Spacer(Modifier.height(TabsiraSpacing.l))
        Text(
            text = stringResource(R.string.onboarding_progress, state.step.ordinal + 1, OnboardingStep.count),
            style = MaterialTheme.typography.bodyMedium,
            color = TabsiraDesign.colors.textSecondary,
        )
        Spacer(Modifier.height(TabsiraSpacing.s))
        Text(
            text = stringResource(titleRes(state.step)),
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.semantics { heading() }.testTag(ONBOARDING_TITLE_TAG),
        )
        Spacer(Modifier.height(TabsiraSpacing.l))
        when (state.step) {
            OnboardingStep.WELCOME -> WelcomeStep()
            OnboardingStep.LANGUAGE -> LanguageStep(state, onEvent)
            OnboardingStep.MODE -> ModeStep(state, onEvent)
            OnboardingStep.REASONS -> ReasonsStep(state, onEvent)
            OnboardingStep.FINISH -> FinishStep(state, onEvent)
        }
        Spacer(Modifier.height(TabsiraSpacing.xl))
        NavigationActions(state, onEvent, onSubmit)
        Spacer(Modifier.height(TabsiraSpacing.xl))
    }
}

private fun titleRes(step: OnboardingStep): Int = when (step) {
    OnboardingStep.WELCOME -> R.string.onboarding_welcome_title
    OnboardingStep.LANGUAGE -> R.string.onboarding_language_title
    OnboardingStep.MODE -> R.string.onboarding_mode_title
    OnboardingStep.REASONS -> R.string.onboarding_reasons_title
    OnboardingStep.FINISH -> R.string.onboarding_finish_title
}

@Composable
private fun WelcomeStep() {
    Text(text = stringResource(R.string.onboarding_welcome_body), style = MaterialTheme.typography.bodyLarge)
    Spacer(Modifier.height(TabsiraSpacing.l))
    SectionCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.onboarding_limits_title),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(TabsiraSpacing.s))
        Text(text = stringResource(R.string.onboarding_limits_body), style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun LanguageStep(state: OnboardingState, onEvent: (OnboardingEvent) -> Unit) {
    Text(text = stringResource(R.string.onboarding_language_body), style = MaterialTheme.typography.bodyLarge)
    Spacer(Modifier.height(TabsiraSpacing.l))
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        SupportedLanguage.entries.forEach { language ->
            SelectableOption(
                label = stringResource(languageLabelRes(language)),
                selected = state.language == language,
                onClick = { onEvent(OnboardingEvent.SetLanguage(language)) },
            )
        }
    }
}

private fun languageLabelRes(language: SupportedLanguage): Int = when (language) {
    SupportedLanguage.SYSTEM -> R.string.onboarding_language_system
    SupportedLanguage.ENGLISH -> R.string.onboarding_language_english
    SupportedLanguage.ARABIC -> R.string.onboarding_language_arabic
    SupportedLanguage.GERMAN -> R.string.onboarding_language_german
}

@Composable
private fun ModeStep(state: OnboardingState, onEvent: (OnboardingEvent) -> Unit) {
    Text(text = stringResource(R.string.onboarding_mode_body), style = MaterialTheme.typography.bodyLarge)
    Spacer(Modifier.height(TabsiraSpacing.l))
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        SelectableOption(
            label = stringResource(R.string.onboarding_mode_recovery_title),
            description = stringResource(R.string.onboarding_mode_recovery_description),
            selected = state.mode == OnboardingMode.RECOVERY,
            onClick = { onEvent(OnboardingEvent.SetMode(OnboardingMode.RECOVERY)) },
        )
        // OD-F1-5 (undecided): the Faith option exists only while the host reports faith content as available.
        if (state.faithAvailable) {
            SelectableOption(
                label = stringResource(R.string.onboarding_mode_faith_title),
                description = stringResource(R.string.onboarding_mode_faith_description),
                selected = state.mode == OnboardingMode.RECOVERY_WITH_FAITH,
                onClick = { onEvent(OnboardingEvent.SetMode(OnboardingMode.RECOVERY_WITH_FAITH)) },
            )
        }
    }
}

@Composable
private fun ReasonsStep(state: OnboardingState, onEvent: (OnboardingEvent) -> Unit) {
    Text(text = stringResource(R.string.onboarding_reasons_body), style = MaterialTheme.typography.bodyLarge)
    Spacer(Modifier.height(TabsiraSpacing.l))
    val errorText = when (state.reasonError) {
        ReasonError.TOO_LONG -> stringResource(R.string.onboarding_reasons_error_too_long, OnboardingLimits.MAX_REASON_LENGTH)
        ReasonError.TOO_MANY -> stringResource(R.string.onboarding_reasons_error_too_many, OnboardingLimits.MAX_REASONS)
        null -> null
    }
    TabsiraTextField(
        value = state.reasonInput,
        onValueChange = { onEvent(OnboardingEvent.ReasonInputChanged(it)) },
        label = stringResource(R.string.onboarding_reasons_input_label),
        errorText = errorText,
        modifier = Modifier.fillMaxWidth().testTag(ONBOARDING_REASON_FIELD_TAG),
    )
    Spacer(Modifier.height(TabsiraSpacing.s))
    SecondaryButton(
        text = stringResource(R.string.onboarding_reasons_add),
        onClick = { onEvent(OnboardingEvent.AddReason) },
        modifier = Modifier.fillMaxWidth(),
    )
    if (state.reasons.isNotEmpty()) {
        Spacer(Modifier.height(TabsiraSpacing.l))
        Text(
            text = stringResource(R.string.onboarding_reasons_list_title, state.reasons.size),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(TabsiraSpacing.s))
        Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
            state.reasons.forEachIndexed { index, reason ->
                SectionCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = reason,
                        style = MaterialTheme.typography.bodyLarge.merge(TextStyle(textDirection = TextDirection.Content)),
                    )
                    val removeDescription = stringResource(R.string.onboarding_reasons_remove_description, reason)
                    TextAction(
                        text = stringResource(R.string.onboarding_reasons_remove),
                        onClick = { onEvent(OnboardingEvent.RemoveReason(index)) },
                        modifier = Modifier.semantics { contentDescription = removeDescription },
                    )
                }
            }
        }
    }
}

@Composable
private fun FinishStep(state: OnboardingState, onEvent: (OnboardingEvent) -> Unit) {
    val modeName = stringResource(
        if (state.mode == OnboardingMode.RECOVERY_WITH_FAITH) {
            R.string.onboarding_mode_faith_title
        } else {
            R.string.onboarding_mode_recovery_title
        },
    )
    SectionCard(modifier = Modifier.fillMaxWidth()) {
        Text(text = stringResource(R.string.onboarding_finish_summary_mode, modeName), style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(TabsiraSpacing.s))
        Text(
            text = stringResource(R.string.onboarding_finish_summary_reasons, state.reasons.size),
            style = MaterialTheme.typography.bodyLarge,
        )
    }
    Spacer(Modifier.height(TabsiraSpacing.l))
    SectionCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.onboarding_privacy_title),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(TabsiraSpacing.s))
        Text(text = stringResource(R.string.onboarding_privacy_body), style = MaterialTheme.typography.bodyLarge)
    }
    Spacer(Modifier.height(TabsiraSpacing.l))
    SelectableOption(
        label = stringResource(R.string.onboarding_start_plan_option),
        selected = state.startPlan,
        multiSelect = true,
        onClick = { onEvent(OnboardingEvent.SetStartPlan(!state.startPlan)) },
    )
    val failure = (state.commit as? CommitStatus.Failed)?.failure
    if (failure != null) {
        Spacer(Modifier.height(TabsiraSpacing.l))
        Row(
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            horizontalArrangement = Arrangement.spacedBy(TabsiraSpacing.s),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(
                imageVector = Icons.Filled.Warning,
                contentDescription = stringResource(R.string.onboarding_warning_icon_description),
            )
            Text(text = stringResource(failureRes(failure)), style = MaterialTheme.typography.bodyLarge)
        }
    }
}

private fun failureRes(failure: CommitFailure): Int = when (failure) {
    CommitFailure.LOCKED -> R.string.onboarding_error_locked
    CommitFailure.UNAVAILABLE -> R.string.onboarding_error_unavailable
    CommitFailure.FAILED -> R.string.onboarding_error_failed
}

@Composable
private fun NavigationActions(state: OnboardingState, onEvent: (OnboardingEvent) -> Unit, onSubmit: () -> Unit) {
    val submitting = state.commit is CommitStatus.Submitting || state.commit is CommitStatus.Committed
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.s)) {
        when (state.step) {
            OnboardingStep.FINISH -> PrimaryButton(
                text = stringResource(
                    when {
                        submitting -> R.string.onboarding_saving
                        state.commit is CommitStatus.Failed -> R.string.onboarding_retry
                        else -> R.string.onboarding_finish
                    },
                ),
                onClick = onSubmit,
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth().testTag(ONBOARDING_NEXT_TAG),
            )
            else -> PrimaryButton(
                text = stringResource(if (state.step == OnboardingStep.WELCOME) R.string.onboarding_start else R.string.onboarding_next),
                onClick = { onEvent(OnboardingEvent.Next) },
                modifier = Modifier.fillMaxWidth().testTag(ONBOARDING_NEXT_TAG),
            )
        }
        if (state.step == OnboardingStep.REASONS && state.reasons.isEmpty() && state.reasonInput.isBlank()) {
            TextAction(
                text = stringResource(R.string.onboarding_reasons_skip),
                onClick = { onEvent(OnboardingEvent.Next) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (state.step != OnboardingStep.WELCOME) {
            SecondaryButton(
                text = stringResource(R.string.onboarding_back),
                onClick = { onEvent(OnboardingEvent.Back) },
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth().testTag(ONBOARDING_BACK_TAG),
            )
        }
    }
}

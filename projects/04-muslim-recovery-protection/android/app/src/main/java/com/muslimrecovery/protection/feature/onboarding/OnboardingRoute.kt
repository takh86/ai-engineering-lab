package com.muslimrecovery.protection.feature.onboarding

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier

/**
 * Entry point for the host (Integration wires it later; this feature does not touch navigation or MainActivity).
 * [onFinished] is called exactly once after a successful commit, with `startPlan` = the user asked to build a first plan.
 * Back is handled only after the first step and never while saving; at the first step the host's default back applies.
 */
@Composable
fun OnboardingRoute(
    holder: OnboardingStateHolder,
    onFinished: (startPlan: Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by holder.state.collectAsState()
    val currentOnFinished by rememberUpdatedState(onFinished)
    LaunchedEffect(state.commit) {
        holder.takeCompletion()?.let { currentOnFinished(it.startPlan) }
    }
    BackHandler(enabled = canGoBack(state)) { holder.onEvent(OnboardingEvent.Back) }
    OnboardingContent(
        state = state,
        onEvent = holder::onEvent,
        onSubmit = holder::submit,
        modifier = modifier,
    )
}

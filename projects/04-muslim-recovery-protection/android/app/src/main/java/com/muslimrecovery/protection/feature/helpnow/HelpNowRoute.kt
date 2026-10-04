package com.muslimrecovery.protection.feature.helpnow

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.design.components.PrimaryButton
import com.muslimrecovery.protection.core.design.components.SecondaryButton
import com.muslimrecovery.protection.core.design.components.SectionCard
import com.muslimrecovery.protection.core.design.components.SelectableOption
import com.muslimrecovery.protection.core.design.components.TabsiraScreen
import com.muslimrecovery.protection.core.design.components.TextAction
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.cancellation.CancellationException

private const val TIMER_TICK_MILLIS = 250L

/**
 * Help Now entry point (not wired into the app: the Integration Agent owns navigation). A plain composable over a
 * plain state holder, so it works with or without Navigation Compose. Leaving is always possible, from any phase,
 * with no confirmation: [onClose] is called by the Leave action and by system back.
 *
 * - [personalSupport]: optional personal tier. The generic tier renders first and never waits for it; the source
 *   is read once, with a timeout and a catch. Personal text appears only when it reports Open.
 * - [trustedPerson]: optional slot for F14 (shown only after "still strong"); null hides it.
 * - [faithSlot]: empty extension slot for F8 content. Null renders nothing.
 * - [qualifiedHelpSlot]: slot for emergency or help-line content. OWNER DECISION REQUIRED - OD-F3-3: this feature
 *   ships no such text or contact; the Integration Agent supplies reviewed content only after the Owner decides.
 * - [numerals]: timer numeral seam, OWNER DECISION REQUIRED - OD-F3-1 (not final policy).
 * - [keepScreenOnDuringTimer]: OWNER DECISION REQUIRED - OD-F3-5. Default false until decided; it only sets the
 *   view's keep-screen-on flag during a step (no wake lock, no permission).
 */
@Composable
fun HelpNowRoute(
    controller: HelpNowController,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    personalSupport: PersonalSupportSource? = null,
    trustedPerson: (() -> Unit)? = null,
    faithSlot: (@Composable () -> Unit)? = null,
    qualifiedHelpSlot: (@Composable () -> Unit)? = null,
    numerals: TimerNumerals = NeutralLatinNumerals,
    reduceMotion: Boolean = rememberReduceMotion(),
    keepScreenOnDuringTimer: Boolean = false,
) {
    BackHandler(onBack = onClose)

    // The personal tier is held only in composition (never saved state). Until it is Open there is no personal text.
    var personal: PersonalSupport by remember { mutableStateOf(PersonalSupport.Unavailable) }
    LaunchedEffect(personalSupport) {
        val source = personalSupport ?: return@LaunchedEffect
        personal = try {
            withTimeoutOrNull(PERSONAL_SUPPORT_TIMEOUT_MILLIS) { source.read() } ?: PersonalSupport.Unavailable
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            PersonalSupport.Unavailable
        }
    }
    val open = personal as? PersonalSupport.Open

    val state = controller.state
    val view = LocalView.current
    val keepOn = keepScreenOnDuringTimer && state.phase == HelpNowPhase.Step
    DisposableEffect(keepOn) {
        if (keepOn) view.keepScreenOn = true
        onDispose { if (keepOn) view.keepScreenOn = false }
    }

    TabsiraScreen(modifier = modifier, scrollable = true) {
        TextAction(
            text = stringResource(R.string.helpnow_action_leave),
            onClick = onClose,
            modifier = Modifier.align(Alignment.End),
        )
        when (state.phase) {
            HelpNowPhase.Need -> NeedPhase(controller, state)
            HelpNowPhase.Step -> StepPhase(controller, state, open, numerals, reduceMotion, faithSlot)
            HelpNowPhase.Reflect -> ReflectPhase(controller, open)
            HelpNowPhase.Reassess -> ReassessPhase(controller, state, trustedPerson, faithSlot, qualifiedHelpSlot)
            HelpNowPhase.Done -> DonePhase(onClose)
        }
        Spacer(Modifier.height(TabsiraSpacing.xl))
    }
}

/** Heading with a polite live region: a phase change is announced once, never every second. */
@Composable
private fun PhaseHeading(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.headlineMedium,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(HelpNowTags.PHASE_HEADING)
            .semantics {
                heading()
                liveRegion = LiveRegionMode.Polite
            },
    )
}

@Composable
private fun NeedPhase(controller: HelpNowController, state: HelpNowState) {
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        PhaseHeading(stringResource(R.string.helpnow_need_heading))
        Text(stringResource(R.string.helpnow_need_hint), style = MaterialTheme.typography.bodyLarge)
        for (need in HelpNeed.values()) {
            SelectableOption(
                label = stringResource(HelpNowCatalog.needLabel(need)),
                selected = need in state.needs,
                onClick = { controller.toggleNeed(need) },
                multiSelect = true,
            )
        }
        PrimaryButton(
            text = stringResource(R.string.helpnow_action_continue),
            onClick = controller::confirmNeeds,
            modifier = Modifier.fillMaxWidth(),
        )
        TextAction(
            text = stringResource(R.string.helpnow_action_skip),
            onClick = controller::skipNeeds,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
    }
}

@Composable
private fun StepPhase(
    controller: HelpNowController,
    state: HelpNowState,
    personal: PersonalSupport.Open?,
    numerals: TimerNumerals,
    reduceMotion: Boolean,
    faithSlot: (@Composable () -> Unit)?,
) {
    val step = state.step ?: return
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        PhaseHeading(stringResource(HelpNowCatalog.stepTitle(step)))
        Text(stringResource(HelpNowCatalog.stepBody(step)), style = MaterialTheme.typography.bodyLarge)
        if (state.allStepsTried) {
            Text(stringResource(R.string.helpnow_all_tried), style = MaterialTheme.typography.bodyMedium)
        }
        BreathingIndicator(reduceMotion)
        StepTimer(controller, state, numerals)
        if (personal != null && personal.steps.isNotEmpty()) {
            PersonalCard(stringResource(R.string.helpnow_personal_steps_heading), personal.steps)
        }
        PrimaryButton(
            text = stringResource(R.string.helpnow_action_step_done),
            onClick = controller::finishStep,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            text = stringResource(R.string.helpnow_duration_heading),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        for (seconds in HelpNowDurations.choicesSeconds) {
            SelectableOption(
                label = stringResource(R.string.helpnow_duration_option, seconds),
                selected = seconds == state.durationSeconds,
                onClick = { controller.setDuration(seconds) },
            )
        }
        faithSlot?.invoke()
    }
}

/**
 * The countdown. Remaining time is recomputed from the absolute deadline on every tick (and on first composition
 * after a recreate), so it cannot drift. The loop ends at expiry. The number is not a live region.
 */
@Composable
private fun StepTimer(controller: HelpNowController, state: HelpNowState, numerals: TimerNumerals) {
    var remainingMillis by remember(state.deadlineMillis) { mutableLongStateOf(controller.remainingMillis()) }
    LaunchedEffect(state.deadlineMillis) {
        while (true) {
            remainingMillis = controller.remainingMillis()
            if (remainingMillis <= 0L) break
            delay(TIMER_TICK_MILLIS)
        }
    }
    val clock = numerals.format(HelpNowTimer.displaySeconds(remainingMillis))
    val description = stringResource(R.string.helpnow_timer_description, clock)
    Text(
        text = clock,
        style = MaterialTheme.typography.headlineLarge,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(HelpNowTags.TIMER)
            .clearAndSetSemantics { contentDescription = description },
    )
    if (remainingMillis <= 0L) {
        Text(
            text = stringResource(R.string.helpnow_timer_finished),
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(HelpNowTags.TIMER_FINISHED)
                .semantics { liveRegion = LiveRegionMode.Polite },
        )
    }
}

@Composable
private fun PersonalCard(heading: String, items: List<String>) {
    SectionCard(modifier = Modifier.fillMaxWidth()) {
        Text(heading, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
        for (item in items) {
            Spacer(Modifier.height(TabsiraSpacing.s))
            Text(item, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun ReflectPhase(controller: HelpNowController, personal: PersonalSupport.Open?) {
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        PhaseHeading(stringResource(R.string.helpnow_reflect_heading))
        Text(stringResource(R.string.helpnow_reflect_body), style = MaterialTheme.typography.bodyLarge)
        if (personal != null && personal.reasons.isNotEmpty()) {
            PersonalCard(stringResource(R.string.helpnow_personal_reasons_heading), personal.reasons)
        }
        PrimaryButton(
            text = stringResource(R.string.helpnow_action_continue),
            onClick = controller::continueFromReflect,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ReassessPhase(
    controller: HelpNowController,
    state: HelpNowState,
    trustedPerson: (() -> Unit)?,
    faithSlot: (@Composable () -> Unit)?,
    qualifiedHelpSlot: (@Composable () -> Unit)?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        PhaseHeading(stringResource(R.string.helpnow_reassess_heading))
        PrimaryButton(
            text = stringResource(R.string.helpnow_reassess_lighter),
            onClick = controller::feelingLighter,
            modifier = Modifier.fillMaxWidth(),
        )
        if (!state.stillStrong) {
            SecondaryButton(
                text = stringResource(R.string.helpnow_reassess_strong),
                onClick = controller::stillStrong,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            Text(stringResource(R.string.helpnow_strong_body), style = MaterialTheme.typography.bodyLarge)
            SecondaryButton(
                text = stringResource(R.string.helpnow_strong_another),
                onClick = controller::anotherStep,
                modifier = Modifier.fillMaxWidth(),
            )
            if (trustedPerson != null) {
                TextAction(
                    text = stringResource(R.string.helpnow_trusted_person_action),
                    onClick = trustedPerson,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }
            Text(stringResource(R.string.helpnow_qualified_help), style = MaterialTheme.typography.bodyMedium)
            qualifiedHelpSlot?.invoke()
            faithSlot?.invoke()
        }
    }
}

@Composable
private fun DonePhase(onClose: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m)) {
        PhaseHeading(stringResource(R.string.helpnow_done_heading))
        Text(stringResource(R.string.helpnow_done_body), style = MaterialTheme.typography.bodyLarge)
        PrimaryButton(
            text = stringResource(R.string.helpnow_action_leave),
            onClick = onClose,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

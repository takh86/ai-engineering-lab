package com.muslimrecovery.protection.feature.onboarding

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import android.text.TextUtils
import android.view.View
import androidx.activity.OnBackPressedDispatcherOwner
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodes
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.components.SELECTABLE_OPTION_LABEL_TAG
import com.muslimrecovery.protection.core.design.components.SELECTABLE_OPTION_MARKER_TAG
import com.muslimrecovery.protection.core.design.locale.AppLanguageController
import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * F1 UI evidence on a real device: the flow with fakes, back, Faith visibility, failure, composition re-creation,
 * semantics, 48dp targets, RTL and 200% font scale (German and Arabic included). The real activity recreation and the
 * real language controller are in [OnboardingRecreationTest].
 */
@RunWith(AndroidJUnit4::class)
class OnboardingFlowTest {
    @get:Rule
    val rule = createComposeRule()

    private class FakeLanguage(var language: SupportedLanguage = SupportedLanguage.SYSTEM) : AppLanguageController {
        override fun current() = language

        override fun set(language: SupportedLanguage) {
            this.language = language
        }
    }

    private val store = InMemoryOnboardingStore()
    private val finishedWith: MutableList<Boolean> = mutableListOf()

    private fun contextFor(tag: String): Context {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val config = Configuration(base.resources.configuration)
        val locale = Locale.forLanguageTag(tag)
        config.setLocales(LocaleList(locale))
        config.setLayoutDirection(locale)
        return base.createConfigurationContext(config)
    }

    private fun directionFor(tag: String): LayoutDirection =
        if (TextUtils.getLayoutDirectionFromLocale(Locale.forLanguageTag(tag)) == View.LAYOUT_DIRECTION_RTL) {
            LayoutDirection.Rtl
        } else {
            LayoutDirection.Ltr
        }

    private fun newHolder(faith: Boolean = false) =
        OnboardingStateHolder(store, FakeLanguage(), CoroutineScope(Job() + Dispatchers.Unconfined), faith)

    private var hostInstalled = false
    private var hostTag by mutableStateOf("en")
    private var hostScale by mutableStateOf(1f)
    private var hostBody by mutableStateOf<@Composable () -> Unit>({})

    /**
     * Compose allows one setContent per test, so the host is installed once and later calls only swap the locale,
     * font scale and body through state.
     */
    private fun localized(tag: String, fontScale: Float = 1f, content: @Composable () -> Unit) {
        if (!hostInstalled) {
            hostInstalled = true
            hostTag = tag
            hostScale = fontScale
            hostBody = content
            rule.setContent {
                val context = contextFor(hostTag)
                val direction = directionFor(hostTag)
                val density = LocalDensity.current
                // The localized context wraps the application, not the activity: keep the activity as back-press owner.
                val backOwner = LocalContext.current as? OnBackPressedDispatcherOwner
                CompositionLocalProvider(
                    *listOfNotNull(backOwner?.let { LocalOnBackPressedDispatcherOwner provides it }).toTypedArray(),
                    LocalContext provides context,
                    LocalConfiguration provides context.resources.configuration,
                    LocalLayoutDirection provides direction,
                    LocalDensity provides Density(density.density, hostScale),
                ) {
                    TabsiraTheme(ThemeMode.LIGHT) { hostBody() }
                }
            }
        } else {
            rule.runOnIdle {
                hostTag = tag
                hostScale = fontScale
                hostBody = content
            }
        }
        rule.waitForIdle()
    }

    private fun route(holder: OnboardingStateHolder, tag: String = "en", fontScale: Float = 1f) =
        localized(tag, fontScale) { OnboardingRoute(holder = holder, onFinished = { finishedWith += it }) }

    private fun text(id: Int, tag: String = "en", vararg args: Any) = contextFor(tag).getString(id, *args)

    private fun click(id: Int, tag: String = "en") {
        rule.onNodeWithText(text(id, tag)).performScrollTo().performClick()
        rule.waitForIdle()
    }

    private fun assertTitle(id: Int, tag: String = "en") {
        rule.onNodeWithTag(ONBOARDING_TITLE_TAG).assertIsDisplayed()
        rule.onNodeWithText(text(id, tag)).assertIsDisplayed()
    }

    @Test
    fun fullFlowWithFakesCommitsOnceAndHandsOffOnce() {
        route(newHolder(faith = true))
        assertTitle(R.string.onboarding_welcome_title)
        click(R.string.onboarding_start)
        assertTitle(R.string.onboarding_language_title)
        click(R.string.onboarding_next)
        assertTitle(R.string.onboarding_mode_title)
        click(R.string.onboarding_mode_faith_title)
        rule.onNodeWithText(text(R.string.onboarding_mode_faith_title)).assertIsSelected()
        click(R.string.onboarding_next)
        assertTitle(R.string.onboarding_reasons_title)
        rule.onNodeWithTag(ONBOARDING_REASON_FIELD_TAG).performTextInput("  to be present for my family  ")
        click(R.string.onboarding_reasons_add)
        rule.onNodeWithText(text(R.string.onboarding_reasons_list_title, "en", 1)).assertExists()
        click(R.string.onboarding_next)
        assertTitle(R.string.onboarding_finish_title)
        assertNull("nothing is written before Finish", store.snapshot())
        click(R.string.onboarding_start_plan_option)
        click(R.string.onboarding_finish)
        assertEquals(
            OnboardingCommit(OnboardingMode.RECOVERY_WITH_FAITH, listOf("to be present for my family")),
            store.snapshot(),
        )
        assertEquals(listOf(true), finishedWith)
    }

    @Test
    fun reasonsCanBeSkippedAndNothingElseIsRequired() {
        route(newHolder())
        click(R.string.onboarding_start)
        click(R.string.onboarding_next)
        click(R.string.onboarding_next)
        click(R.string.onboarding_reasons_skip)
        assertTitle(R.string.onboarding_finish_title)
        click(R.string.onboarding_finish)
        assertEquals(OnboardingCommit(OnboardingMode.RECOVERY, emptyList()), store.snapshot())
        assertEquals(listOf(false), finishedWith)
    }

    @Test
    fun backWorksOnEveryStepAndIsAbsentOnTheFirst() {
        route(newHolder())
        rule.onAllNodesWithTag(ONBOARDING_BACK_TAG).assertCountEquals(0)
        click(R.string.onboarding_start)
        click(R.string.onboarding_next)
        click(R.string.onboarding_next)
        click(R.string.onboarding_reasons_skip)
        assertTitle(R.string.onboarding_finish_title)
        for (expected in listOf(
            R.string.onboarding_reasons_title,
            R.string.onboarding_mode_title,
            R.string.onboarding_language_title,
            R.string.onboarding_welcome_title,
        )) {
            click(R.string.onboarding_back)
            assertTitle(expected)
        }
    }

    @Test
    fun faithOptionIsAbsentWhenUnavailableAndRecoveryIsTheDefault() {
        route(newHolder(faith = false))
        click(R.string.onboarding_start)
        click(R.string.onboarding_next)
        assertTitle(R.string.onboarding_mode_title)
        rule.onNodeWithText(text(R.string.onboarding_mode_recovery_title)).assertIsSelected()
        rule.onAllNodesWithText(text(R.string.onboarding_mode_faith_title)).assertCountEquals(0)
    }

    @Test
    fun failedCommitShowsACalmRetryAndSavesNothingThenRetrySucceeds() {
        route(newHolder())
        click(R.string.onboarding_start)
        click(R.string.onboarding_next)
        click(R.string.onboarding_next)
        click(R.string.onboarding_reasons_skip)
        store.failNextCommit(CommitFailure.UNAVAILABLE)
        click(R.string.onboarding_finish)
        rule.onNodeWithText(text(R.string.onboarding_error_unavailable)).assertIsDisplayed()
        assertNull(store.snapshot())
        assertTrue(finishedWith.isEmpty())
        click(R.string.onboarding_retry)
        assertNotNull(store.snapshot())
        assertEquals(1, finishedWith.size)
    }

    @Test
    fun theDraftSurvivesTheScreenBeingRecreatedWhileTheHolderLives() {
        val holder = newHolder()
        var show by mutableStateOf(true)
        localized("en") {
            if (show) OnboardingRoute(holder = holder, onFinished = { finishedWith += it })
        }
        click(R.string.onboarding_start)
        click(R.string.onboarding_next)
        click(R.string.onboarding_next)
        rule.onNodeWithTag(ONBOARDING_REASON_FIELD_TAG).performTextInput("kept across recreation")
        rule.runOnUiThread { show = false }
        rule.waitForIdle()
        rule.runOnUiThread { show = true }
        rule.waitForIdle()
        assertTitle(R.string.onboarding_reasons_title)
        rule.onNodeWithText("kept across recreation").assertExists()
    }

    @Test
    fun semanticsAndTouchTargetsOfTheMainControls() {
        route(newHolder())
        rule.onNodeWithTag(ONBOARDING_TITLE_TAG).assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        rule.onNodeWithTag(ONBOARDING_NEXT_TAG).assertHasClickAction().assertIsEnabled()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
            .assertHeightIsAtLeast(48.dp)
        click(R.string.onboarding_start)
        rule.onNodeWithTag(ONBOARDING_BACK_TAG).assertHeightIsAtLeast(48.dp).assertHasClickAction()
        rule.onNodeWithText(text(R.string.onboarding_language_system))
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton))
            .assertIsSelected()
    }

    @Test
    fun afterSuccessTheFinishButtonIsDisabledAndReadsSaving() {
        val holder = newHolder()
        route(holder)
        click(R.string.onboarding_start)
        click(R.string.onboarding_next)
        click(R.string.onboarding_next)
        click(R.string.onboarding_reasons_skip)
        // After a success the button reads "Saving..." and is disabled (the host navigates away at that point).
        click(R.string.onboarding_finish)
        rule.onNodeWithTag(ONBOARDING_NEXT_TAG).assertIsNotEnabled()
        rule.onNodeWithText(text(R.string.onboarding_saving)).assertExists()
    }

    private fun assertRtlMirrored(tag: String) {
        localized(tag) { OnboardingContent(OnboardingState(step = OnboardingStep.LANGUAGE), onEvent = {}, onSubmit = {}) }
        val marker = rule.onAllNodesWithTag(SELECTABLE_OPTION_MARKER_TAG, useUnmergedTree = true)[0].getBoundsInRoot()
        val label = rule.onAllNodesWithTag(SELECTABLE_OPTION_LABEL_TAG, useUnmergedTree = true)[0].getBoundsInRoot()
        if (directionFor(tag) == LayoutDirection.Rtl) {
            assertTrue("RTL: the marker is after (right of) the label", marker.left > label.left)
        } else {
            assertTrue("LTR: the marker is before (left of) the label", marker.left < label.left)
        }
    }

    @Test
    fun arabicMirrorsTheLayout() = assertRtlMirrored("ar")

    @Test
    fun englishAndGermanAreLeftToRight() {
        assertRtlMirrored("en")
    }

    @Test
    fun everyStepShowsItsOwnLocalizedTitleInArabicAndGerman() {
        for (tag in listOf("ar", "de")) {
            val titles = mapOf(
                OnboardingStep.WELCOME to R.string.onboarding_welcome_title,
                OnboardingStep.LANGUAGE to R.string.onboarding_language_title,
                OnboardingStep.MODE to R.string.onboarding_mode_title,
                OnboardingStep.REASONS to R.string.onboarding_reasons_title,
                OnboardingStep.FINISH to R.string.onboarding_finish_title,
            )
            for ((step, id) in titles) {
                localized(tag) { OnboardingContent(OnboardingState(step = step), onEvent = {}, onSubmit = {}) }
                rule.onNodeWithText(text(id, tag)).assertIsDisplayed()
            }
        }
    }

    private fun assertNoClippedTextAndReachableActions(tag: String, state: OnboardingState) {
        localized(tag, fontScale = 2f) { OnboardingContent(state, onEvent = {}, onSubmit = {}) }
        rule.onNodeWithTag(ONBOARDING_NEXT_TAG).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
        val nodes = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult)).fetchSemanticsNodes()
        assertTrue("expected text nodes at ${state.step}", nodes.isNotEmpty())
        val clipped = nodes.mapIndexedNotNull { index, node ->
            val results = mutableListOf<TextLayoutResult>()
            val ok = node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results) ?: false
            if (ok && results.isNotEmpty() && results.first().hasVisualOverflow) "node $index at ${state.step} ($tag)" else null
        }
        assertEquals("clipped text at 200% font scale", emptyList<String>(), clipped)
    }

    @Test
    fun noStepClipsOrHidesItsActionsAtTwoHundredPercentInEveryLanguage() {
        val longReason = "a long reason written in the user's own words that keeps going to force wrapping on a narrow screen"
        for (tag in listOf("en", "de", "ar")) {
            for (step in OnboardingStep.entries) {
                val state = OnboardingState(
                    step = step,
                    faithAvailable = true,
                    reasons = listOf(longReason),
                    commit = if (step == OnboardingStep.FINISH) CommitStatus.Failed(CommitFailure.UNAVAILABLE) else CommitStatus.Idle,
                )
                assertNoClippedTextAndReachableActions(tag, state)
            }
        }
    }
}

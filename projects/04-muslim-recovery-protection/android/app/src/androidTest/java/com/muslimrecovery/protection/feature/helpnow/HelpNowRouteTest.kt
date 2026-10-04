package com.muslimrecovery.protection.feature.helpnow

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import android.text.TextUtils
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.Text
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.printToString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import kotlinx.coroutines.delay
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * Instrumented evidence for F3 (compiled in CI; the emulator job must list this class, see the task record).
 * Uses a paused test clock (autoAdvance = false) because the timer and breathing guide are intentionally
 * long-running effects; time is advanced explicitly together with the injected fake monotonic clock.
 */
@RunWith(AndroidJUnit4::class)
class HelpNowRouteTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private class FakeClock(var now: Long = 5_000L) : MonotonicClock {
        override fun nowMillis(): Long = now
    }

    private val clock = FakeClock()
    private val controller = HelpNowController(clock)
    private var closed = 0
    private val sentinel = "SENTINEL-PERSONAL-TEXT-7731"

    private fun str(@StringRes id: Int, vararg args: Any): String = rule.activity.getString(id, *args)

    private fun frame(millis: Long = 300) = rule.mainClock.advanceTimeBy(millis)

    private fun contextFor(tag: String): Context {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val locale = Locale.forLanguageTag(tag)
        val config = Configuration(base.resources.configuration)
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

    private fun setRoute(
        reduceMotion: Boolean = true,
        fontScale: Float = 1f,
        localeTag: String? = null,
        personal: PersonalSupportSource? = null,
        trusted: (() -> Unit)? = null,
        slot: (@Composable () -> Unit)? = null,
    ) {
        rule.mainClock.autoAdvance = false
        val localized = localeTag?.let { contextFor(it) }
        val direction = localeTag?.let { directionFor(it) }
        rule.setContent {
            val density = LocalDensity.current
            val route: @Composable () -> Unit = {
                TabsiraTheme(ThemeMode.LIGHT) {
                    HelpNowRoute(
                        controller = controller,
                        onClose = { closed++ },
                        personalSupport = personal,
                        trustedPerson = trusted,
                        qualifiedHelpSlot = slot,
                        reduceMotion = reduceMotion,
                    )
                }
            }
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                if (localized != null && direction != null) {
                    CompositionLocalProvider(
                        LocalContext provides localized,
                        LocalConfiguration provides localized.resources.configuration,
                        LocalLayoutDirection provides direction,
                    ) { route() }
                } else {
                    route()
                }
            }
        }
        frame()
    }

    private fun click(text: String) {
        rule.onNodeWithText(text).performScrollTo().performClick()
        frame()
    }

    private fun toStepPhase() = click(str(R.string.helpnow_action_skip))

    private fun timerIs(clockText: String) =
        rule.onNodeWithTag(HelpNowTags.TIMER).assertContentDescriptionEquals(str(R.string.helpnow_timer_description, clockText))

    @Test
    fun theGenericFlowWorksWithNoStoreFromNeedToDone() {
        setRoute()
        rule.onNodeWithText(str(R.string.helpnow_need_heading)).assertIsDisplayed()
        toStepPhase()
        rule.onNodeWithText(str(R.string.helpnow_step_slowbreathing_title)).assertIsDisplayed()
        click(str(R.string.helpnow_action_step_done))
        rule.onNodeWithText(str(R.string.helpnow_reflect_heading)).assertIsDisplayed()
        click(str(R.string.helpnow_action_continue))
        rule.onNodeWithText(str(R.string.helpnow_reassess_heading)).assertIsDisplayed()
        click(str(R.string.helpnow_reassess_lighter))
        rule.onNodeWithText(str(R.string.helpnow_done_heading)).assertIsDisplayed()
        assertEquals("finishing the flow is not leaving", 0, closed)
    }

    @Test
    fun selectingNeedsInfluencesTheStep() {
        setRoute()
        click(str(R.string.helpnow_need_movement))
        click(str(R.string.helpnow_action_continue))
        rule.onNodeWithText(str(R.string.helpnow_step_shortwalk_title)).assertIsDisplayed()
    }

    @Test
    fun theTimerFollowsTheInjectedClockAndShowsFinishedAtExpiry() {
        setRoute()
        toStepPhase()
        timerIs("1:30")
        rule.onNodeWithTag(HelpNowTags.TIMER_FINISHED).assertDoesNotExist()
        clock.now += 30_000L
        frame()
        timerIs("1:00")
        clock.now += 61_000L
        frame()
        timerIs("0:00")
        rule.onNodeWithTag(HelpNowTags.TIMER_FINISHED).assertExists()
        rule.onNodeWithText(str(R.string.helpnow_timer_finished)).assertExists()
    }

    @Test
    fun aTimerExpiredWhileAwayShowsFinishedOnReturn() {
        setRoute()
        toStepPhase()
        clock.now += 20 * 60_000L // no ticks needed: the next composition reads the absolute deadline
        frame()
        timerIs("0:00")
        rule.onNodeWithTag(HelpNowTags.TIMER_FINISHED).assertExists()
    }

    @Test
    fun changingTheDurationUsesTheChosenLength() {
        setRoute()
        toStepPhase()
        click(str(R.string.helpnow_duration_option, 120))
        timerIs("2:00")
        click(str(R.string.helpnow_duration_option, 60))
        timerIs("1:00")
    }

    @Test
    fun theTimerAndPhaseSurviveActivityRecreation() {
        rule.mainClock.autoAdvance = false
        fun show(activity: ComponentActivity) {
            val vm = ViewModelProvider(activity, HelpNowViewModel.factory(clock))[HelpNowViewModel::class.java]
            activity.setContent {
                TabsiraTheme(ThemeMode.LIGHT) { HelpNowRoute(vm.controller, onClose = {}, reduceMotion = true) }
            }
        }
        rule.activityRule.scenario.onActivity { show(it) }
        frame()
        toStepPhase()
        clock.now += 20_000L
        frame()
        timerIs("1:10")
        rule.activityRule.scenario.recreate()
        rule.activityRule.scenario.onActivity { show(it) }
        frame()
        rule.onNodeWithText(str(R.string.helpnow_step_slowbreathing_title)).assertIsDisplayed()
        timerIs("1:10")
        clock.now += 70_000L
        frame()
        timerIs("0:00")
    }

    @Test
    fun leavingNeedsNoConfirmationInAnyPhase() {
        setRoute()
        val leave = str(R.string.helpnow_action_leave)
        fun leaveNow(expected: Int) {
            rule.onAllNodesWithText(leave)[0].performClick()
            frame()
            assertEquals(expected, closed)
        }
        leaveNow(1) // Need
        toStepPhase()
        leaveNow(2) // Step
        click(str(R.string.helpnow_action_step_done))
        leaveNow(3) // Reflect
        click(str(R.string.helpnow_action_continue))
        leaveNow(4) // Reassess
        click(str(R.string.helpnow_reassess_lighter))
        leaveNow(5) // Done
        // no confirmation dialog was ever shown
        rule.onAllNodesWithText(str(R.string.common_cancel)).assertCountEquals(0)
        rule.onAllNodesWithText(str(R.string.common_ok)).assertCountEquals(0)
    }

    @Test
    fun systemBackClosesImmediately() {
        setRoute()
        toStepPhase()
        rule.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        frame()
        assertEquals(1, closed)
    }

    @Test
    fun aLockedUnavailableThrowingOrHangingStoreShowsNoPersonalTextAndTheFlowStillWorks() {
        val sources = listOf(
            PersonalSupportSource { PersonalSupport.Locked },
            PersonalSupportSource { PersonalSupport.Unavailable },
            PersonalSupportSource { error("store failure") },
            PersonalSupportSource { delay(60_000L); PersonalSupport.Open(listOf(sentinel), listOf(sentinel)) },
        )
        for (source in sources) {
            val c = HelpNowController(clock)
            rule.mainClock.autoAdvance = false
            rule.activityRule.scenario.onActivity {
                it.setContent {
                    TabsiraTheme(ThemeMode.LIGHT) { HelpNowRoute(c, onClose = {}, personalSupport = source, reduceMotion = true) }
                }
            }
            frame(2_000) // past the personal-tier timeout
            rule.onNodeWithText(str(R.string.helpnow_action_skip)).performClick()
            frame()
            assertNoSentinel()
            rule.onNodeWithText(str(R.string.helpnow_action_step_done)).performScrollTo().performClick()
            frame()
            assertNoSentinel()
            rule.onNodeWithText(str(R.string.helpnow_reflect_heading)).assertIsDisplayed()
            rule.onNodeWithText(str(R.string.helpnow_personal_reasons_heading)).assertDoesNotExist()
            rule.onNodeWithText(str(R.string.helpnow_personal_steps_heading)).assertDoesNotExist()
        }
    }

    private fun assertNoSentinel() {
        val tree = rule.onRoot(useUnmergedTree = true).printToString(Int.MAX_VALUE)
        assertFalse("personal text leaked into the semantics tree", tree.contains(sentinel))
        assertEquals(0, rule.onAllNodesWithText(sentinel, substring = true, useUnmergedTree = true).fetchSemanticsNodes().size)
    }

    @Test
    fun anOpenStoreShowsYourStepsAndYourReasonsAsADistinctSection() {
        setRoute(personal = { PersonalSupport.Open(listOf("reason-one-$sentinel"), listOf("step-one-$sentinel")) })
        frame(100)
        toStepPhase()
        rule.onNodeWithText(str(R.string.helpnow_personal_steps_heading)).assertExists()
        rule.onNodeWithText("step-one-$sentinel").assertExists()
        click(str(R.string.helpnow_action_step_done))
        rule.onNodeWithText(str(R.string.helpnow_personal_reasons_heading)).assertExists()
        rule.onNodeWithText("reason-one-$sentinel").assertExists()
    }

    @Test
    fun stillStrongOffersAnotherStepAndOnlyTheProvidedSlots() {
        var trustedClicks = 0
        setRoute(trusted = { trustedClicks++ }, slot = { Text("SLOT-CONTENT") })
        toStepPhase()
        click(str(R.string.helpnow_action_step_done))
        click(str(R.string.helpnow_action_continue))
        rule.onNodeWithText(str(R.string.helpnow_trusted_person_action)).assertDoesNotExist()
        click(str(R.string.helpnow_reassess_strong))
        rule.onNodeWithText(str(R.string.helpnow_qualified_help)).assertExists()
        rule.onNodeWithText("SLOT-CONTENT").assertExists()
        click(str(R.string.helpnow_trusted_person_action))
        assertEquals(1, trustedClicks)
        click(str(R.string.helpnow_strong_another))
        rule.onNodeWithText(str(R.string.helpnow_step_waterandstretch_title)).assertIsDisplayed()
        timerIs("1:30")
    }

    @Test
    fun withoutProvidedSlotsNoTrustedPersonOrEmergencyContentAppears() {
        setRoute()
        toStepPhase()
        click(str(R.string.helpnow_action_step_done))
        click(str(R.string.helpnow_action_continue))
        click(str(R.string.helpnow_reassess_strong))
        rule.onNodeWithText(str(R.string.helpnow_trusted_person_action)).assertDoesNotExist()
        rule.onNodeWithText("SLOT-CONTENT").assertDoesNotExist()
    }

    @Test
    fun breathingIsStaticTextWithReduceMotionAndAnimatedWithATextCueOtherwise() {
        setRoute(reduceMotion = true)
        toStepPhase()
        rule.onNodeWithTag(HelpNowTags.BREATHING_STATIC).assertExists()
        rule.onNodeWithTag(HelpNowTags.BREATHING_ANIMATED).assertDoesNotExist()
    }

    @Test
    fun theAnimatedGuideAlwaysCarriesATextCue() {
        setRoute(reduceMotion = false)
        toStepPhase()
        rule.onNodeWithTag(HelpNowTags.BREATHING_ANIMATED).assertExists()
        rule.onNodeWithText(str(R.string.helpnow_breathe_in)).assertExists()
        frame(4_500)
        rule.onNodeWithText(str(R.string.helpnow_breathe_out)).assertExists()
    }

    @Test
    fun headingsArePoliteLiveRegionsAndTheTimerIsNot() {
        setRoute()
        rule.onNodeWithTag(HelpNowTags.PHASE_HEADING)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        toStepPhase()
        rule.onNodeWithTag(HelpNowTags.TIMER)
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.LiveRegion))
    }

    @Test
    fun needOptionsAreCheckboxesAndEveryActionIsAtLeast48dp() {
        setRoute()
        rule.onNodeWithText(str(R.string.helpnow_need_calm))
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox))
            .assertHeightIsAtLeast(48.dp)
        rule.onNodeWithText(str(R.string.helpnow_action_continue)).assertHeightIsAtLeast(48.dp)
        rule.onNodeWithText(str(R.string.helpnow_action_skip)).assertHeightIsAtLeast(48.dp)
        rule.onNodeWithText(str(R.string.helpnow_action_leave)).assertHeightIsAtLeast(48.dp)
    }

    private fun rtlCheck(tag: String, expectRtl: Boolean) {
        setRoute(localeTag = tag)
        val ctx = contextFor(tag)
        rule.onNodeWithText(ctx.getString(R.string.helpnow_need_heading)).assertIsDisplayed()
        val root = rule.onRoot().getBoundsInRoot()
        val leave = rule.onNodeWithText(ctx.getString(R.string.helpnow_action_leave)).getBoundsInRoot()
        val centre = (leave.left + leave.right) / 2f
        val half = root.width / 2f
        assertTrue("$tag: Leave sits at the end edge (rtl=$expectRtl)", if (expectRtl) centre < half else centre > half)
        rule.onNodeWithText(ctx.getString(R.string.helpnow_action_skip)).performClick()
        frame()
        // OD-F3-1 neutral default: Latin digits in every locale (temporary, not final policy)
        rule.onNodeWithTag(HelpNowTags.TIMER).assertContentDescriptionEquals(ctx.getString(R.string.helpnow_timer_description, "1:30"))
    }

    @Test
    fun englishIsLeftToRightWithLatinTimerDigits() = rtlCheck("en", expectRtl = false)

    @Test
    fun arabicMirrorsAndKeepsTheNeutralTimerNumerals() = rtlCheck("ar", expectRtl = true)

    @Test
    fun germanIsLeftToRightWithLatinTimerDigits() = rtlCheck("de", expectRtl = false)

    private fun noClipping(tag: String) {
        setRoute(fontScale = 2f, localeTag = tag)
        val ctx = contextFor(tag)
        fun assertWraps(nodeTag: String) {
            val results = mutableListOf<TextLayoutResult>()
            val node = rule.onNodeWithTag(nodeTag).fetchSemanticsNode()
            val ok = node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results) ?: false
            assertTrue("$tag $nodeTag layout", ok && results.isNotEmpty())
            assertFalse("$tag $nodeTag overflows at 200%", results.first().hasVisualOverflow)
        }
        assertWraps(HelpNowTags.PHASE_HEADING)
        rule.onNodeWithText(ctx.getString(R.string.helpnow_action_skip)).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
        rule.onNodeWithText(ctx.getString(R.string.helpnow_action_continue)).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
        rule.onNodeWithText(ctx.getString(R.string.helpnow_action_skip)).performClick()
        frame()
        assertWraps(HelpNowTags.PHASE_HEADING)
        rule.onNodeWithText(ctx.getString(R.string.helpnow_action_step_done)).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
    }

    @Test
    fun englishDoesNotClipAtTwoHundredPercentFont() = noClipping("en")

    @Test
    fun arabicDoesNotClipAtTwoHundredPercentFont() = noClipping("ar")

    @Test
    fun germanDoesNotClipAtTwoHundredPercentFont() = noClipping("de")
}

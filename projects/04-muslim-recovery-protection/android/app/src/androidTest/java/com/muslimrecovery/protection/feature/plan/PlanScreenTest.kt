package com.muslimrecovery.protection.feature.plan

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * F5 My Plan UI on a device/emulator: the three sections, add/edit/delete with inline confirmation, validation,
 * limits, locked state, recreate during edit, EN/AR/DE, RTL, 200% font scale and semantics. Uses only the in-memory
 * store; nothing is persisted.
 */
@RunWith(AndroidJUnit4::class)
class PlanScreenTest {
    @get:Rule
    val rule = createComposeRule()

    private val base: Context = ApplicationProvider.getApplicationContext()

    private fun contextFor(tag: String): Context {
        val locale = Locale.forLanguageTag(tag)
        val config = Configuration(base.resources.configuration)
        config.setLocales(LocaleList(locale))
        config.setLayoutDirection(locale)
        return base.createConfigurationContext(config)
    }

    private fun isRtl(tag: String) = Locale.forLanguageTag(tag).language == "ar"

    @Composable
    private fun Host(vm: PlanViewModel, tag: String = "en", fontScale: Float = 1f) {
        val context = contextFor(tag)
        val density = LocalDensity.current
        CompositionLocalProvider(
            LocalContext provides context,
            LocalConfiguration provides context.resources.configuration,
            LocalLayoutDirection provides if (isRtl(tag)) LayoutDirection.Rtl else LayoutDirection.Ltr,
            LocalDensity provides Density(density.density, fontScale),
        ) {
            TabsiraTheme(ThemeMode.LIGHT) { PlanRoute(viewModel = vm, onBack = {}) }
        }
    }

    private fun show(store: InMemoryPlanStore, tag: String = "en", fontScale: Float = 1f): PlanViewModel {
        val vm = PlanViewModel(store)
        rule.setContent { Host(vm, tag, fontScale) }
        rule.waitForIdle()
        return vm
    }

    private fun str(id: Int, tag: String = "en", vararg args: Any) = contextFor(tag).getString(id, *args)

    private fun waitForText(text: String) = rule.waitUntil(5_000) { rule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }

    private fun waitGone(text: String) = rule.waitUntil(5_000) { rule.onAllNodesWithText(text).fetchSemanticsNodes().isEmpty() }

    private fun addReason(text: String) {
        rule.onNodeWithTag(PlanTags.add(PlanSection.REASONS)).performScrollTo().performClick()
        rule.onNodeWithTag(PlanTags.PRIMARY_FIELD).performScrollTo().performTextInput(text)
        rule.onNodeWithTag(PlanTags.SAVE).performScrollTo().performClick()
    }

    @Test
    fun emptyStatesAreShownForAllThreeSections() {
        show(InMemoryPlanStore())
        for (section in PlanSection.values()) rule.onNodeWithTag(PlanTags.empty(section)).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun addEditAndDeleteAReasonWithInlineConfirmation() {
        show(InMemoryPlanStore())
        addReason("my family")
        waitForText("my family")
        // edit
        rule.onNodeWithContentDescription(str(R.string.plan_edit_item_description, "en", "my family")).performScrollTo().performClick()
        rule.onNodeWithTag(PlanTags.PRIMARY_FIELD).performScrollTo().performTextInput(" and my health")
        rule.onNodeWithTag(PlanTags.SAVE).performScrollTo().performClick()
        waitForText("my family and my health")
        // delete: Keep is reversible
        rule.onNodeWithContentDescription(str(R.string.plan_delete_item_description, "en", "my family and my health")).performScrollTo().performClick()
        rule.onNodeWithText(str(R.string.plan_delete_confirm)).assertExists()
        rule.onNodeWithTag(PlanTags.KEEP).performScrollTo().performClick()
        rule.onNodeWithText("my family and my health").assertExists()
        // delete: confirm removes it
        rule.onNodeWithContentDescription(str(R.string.plan_delete_item_description, "en", "my family and my health")).performScrollTo().performClick()
        rule.onNodeWithTag(PlanTags.CONFIRM_DELETE).performScrollTo().performClick()
        waitGone("my family and my health")
        rule.onNodeWithTag(PlanTags.empty(PlanSection.REASONS)).assertExists()
    }

    @Test
    fun whitespaceOnlyInputShowsAnInlineMessageAndSavesNothing() {
        val store = InMemoryPlanStore()
        show(store)
        addReason("   ")
        rule.onNodeWithText(str(R.string.plan_error_empty)).assertExists()
        assertTrue((store.access.value as PlanAccess.Open).snapshot.reasons.isEmpty())
    }

    @Test
    fun ifThenPlanHasTwoFieldsAndShowsIfAndThen() {
        show(InMemoryPlanStore())
        rule.onNodeWithTag(PlanTags.add(PlanSection.IF_THEN)).performScrollTo().performClick()
        rule.onNodeWithTag(PlanTags.PRIMARY_FIELD).performScrollTo().performTextInput("I feel alone")
        rule.onNodeWithTag(PlanTags.SAVE).performScrollTo().performClick()
        rule.onNodeWithText(str(R.string.plan_error_empty)).assertExists() // the "then" field is required
        rule.onNodeWithTag(PlanTags.SECONDARY_FIELD).performScrollTo().performTextInput("call someone")
        rule.onNodeWithTag(PlanTags.SAVE).performScrollTo().performClick()
        waitForText(str(R.string.plan_if_label, "en", "I feel alone"))
        rule.onNodeWithText(str(R.string.plan_then_label, "en", "call someone")).assertExists()
    }

    @Test
    fun lockedStoreShowsNoPlanTextAnywhere() {
        val sentinel = "SENTINEL-plan-text"
        val store = InMemoryPlanStore(PlanSnapshot(reasons = listOf(Reason(1, sentinel)), steps = listOf(SupportStep(2, sentinel))))
        show(store)
        assertEquals(2, rule.onAllNodesWithText(sentinel, substring = true).fetchSemanticsNodes().size)
        store.setLocked()
        rule.waitUntil(5_000) { rule.onAllNodesWithText(str(R.string.plan_locked_title)).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithTag(PlanTags.LOCKED).assertIsDisplayed()
        assertEquals(0, rule.onAllNodesWithText(sentinel, substring = true).fetchSemanticsNodes().size)
        store.setUnavailable()
        rule.waitForIdle()
        assertEquals(0, rule.onAllNodesWithText(sentinel, substring = true).fetchSemanticsNodes().size)
    }

    @Test
    fun limitMessageAppearsAtTwentyItemsAndAddIsDisabled() {
        val steps = (1L..20L).map { SupportStep(it, "step $it") }
        show(InMemoryPlanStore(PlanSnapshot(steps = steps)))
        rule.onNodeWithText(str(R.string.plan_limit_reached, "en", PlanLimits.MAX_ITEMS)).performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag(PlanTags.add(PlanSection.STEPS)).performScrollTo().assertIsNotEnabled()
        rule.onNodeWithTag(PlanTags.add(PlanSection.REASONS)).performScrollTo().assertIsEnabled()
    }

    @Test
    fun theDraftSurvivesRecreateBecauseTheHolderOutlivesTheComposition() {
        val vm = PlanViewModel(InMemoryPlanStore())
        val tester = StateRestorationTester(rule)
        tester.setContent { Host(vm) }
        rule.waitForIdle()
        rule.onNodeWithTag(PlanTags.add(PlanSection.STEPS)).performScrollTo().performClick()
        rule.onNodeWithTag(PlanTags.PRIMARY_FIELD).performScrollTo().performTextInput("half written")
        tester.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
        rule.onNodeWithTag(PlanTags.PRIMARY_FIELD).performScrollTo().assertTextContains("half written")
    }

    @Test
    fun headingAndActionSemanticsAreExposed() {
        show(InMemoryPlanStore(PlanSnapshot(reasons = listOf(Reason(1, "family")))))
        rule.onNodeWithText(str(R.string.plan_title)).assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        rule.onNodeWithText(str(R.string.plan_section_reasons_title)).assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        rule.onNodeWithContentDescription(str(R.string.plan_edit_item_description, "en", "family")).assertHasClickAction()
        rule.onNodeWithContentDescription(str(R.string.plan_delete_item_description, "en", "family")).assertHasClickAction()
    }

    private fun renderInEveryLanguageAtLargeFont(tag: String) {
        val store = InMemoryPlanStore(
            PlanSnapshot(
                reasons = listOf(Reason(1, "Datenschutzerklärung akzeptieren und fortfahren lange Zeile")),
                ifThenPlans = listOf(IfThenPlan(1, "a long situation text", "a long action text")),
            ),
        )
        show(store, tag, fontScale = 2f)
        val root = rule.onNodeWithTag(PlanTags.SCREEN).getBoundsInRoot()
        val title = rule.onNodeWithText(str(R.string.plan_title, tag)).getBoundsInRoot()
        if (isRtl(tag)) {
            assertTrue("RTL: the title sits at the start (right) edge", title.left > root.width / 2)
        } else {
            assertTrue("LTR: the title sits at the start (left) edge", title.left < root.width / 2)
        }
        for (section in PlanSection.values()) {
            rule.onNodeWithTag(PlanTags.add(section)).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
        }
        rule.onNodeWithTag(PlanTags.add(PlanSection.REASONS)).performScrollTo().performClick()
        rule.onNodeWithTag(PlanTags.SAVE).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
        rule.onNodeWithTag(PlanTags.CANCEL).performScrollTo().assertIsDisplayed().assertHeightIsAtLeast(48.dp)
    }

    @Test
    fun englishAt200PercentFont() = renderInEveryLanguageAtLargeFont("en")

    @Test
    fun arabicRtlAt200PercentFont() = renderInEveryLanguageAtLargeFont("ar")

    @Test
    fun germanAt200PercentFont() = renderInEveryLanguageAtLargeFont("de")
}

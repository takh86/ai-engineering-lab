package com.muslimrecovery.protection.core.design

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsSelectable
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.components.PrimaryButton
import com.muslimrecovery.protection.core.design.components.SecondaryButton
import com.muslimrecovery.protection.core.design.components.SelectableOption
import com.muslimrecovery.protection.core.design.components.TabsiraTextField
import com.muslimrecovery.protection.core.design.components.TextAction
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Touch targets, semantics (role, state, label) and 200% font scale on representative primitives, light and dark. */
@RunWith(AndroidJUnit4::class)
class ComponentSemanticsTest {
    @get:Rule
    val rule = createComposeRule()

    private val germanLong = "Datenschutzerklärung akzeptieren und fortfahren"

    private fun showAll(mode: ThemeMode, fontScale: Float = 1f, narrow: Boolean = false) {
        rule.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                TabsiraTheme(mode) {
                    // Hosted in a scrolling column like a real screen (TabsiraScreen(scrollable = true)): at 200% the
                    // content is taller than the viewport, and a non-scrolling column would squeeze the last rows.
                    Column((if (narrow) Modifier.width(220.dp) else Modifier).verticalScroll(rememberScrollState())) {
                        PrimaryButton(if (narrow) germanLong else "Primary", onClick = {}, modifier = Modifier.testTag("primary"))
                        PrimaryButton("Off", onClick = {}, enabled = false, modifier = Modifier.testTag("off"))
                        SecondaryButton(if (narrow) germanLong else "Secondary", onClick = {}, modifier = Modifier.testTag("secondary"))
                        TextAction(if (narrow) germanLong else "Action", onClick = {}, modifier = Modifier.testTag("action"))
                        SelectableOption(if (narrow) germanLong else "Radio", selected = true, onClick = {}, modifier = Modifier.testTag("radio"))
                        SelectableOption("Check", selected = false, onClick = {}, multiSelect = true, modifier = Modifier.testTag("check"))
                        TabsiraTextField("value", onValueChange = {}, label = "Label", modifier = Modifier.testTag("field"), errorText = "Bad input")
                    }
                }
            }
        }
    }

    private val tags = listOf("primary", "off", "secondary", "action", "radio", "check")

    @Test
    fun interactivePrimitivesMeetTheMinimumTouchTargetInLight() = touchTargets(ThemeMode.LIGHT)

    @Test
    fun interactivePrimitivesMeetTheMinimumTouchTargetInDark() = touchTargets(ThemeMode.DARK)

    private fun touchTargets(mode: ThemeMode) {
        showAll(mode)
        for (tag in tags) {
            rule.onNodeWithTag(tag).assertHeightIsAtLeast(48.dp).assertWidthIsAtLeast(48.dp)
        }
    }

    @Test
    fun buttonsExposeRoleEnabledStateAndAClickAction() {
        showAll(ThemeMode.LIGHT)
        for (tag in listOf("primary", "secondary", "action")) {
            rule.onNodeWithTag(tag)
                .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
                .assertHasClickAction().assertIsEnabled()
        }
        rule.onNodeWithTag("off").assertIsNotEnabled()
    }

    @Test
    fun selectableOptionsExposeRoleAndStateNotJustColor() {
        showAll(ThemeMode.LIGHT)
        rule.onNodeWithTag("radio").assertIsSelectable().assertIsSelected()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton))
        rule.onNodeWithTag("check").assertIsOff()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox))
    }

    @Test
    fun anErrorFieldShowsALabelAMessageAndAnIconNotJustAColor() {
        showAll(ThemeMode.DARK)
        rule.onNodeWithText("Label").assertExists()
        rule.onNodeWithText("Bad input").assertExists()
        rule.onNodeWithContentDescription("Error").assertExists()
    }

    @Test
    fun labelsWrapWithoutClippingAtTwoHundredPercentFontScale() {
        showAll(ThemeMode.LIGHT, fontScale = 2f, narrow = true)
        val nodes = rule.onAllNodesWithText(germanLong)
        val diagnostics = mutableListOf<String>()
        for (i in 0 until 4) {
            val results = mutableListOf<TextLayoutResult>()
            val node = nodes[i].fetchSemanticsNode()
            val ok = node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results) ?: false
            assertTrue("text layout available for node $i", ok && results.isNotEmpty())
            val layout = results.first()
            diagnostics += "node $i: lines=${layout.lineCount} size=${layout.size} " +
                "paragraphWidth=${layout.multiParagraph.width} overflow=${layout.hasVisualOverflow} " +
                "overflowW=${layout.didOverflowWidth} overflowH=${layout.didOverflowHeight}"
            assertTrue("node $i must wrap onto several lines instead of truncating: $diagnostics", layout.lineCount >= 2)
        }
        val overflowing = diagnostics.filter { it.contains("overflow=true") }
        assertTrue("clipped text at 200%: $diagnostics", overflowing.isEmpty())
        for (tag in listOf("primary", "secondary", "action", "radio")) {
            rule.onNodeWithTag(tag).assertHeightIsAtLeast(48.dp)
        }
    }
}

package com.muslimrecovery.protection.core.design

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import android.text.TextUtils
import android.view.View
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.components.SELECTABLE_OPTION_LABEL_TAG
import com.muslimrecovery.protection.core.design.components.SELECTABLE_OPTION_MARKER_TAG
import com.muslimrecovery.protection.core.design.components.SelectableOption
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * Runtime evidence for EN fallback, Arabic RTL and German: the real resources resolve per locale and the
 * primitives mirror (the selection marker sits at the start edge in either direction).
 */
@RunWith(AndroidJUnit4::class)
class LocaleAndRtlTest {
    @get:Rule
    val rule = createComposeRule()

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

    private fun setLocalized(tag: String, content: @Composable () -> Unit) {
        val context = contextFor(tag)
        val direction = directionFor(tag)
        rule.setContent {
            CompositionLocalProvider(
                LocalContext provides context,
                LocalConfiguration provides context.resources.configuration,
                LocalLayoutDirection provides direction,
            ) {
                TabsiraTheme(ThemeMode.LIGHT) { content() }
            }
        }
    }

    private fun assertMirrored(tag: String, label: String) {
        setLocalized(tag) {
            Column {
                SelectableOption(label = stringResource(R.string.common_cancel), selected = true, onClick = {})
            }
        }
        rule.onNodeWithText(label).assertIsDisplayed()
        val marker = rule.onNodeWithTag(SELECTABLE_OPTION_MARKER_TAG, useUnmergedTree = true).getBoundsInRoot()
        val text = rule.onNodeWithTag(SELECTABLE_OPTION_LABEL_TAG, useUnmergedTree = true).getBoundsInRoot()
        if (directionFor(tag) == LayoutDirection.Rtl) {
            assertTrue("RTL: the marker must sit to the right of (after) the label", marker.left > text.left)
        } else {
            assertTrue("LTR: the marker must sit to the left of the label", marker.left < text.left)
        }
    }

    @Test
    fun englishIsLeftToRightWithEnglishStrings() = assertMirrored("en", "Cancel")

    @Test
    fun germanIsLeftToRightWithGermanStrings() = assertMirrored("de", "Abbrechen")

    @Test
    fun arabicIsRightToLeftWithArabicStringsAndAMirroredLayout() = assertMirrored("ar", "إلغاء")

    @Test
    fun everyCommonStringResolvesInEveryLocaleAndTheTranslationsDiffer() {
        val ids = listOf(
            R.string.common_ok, R.string.common_cancel, R.string.common_back, R.string.common_close,
            R.string.common_error_icon_description,
        )
        val english = contextFor("en")
        for (tag in listOf("ar", "de")) {
            val localized = contextFor(tag)
            for (id in ids) {
                val text = localized.getString(id)
                assertTrue("$tag ${localized.resources.getResourceEntryName(id)} is empty", text.isNotBlank())
            }
            assertNotEquals("$tag cancel must be translated", english.getString(R.string.common_cancel), localized.getString(R.string.common_cancel))
            assertNotEquals("$tag back must be translated", english.getString(R.string.common_back), localized.getString(R.string.common_back))
        }
        assertNotEquals(english.getString(R.string.common_ok), contextFor("ar").getString(R.string.common_ok))
    }

    @Test
    fun thePlaceholderAppNameIsIdenticalInEveryLocale() {
        val name = contextFor("en").getString(R.string.app_name)
        for (tag in listOf("ar", "de")) assertEquals(name, contextFor(tag).getString(R.string.app_name))
    }

    @Test
    fun anUnsupportedLocaleFallsBackToEnglishResources() {
        // French is not shipped: the unqualified English resources are the fallback.
        assertEquals("Cancel", contextFor("fr").getString(R.string.common_cancel))
    }
}

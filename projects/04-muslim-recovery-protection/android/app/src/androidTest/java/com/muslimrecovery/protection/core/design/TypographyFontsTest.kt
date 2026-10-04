package com.muslimrecovery.protection.core.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import com.muslimrecovery.protection.core.design.type.BodyFontFamily
import com.muslimrecovery.protection.core.design.type.HeadingFontFamily
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The theme's real typography on a device: headings, titles and buttons are Cairo Bold, body text is Tajawal Regular. */
@RunWith(AndroidJUnit4::class)
class TypographyFontsTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun headingsAndButtonsUseCairoBoldAndBodyUsesTajawal() {
        var typography: Typography? = null
        rule.setContent { TabsiraTheme(ThemeMode.LIGHT) { typography = MaterialTheme.typography } }
        rule.waitForIdle()
        val t = checkNotNull(typography)
        for (style in listOf(t.headlineLarge, t.headlineMedium, t.titleLarge, t.titleMedium, t.labelLarge)) {
            assertSame("heading/title/button style must use Cairo Bold", HeadingFontFamily, style.fontFamily)
            assertEquals(700, style.fontWeight?.weight)
        }
        for (style in listOf(t.bodyLarge, t.bodyMedium, t.bodySmall)) {
            assertSame("body style must use Tajawal Regular", BodyFontFamily, style.fontFamily)
            assertEquals(400, style.fontWeight?.weight)
        }
        assertNotEquals(HeadingFontFamily, BodyFontFamily)
    }
}

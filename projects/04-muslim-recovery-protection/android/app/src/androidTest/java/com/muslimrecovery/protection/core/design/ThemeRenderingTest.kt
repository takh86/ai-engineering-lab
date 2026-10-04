package com.muslimrecovery.protection.core.design

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.theme.BrandPalette
import com.muslimrecovery.protection.core.design.theme.ColorTokens
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Runtime evidence for Light, Dark and SYSTEM: the real rendered background and the full Material3 scheme. */
@RunWith(AndroidJUnit4::class)
class ThemeRenderingTest {
    @get:Rule
    val rule = createComposeRule()

    private var mode by mutableStateOf(ThemeMode.LIGHT)
    private var captured: ColorScheme? = null

    @Before
    fun setUp() {
        rule.setContent {
            TabsiraTheme(themeMode = mode) {
                captured = MaterialTheme.colorScheme
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).testTag("bg"))
            }
        }
    }

    private fun select(newMode: ThemeMode): ColorScheme {
        rule.runOnIdle { mode = newMode }
        rule.waitForIdle()
        return checkNotNull(captured)
    }

    private fun renderedBackground(): Int {
        val bitmap = rule.onNodeWithTag("bg").captureToImage().asAndroidBitmap()
        return bitmap.getPixel(bitmap.width / 2, bitmap.height / 2)
    }

    @Test
    fun lightAndDarkMapTheTokensAndRenderTheirBackground() {
        for ((themeMode, tokens) in listOf(ThemeMode.LIGHT to ColorTokens.Light, ThemeMode.DARK to ColorTokens.Dark)) {
            val scheme = select(themeMode)
            assertEquals(Color(tokens.background), scheme.background)
            assertEquals(Color(tokens.surface), scheme.surface)
            assertEquals(Color(tokens.primary), scheme.primary)
            assertEquals(Color(tokens.onPrimary), scheme.onPrimary)
            assertEquals(Color(tokens.textPrimary), scheme.onSurface)
            assertEquals("$themeMode rendered pixel", tokens.background.toInt(), renderedBackground())
        }
    }

    @Test
    fun systemFollowsTheDeviceNightMode() {
        val night = InstrumentationRegistry.getInstrumentation().targetContext.resources.configuration.uiMode and
            Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        val expected = if (night) ColorTokens.Dark else ColorTokens.Light
        assertEquals(Color(expected.background), select(ThemeMode.SYSTEM).background)
    }

    @Test
    fun everyMaterialSlotIsABrandColorInBothThemes() {
        for (themeMode in listOf(ThemeMode.LIGHT, ThemeMode.DARK)) {
            val scheme = select(themeMode)
            val slots = ColorScheme::class.java.declaredMethods.filter {
                it.parameterCount == 0 && it.returnType == java.lang.Long.TYPE && it.name.startsWith("get")
            }
            // material3 1.3.2 exposes exactly the 36 constructor slots; fewer would mean the reflection missed some.
            assertTrue("expected the complete Material3 slot set, saw ${slots.size}", slots.size >= 36)
            for (slot in slots) {
                val packed = slot.invoke(scheme) as Long
                val argb = packed ushr 32
                val transparent = argb == 0L
                val brand = (argb or 0xFF000000L) in BrandPalette.all && (argb ushr 24) == 0xFFL
                assertTrue("$themeMode ${slot.name} = ${argb.toString(16)} is not a brand color", transparent || brand)
            }
        }
    }

    @Test
    fun theComposedColorsAreOpaqueSrgb() {
        val scheme = select(ThemeMode.DARK)
        assertEquals(0xFF, scheme.primary.toArgb() ushr 24)
    }
}

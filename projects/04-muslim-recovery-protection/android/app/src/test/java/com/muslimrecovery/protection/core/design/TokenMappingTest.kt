package com.muslimrecovery.protection.core.design

import com.muslimrecovery.protection.core.design.theme.BrandPalette
import com.muslimrecovery.protection.core.design.theme.ColorTokens
import com.muslimrecovery.protection.core.design.theme.opaque
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class TokenMappingTest {

    private fun roles(t: ColorTokens): Map<String, Long> = mapOf(
        "background" to t.background, "surface" to t.surface, "surfaceVariant" to t.surfaceVariant,
        "textPrimary" to t.textPrimary, "textSecondary" to t.textSecondary, "primary" to t.primary,
        "onPrimary" to t.onPrimary, "secondary" to t.secondary, "onSecondary" to t.onSecondary,
        "border" to t.border, "borderStrong" to t.borderStrong, "focus" to t.focus,
        "accentGraphic" to t.accentGraphic, "disabledContent" to t.disabledContent, "scrim" to t.scrim,
    )

    @Test
    fun everyRoleIsABrandColorAndOnlyDisabledContentHasAlpha() {
        for ((theme, tokens) in mapOf("light" to ColorTokens.Light, "dark" to ColorTokens.Dark)) {
            for ((role, color) in roles(tokens)) {
                assertTrue("$theme $role is not a brand color: ${color.toString(16)}", color.opaque() in BrandPalette.all)
                if (role == "disabledContent") {
                    assertEquals("$theme disabled alpha 38%", 0x61L, color ushr 24)
                } else {
                    assertEquals("$theme $role must be opaque", 0xFFL, color ushr 24)
                }
            }
        }
    }

    @Test
    fun lightAndDarkAreDefinedForTheSameRolesAndDiffer() {
        assertEquals(roles(ColorTokens.Light).keys, roles(ColorTokens.Dark).keys)
        assertNotEquals(ColorTokens.Light.background, ColorTokens.Dark.background)
        assertNotEquals(ColorTokens.Light.textPrimary, ColorTokens.Dark.textPrimary)
        // The brand stays recognizable in both themes: the lime primary action is identical.
        assertEquals(ColorTokens.Light.primary, ColorTokens.Dark.primary)
        assertEquals(BrandPalette.LIME, ColorTokens.Light.primary)
        assertEquals(BrandPalette.NAVY, ColorTokens.Light.onPrimary)
    }

    @Test
    fun accentGraphicIsSkyAndNotUsedByAnyTextRole() {
        for (t in listOf(ColorTokens.Light, ColorTokens.Dark)) {
            assertEquals(BrandPalette.SKY, t.accentGraphic)
            assertTrue(t.accentGraphic !in listOf(t.textPrimary, t.textSecondary, t.secondary, t.onPrimary, t.onSecondary))
        }
    }

    private fun xmlColor(path: String): Long {
        val xml = File(path).readText()
        val hex = Regex("<color name=\"tabsira_window_background\">#([0-9A-Fa-f]{8})</color>").find(xml)?.groupValues?.get(1)
        return checkNotNull(hex) { "tabsira_window_background missing in $path" }.toLong(16)
    }

    @Test
    fun theXmlWindowBackgroundsEqualTheKotlinTokens() {
        assertEquals(ColorTokens.Light.background, xmlColor("src/main/res/values/design_colors.xml"))
        assertEquals(ColorTokens.Dark.background, xmlColor("src/main/res/values-night/design_colors.xml"))
    }

    @Test
    fun noOtherXmlColorExistsOutsideTheDesignFile() {
        val offenders = File("src").walkTopDown()
            .filter { it.isFile && it.extension == "xml" && "/res/" in it.invariantSeparatorsPath }
            .filter { it.name != "design_colors.xml" }
            .filter { Regex("<color\\b").containsMatchIn(it.readText()) }
            .map { it.invariantSeparatorsPath }.toList()
        assertEquals(emptyList<String>(), offenders)
    }

    @Test
    fun dynamicColorIsNotUsedAnywhereInProductCode() {
        val offenders = File("src").walkTopDown()
            .filter { it.isFile && it.extension == "kt" && !it.invariantSeparatorsPath.startsWith("src/test") && !it.invariantSeparatorsPath.startsWith("src/androidTest") }
            .filter { Regex("dynamic(Light|Dark)ColorScheme").containsMatchIn(it.readText()) }
            .map { it.invariantSeparatorsPath }.toList()
        assertEquals("dynamic color is prohibited (OD-F9-8)", emptyList<String>(), offenders)
    }
}

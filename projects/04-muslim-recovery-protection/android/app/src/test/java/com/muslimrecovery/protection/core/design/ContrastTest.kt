package com.muslimrecovery.protection.core.design

import com.muslimrecovery.protection.core.design.theme.BrandPalette
import com.muslimrecovery.protection.core.design.theme.ColorTokens
import com.muslimrecovery.protection.core.design.theme.Contrast
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.round

/**
 * Reproduces the F9 contract's measured contrast values and enforces the thresholds on every declared pair, light
 * and dark. These are computed WCAG 2.x ratios of the token constants; they are evidence about the tokens, not a
 * claim of accessibility compliance of any screen.
 */
class ContrastTest {

    private fun r2(x: Double) = round(x * 100) / 100

    private data class Case(val name: String, val fg: Long, val bg: Long)

    private fun themes() = mapOf("light" to ColorTokens.Light, "dark" to ColorTokens.Dark)

    private fun textPairs(t: ColorTokens) = listOf(
        Case("textPrimary/background", t.textPrimary, t.background),
        Case("textPrimary/surface", t.textPrimary, t.surface),
        Case("textPrimary/surfaceVariant", t.textPrimary, t.surfaceVariant),
        Case("textSecondary/background", t.textSecondary, t.background),
        Case("textSecondary/surface", t.textSecondary, t.surface),
        Case("textSecondary/surfaceVariant", t.textSecondary, t.surfaceVariant),
        Case("onPrimary/primary", t.onPrimary, t.primary),
        Case("onSecondary/secondary", t.onSecondary, t.secondary),
        Case("secondary(link)/background", t.secondary, t.background),
        Case("secondary(link)/surface", t.secondary, t.surface),
        Case("secondary(link)/surfaceVariant", t.secondary, t.surfaceVariant),
    )

    private fun nonTextPairs(name: String, t: ColorTokens): List<Case> {
        val shared = listOf(
            Case("borderStrong/background", t.borderStrong, t.background),
            Case("borderStrong/surface", t.borderStrong, t.surface),
            Case("focus/background", t.focus, t.background),
            Case("focus/surface", t.focus, t.surface),
        )
        // What identifies the primary button's boundary: on light the lime fill is useless (below 3:1), so its 2dp
        // onPrimary (navy) border carries the boundary; on dark the lime fill itself is at least 3:1.
        val primaryBoundary = if (name == "light") {
            listOf(
                Case("primaryButtonBorder(onPrimary)/background", t.onPrimary, t.background),
                Case("primaryButtonBorder(onPrimary)/surface", t.onPrimary, t.surface),
            )
        } else {
            listOf(
                Case("primaryFill/background", t.primary, t.background),
                Case("primaryFill/surface", t.primary, t.surface),
            )
        }
        return shared + primaryBoundary
    }

    @Test
    fun everyDeclaredTextPairMeetsFourPointFiveToOne() {
        for ((theme, tokens) in themes()) {
            for (p in textPairs(tokens)) {
                val ratio = Contrast.ratio(p.fg, p.bg)
                assertTrue("$theme ${p.name} = ${r2(ratio)} < 4.5", ratio >= 4.5)
            }
        }
    }

    @Test
    fun everyDeclaredNonTextPairMeetsThreeToOne() {
        for ((theme, tokens) in themes()) {
            for (p in nonTextPairs(theme, tokens)) {
                val ratio = Contrast.ratio(p.fg, p.bg)
                assertTrue("$theme ${p.name} = ${r2(ratio)} < 3.0", ratio >= 3.0)
            }
        }
    }

    @Test
    fun theLimeFillIsDistinguishableOnDarkSurfacesButNotOnLight() {
        val dark = ColorTokens.Dark
        assertTrue(Contrast.ratio(dark.primary, dark.background) >= 3.0)
        assertTrue(Contrast.ratio(dark.primary, dark.surface) >= 3.0)
        // Lime on light surfaces is far below 3:1, which is exactly why the primary button always has a border.
        val light = ColorTokens.Light
        assertTrue(Contrast.ratio(light.primary, light.surface) < 3.0)
        assertTrue(Contrast.ratio(light.primary, light.background) < 3.0)
    }

    @Test
    fun theContractsMeasuredValuesAreReproduced() {
        val measured = listOf(
            Triple("navy on white", BrandPalette.NAVY to BrandPalette.WHITE, 10.31),
            Triple("navy on surface", BrandPalette.NAVY to BrandPalette.SURFACE, 9.52),
            Triple("navy on lime", BrandPalette.NAVY to BrandPalette.LIME, 6.97),
            Triple("royal on white", BrandPalette.ROYAL to BrandPalette.WHITE, 6.63),
            Triple("white on royal", BrandPalette.WHITE to BrandPalette.ROYAL, 6.63),
            Triple("white on navy", BrandPalette.WHITE to BrandPalette.NAVY, 10.31),
            Triple("lime on navy", BrandPalette.LIME to BrandPalette.NAVY, 6.97),
            Triple("lime on royal", BrandPalette.LIME to BrandPalette.ROYAL, 4.48),
            Triple("sky on white", BrandPalette.SKY to BrandPalette.WHITE, 3.27),
            Triple("sky on navy", BrandPalette.SKY to BrandPalette.NAVY, 3.15),
            Triple("lime on white", BrandPalette.LIME to BrandPalette.WHITE, 1.48),
            Triple("royal on navy", BrandPalette.ROYAL to BrandPalette.NAVY, 1.56),
        )
        for ((name, colors, expected) in measured) {
            assertEquals(name, expected, r2(Contrast.ratio(colors.first, colors.second)), 0.0101)
        }
    }

    @Test
    fun limeAndSkyAreNeverATextColor() {
        for ((theme, t) in themes()) {
            val textRoles = mapOf(
                "textPrimary" to t.textPrimary, "textSecondary" to t.textSecondary, "secondary" to t.secondary,
                "onPrimary" to t.onPrimary, "onSecondary" to t.onSecondary,
            )
            for ((role, color) in textRoles) {
                assertTrue("$theme $role must not be lime or sky", color != BrandPalette.LIME && color != BrandPalette.SKY)
            }
        }
    }

    @Test
    fun theContrastFunctionItselfIsCorrect() {
        assertEquals(21.0, Contrast.ratio(0xFF000000L, 0xFFFFFFFFL), 1e-9)
        assertEquals(1.0, Contrast.ratio(BrandPalette.NAVY, BrandPalette.NAVY), 1e-9)
    }
}

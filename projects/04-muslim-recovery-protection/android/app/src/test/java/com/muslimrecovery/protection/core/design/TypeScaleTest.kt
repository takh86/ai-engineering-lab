package com.muslimrecovery.protection.core.design

import com.muslimrecovery.protection.core.design.type.TypeScale
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class TypeScaleTest {
    @Test
    fun runningTextKeepsAnArabicFriendlyLineHeight() {
        for (step in TypeScale.bodyStyles) {
            assertTrue("line height ${step.lineHeightSp}/${step.sizeSp} = ${step.ratio} < 1.5", step.ratio >= 1.5)
        }
    }

    @Test
    fun theScaleIsMonotonicAndHasPositiveLeading() {
        val all = listOf(TypeScale.headline, TypeScale.title, TypeScale.body, TypeScale.label, TypeScale.bodySmall)
        assertTrue(TypeScale.headline.sizeSp > TypeScale.title.sizeSp && TypeScale.title.sizeSp > TypeScale.body.sizeSp)
        assertTrue(all.all { it.lineHeightSp > it.sizeSp })
    }

    @Test
    fun typographyNeverUsesPositiveLetterSpacingAndUsesSpOnly() {
        val src = File("src/main/java/com/muslimrecovery/protection/core/design/type/TabsiraTypography.kt").readText()
        assertTrue("letterSpacing must be 0.sp everywhere", Regex("letterSpacing = 0\\.sp").findAll(src).count() >= 2)
        assertTrue("no dp text sizes", !Regex("fontSize = [\\d.]+\\.dp").containsMatchIn(src))
        assertTrue("no all-caps / italic styles", !src.contains("Italic") && !src.contains("uppercase"))
    }

    @Test
    fun bodyFontIsTheBundledTajawalAndHeadingFontIsASinglePlaceholder() {
        val fonts = File("src/main/java/com/muslimrecovery/protection/core/design/type/Fonts.kt").readText()
        assertTrue(fonts.contains("R.font.tajawal_regular"))
        assertTrue("one heading family declaration", Regex("val HeadingFontFamily").findAll(fonts).count() == 1)
        assertTrue("font file is bundled", File("src/main/res/font/tajawal_regular.ttf").length() > 10_000)
        assertTrue("no unproven Cairo asset may be bundled", File("src/main/res/font").listFiles().orEmpty().none { it.name.startsWith("cairo") })
    }
}

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
    fun headingsUseCairoBoldBodyUsesTajawalAndNoDefaultFamilyRemains() {
        val dir = "src/main/java/com/muslimrecovery/protection/core/design/type"
        val fonts = File("$dir/Fonts.kt").readText()
        assertTrue(Regex("val BodyFontFamily[^\\n]*R\\.font\\.tajawal_regular").containsMatchIn(fonts))
        assertTrue(Regex("val HeadingFontFamily[^\\n]*R\\.font\\.cairo_bold").containsMatchIn(fonts))
        assertTrue("no FontFamily.Default placeholder may remain", !fonts.contains("FontFamily.Default"))
        val typography = File("$dir/TabsiraTypography.kt").readText()
        assertTrue("heading styles must use HeadingFontFamily", typography.contains("fontFamily = HeadingFontFamily"))
        assertTrue("body styles must use BodyFontFamily", typography.contains("fontFamily = BodyFontFamily"))
        val everywhere = File("src").walkTopDown().filter { it.isFile && it.extension == "kt" && it.invariantSeparatorsPath.contains("/core/design/") && !it.invariantSeparatorsPath.startsWith("src/test") }
        assertTrue("no design source may use FontFamily.Default", everywhere.none { it.readText().contains("FontFamily.Default") })
        assertTrue("both fonts are bundled", File("src/main/res/font/cairo_bold.ttf").length() > 10_000 && File("src/main/res/font/tajawal_regular.ttf").length() > 10_000)
    }
}

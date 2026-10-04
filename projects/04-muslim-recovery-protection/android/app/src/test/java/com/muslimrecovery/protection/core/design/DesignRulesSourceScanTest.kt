package com.muslimrecovery.protection.core.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class DesignRulesSourceScanTest {
    private val basePath = "com/muslimrecovery/protection/"

    private fun productSources(): List<File> =
        (File("src").listFiles() ?: emptyArray())
            .filter { it.isDirectory && !it.name.startsWith("test") && !it.name.startsWith("androidTest") }
            .flatMap { set ->
                listOf("java", "kotlin").flatMap { dir ->
                    File(set, dir).walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
                }
            }

    private fun rel(file: File): String {
        val normalized = file.invariantSeparatorsPath
        return normalized.substring(normalized.indexOf(basePath) + basePath.length)
    }

    @Test
    fun realProductSourcesFollowTheDesignRules() {
        val files = productSources()
        assertTrue("scan must see sources", files.size >= 10)
        assertTrue("scan must see the design core", files.any { rel(it).startsWith("core/design/") })
        val violations = files.flatMap { DesignRules.violations(rel(it), it.readText()) }
        assertEquals(emptyList<String>(), violations)
    }

    private fun v(path: String, body: String) = DesignRules.violations(path, body)

    @Test
    fun rejectsRawBrandColorsInFeatureCode() {
        assertTrue(v("feature/x/A.kt", "val c = Color(0xFF0B3B8F)").isNotEmpty())
        assertTrue(v("feature/x/A.kt", "val c = 0xff1456c5").isNotEmpty())
        assertTrue(v("app/B.kt", "val lime = 0xFFB7E445").isNotEmpty())
        assertTrue(v("feature/x/A.kt", "val c = Color(0x123456)").isNotEmpty())
    }

    @Test
    fun rejectsFeatureDefinedFonts() {
        assertTrue(v("feature/x/A.kt", "val f = FontFamily(Font(R.font.other))").isNotEmpty())
        assertTrue(v("feature/x/A.kt", "val f = Font (R.font.other)").isNotEmpty())
    }

    @Test
    fun rejectsAbsoluteLeftRightLayoutButAllowsStartEndAndDpLiterals() {
        assertTrue(v("feature/x/A.kt", "Modifier.padding(left = 8.dp)").isNotEmpty())
        assertTrue(v("feature/x/A.kt", "Modifier.absolutePadding(left = 8.dp)").isNotEmpty())
        assertTrue(v("feature/x/A.kt", "textAlign = TextAlign.Right").isNotEmpty())
        assertTrue(v("feature/x/A.kt", "Modifier.align(Alignment.CenterLeft)").isNotEmpty())
        assertEquals(emptyList<String>(), v("feature/x/A.kt", "Modifier.padding(start = 8.dp, end = 4.dp).size(37.dp)"))
        assertEquals(emptyList<String>(), v("feature/x/A.kt", "Modifier.width(213.dp).height(7.dp)"))
    }

    @Test
    fun rejectsOtherColorFormsDirectionalIconsAndHardCodedDirection() {
        for (src in listOf("val c = Color.Red", "val c = Color(255, 0, 0)", "val c = Color(red = 1f)",
            "Color(android.graphics.Color.parseColor(\"#0B3B8F\"))", "val c = 0xFF_0B3B8F")) {
            assertTrue(src, v("feature/x/A.kt", src).isNotEmpty())
        }
        assertTrue(v("feature/x/A.kt", "Icon(Icons.Filled.ArrowBack, null)").isNotEmpty())
        assertEquals(emptyList<String>(), v("feature/x/A.kt", "Icon(Icons.AutoMirrored.Filled.ArrowBack, null)"))
        assertTrue(v("feature/x/A.kt", "CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {}").isNotEmpty())
        assertEquals(emptyList<String>(), v("feature/x/A.kt", "val t = Color.Transparent"))
    }

    @Test
    fun rejectsTheFormsTheRedTeamFound() {
        for (src in listOf("Color(11, 59, 143)", "Color(red = 11, green = 59, blue = 143)", "Color(0.04f, 0.23f, 0.56f)",
            "Color.hsl(1f, 1f, 1f)", "Color(4279516047)", "Color (0xFF000000)", "val x = \"#0B3B8F\"",
            "FontFamily.Serif", "Typeface.create(\"x\", 0)", "typealias F = FontFamily", "GoogleFont(\"x\")",
            "Modifier.padding(top = dimen(2), left = 4.dp)", "Modifier.padding(bottom = calc(2), right = 4.dp)",
            "import androidx.compose.ui.Alignment.Companion.CenterLeft", "TextAlign.Companion.Left", "TextAlign\n.Right",
            "val s = dynamicLightColorScheme(ctx)")) {
            assertTrue(src, v("feature/x/A.kt", src).isNotEmpty())
        }
    }

    @Test
    fun commentsAreIgnoredAndTheDesignCoreIsExempt() {
        assertEquals(emptyList<String>(), v("feature/x/A.kt", "// 0xFF0B3B8F and padding(left = 1.dp)\n/* FontFamily( */ val x = 1"))
        assertEquals(emptyList<String>(), v("core/design/theme/BrandPalette.kt", "const val NAVY = 0xFF0B3B8FL"))
        // components are NOT exempt: they are scanned like features
        assertTrue(v("core/design/components/X.kt", "val c = Color(0xFF123456)").isNotEmpty())
    }
}

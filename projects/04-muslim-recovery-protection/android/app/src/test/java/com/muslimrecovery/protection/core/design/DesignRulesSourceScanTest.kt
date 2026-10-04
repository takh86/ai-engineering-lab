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
            .flatMap { set -> File(set, "java").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList() }

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
    fun commentsAreIgnoredAndTheDesignCoreIsExempt() {
        assertEquals(emptyList<String>(), v("feature/x/A.kt", "// 0xFF0B3B8F and padding(left = 1.dp)\n/* FontFamily( */ val x = 1"))
        assertEquals(emptyList<String>(), v("core/design/theme/BrandPalette.kt", "const val NAVY = 0xFF0B3B8FL"))
    }
}

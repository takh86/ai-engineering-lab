package com.muslimrecovery.protection.localization

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ResourceParityTest {

    private fun xml(vararg lines: String) = "<resources>\n${lines.joinToString("\n")}\n</resources>"

    // --- The real tree. ---

    @Test
    fun everyDefaultStringFileHasCompleteArabicAndGermanTranslations() {
        val res = File("src/main/res")
        val files = ResourceParity.defaultFiles(res)
        assertTrue("expected strings.xml and strings_common.xml, saw ${files.map { it.name }}", files.size >= 2)
        val problems = files.flatMap { file ->
            ResourceParity.problems(
                file.name,
                file.readText(),
                ResourceParity.locales.associateWith { loc -> File(res, "values-$loc/${file.name}").takeIf { it.isFile }?.readText() },
            )
        }
        assertEquals(emptyList<String>(), problems)
    }

    @Test
    fun noTranslationFileExistsWithoutAnEnglishDefault() {
        val res = File("src/main/res")
        val orphans = ResourceParity.locales.flatMap { loc ->
            File(res, "values-$loc").listFiles().orEmpty()
                .filter { it.name.startsWith("strings") && !File(res, "values/${it.name}").isFile }
                .map { "values-$loc/${it.name}" }
        }
        assertEquals(emptyList<String>(), orphans)
    }

    @Test
    fun noUnsupportedLocaleResourcesExist() {
        val res = File("src/main/res")
        val unsupported = res.listFiles().orEmpty()
            .filter { it.isDirectory && it.name.startsWith("values-") }
            .map { it.name }.filter { it !in setOf("values-ar", "values-de", "values-night") && !Regex("^values-v\\d+$").matches(it) }
        assertEquals("only en (default), ar and de are supported", emptyList<String>(), unsupported)
    }

    @Test
    fun theCurrentPlaceholderAppNameIsNotTranslatableAndInternalCopyIsEngineeringOnly() {
        val main = ResourceParity.parse(File("src/main/res/values/strings.xml").readText())
        assertEquals(listOf("app_name"), main.map { it.name })
        assertTrue("app_name must not be rendered into AR/DE as the brand (E6)", main.none { it.translatable })
        val internal = File("src/internal/res/values/strings.xml")
        assertTrue(internal.isFile)
        assertTrue("internal-only copy must be non-translatable", ResourceParity.parse(internal.readText()).none { it.translatable })
        assertTrue("no AR/DE for the placeholder name", !File("src/main/res/values-ar/strings.xml").exists() && !File("src/main/res/values-de/strings.xml").exists())
    }

    @Test
    fun theCommonFileOwnsOnlyGenericWordsWithCommonPrefix() {
        val common = ResourceParity.parse(File("src/main/res/values/strings_common.xml").readText())
        assertTrue(common.isNotEmpty() && common.all { it.name.startsWith("common_") })
    }

    // --- The rules reject known-bad synthetic resources and accept good ones. ---

    private val good = xml("""<string name="x_a">Hello %1${'$'}s</string>""", """<string name="x_b">B</string>""")

    @Test
    fun acceptsACompleteSet() {
        val ar = xml("""<string name="x_a">مرحبا %1${'$'}s</string>""", """<string name="x_b">ب</string>""")
        val de = xml("""<string name="x_a">Hallo %1${'$'}s</string>""", """<string name="x_b">B</string>""")
        assertEquals(emptyList<String>(), ResourceParity.problems("strings_x.xml", good, mapOf("ar" to ar, "de" to de)))
    }

    @Test
    fun rejectsMissingFilesAndMissingKeys() {
        assertTrue(ResourceParity.problems("strings_x.xml", good, mapOf("ar" to null, "de" to null)).size == 2)
        val partial = xml("""<string name="x_a">Hallo %1${'$'}s</string>""")
        val p = ResourceParity.problems("strings_x.xml", good, mapOf("ar" to partial, "de" to partial))
        assertTrue(p.any { it.contains("missing translation 'x_b'") })
    }

    @Test
    fun rejectsPlaceholderMismatchAndDuplicateAndExtraKeys() {
        val bad = xml("""<string name="x_a">Hallo</string>""", """<string name="x_b">B</string>""", """<string name="x_b">B2</string>""", """<string name="x_c">C</string>""")
        val p = ResourceParity.problems("strings_x.xml", good, mapOf("ar" to bad, "de" to bad))
        assertTrue(p.any { it.contains("differs from the default") })
        assertTrue(p.any { it.contains("duplicate keys") })
        assertTrue(p.any { it.contains("extra translation") })
    }

    @Test
    fun rejectsWrongKeyPrefixAndDuplicateDefaults() {
        val wrong = xml("""<string name="home_title">T</string>""", """<string name="home_title">T</string>""")
        val p = ResourceParity.problems("strings_x.xml", wrong, mapOf("ar" to wrong, "de" to wrong))
        assertTrue(p.any { it.contains("must start with 'x_'") })
        assertTrue(p.any { it.contains("duplicate keys") })
    }

    @Test
    fun nonTranslatableDefaultsNeedNoTranslationAndPluralAndArrayShapesAreChecked() {
        val d = xml("""<string name="x_brand" translatable="false">Name</string>""",
            """<plurals name="x_p"><item quantity="one">1</item><item quantity="other">n</item></plurals>""",
            """<string-array name="x_arr"><item>a</item><item>b</item></string-array>""")
        val okLoc = xml("""<plurals name="x_p"><item quantity="one">1</item><item quantity="other">n</item></plurals>""",
            """<string-array name="x_arr"><item>a</item><item>b</item></string-array>""")
        assertEquals(emptyList<String>(), ResourceParity.problems("strings_x.xml", d, mapOf("ar" to okLoc, "de" to okLoc)))
        val shortArray = xml("""<plurals name="x_p"><item quantity="other">n</item></plurals>""", """<string-array name="x_arr"><item>a</item></string-array>""")
        assertTrue(ResourceParity.problems("strings_x.xml", d, mapOf("ar" to shortArray, "de" to okLoc)).any { it.contains("x_arr") })
    }

    @Test
    fun aStringArrayBeforeOtherStringsDoesNotHideThem() {
        val d = xml("""<string-array name="x_arr"><item>a</item></string-array>""", """<string name="x_b">B</string>""", """<string name="x_c">C</string>""")
        val onlyArray = xml("""<string-array name="x_arr"><item>a</item></string-array>""")
        val p = ResourceParity.problems("strings_x.xml", d, mapOf("ar" to onlyArray, "de" to onlyArray))
        assertTrue("x_b must be required", p.any { it.contains("missing translation 'x_b'") })
        assertTrue("x_c must be required", p.any { it.contains("missing translation 'x_c'") })
        assertEquals(listOf("x_arr", "x_b", "x_c"), ResourceParity.parse(d).map { it.name })
    }

    @Test
    fun positionalIndexChangesPluralsAndEmptyOrSelfClosingEntriesAreSeen() {
        val d = xml("""<string name="x_a">%1${'$'}s %2${'$'}s</string>""",
            """<plurals name="x_p"><item quantity="one">%d item</item><item quantity="other">%d items</item></plurals>""",
            """<string name="x_e">Text</string>""")
        val bad = xml("""<string name="x_a">%2${'$'}s %2${'$'}s</string>""",
            """<plurals name="x_p"><item quantity="one">item</item></plurals>""",
            """<string name="x_e"/>""")
        val p = ResourceParity.problems("strings_x.xml", d, mapOf("ar" to bad, "de" to bad))
        assertTrue(p.any { it.contains("x_a") && it.contains("differs") })
        assertTrue(p.any { it.contains("x_p") && it.contains("differs") })
        assertTrue(p.any { it.contains("x_e") && it.contains("differs") })
        assertEquals(listOf("x_e"), ResourceParity.parse(xml("""<string name="x_e"/>""")).map { it.name })
    }

    @Test
    fun multiWordFeatureFilesGetTheirPrefixRuleAndAreDiscovered() {
        assertEquals("home_screen_", ResourceParity.keyPrefix("strings_home_screen.xml"))
        assertEquals(null, ResourceParity.keyPrefix("strings.xml"))
        val wrong = xml("""<string name="home_a">A</string>""")
        assertTrue(ResourceParity.problems("strings_home_screen.xml", wrong, mapOf("ar" to wrong, "de" to wrong)).any { it.contains("must start with 'home_screen_'") })
    }

    @Test
    fun placeholderComparisonIsOrderInsensitiveForPositionalArgsAndIgnoresLiteralPercent() {
        val a = ResourceParity.parse(xml("""<string name="x_a">%1${'$'}s of %2${'$'}d (100%%)</string>"""))[0].shape
        val b = ResourceParity.parse(xml("""<string name="x_a">%2${'$'}d von %1${'$'}s</string>"""))[0].shape
        assertEquals(a, b)
    }
}

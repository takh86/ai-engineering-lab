package com.muslimrecovery.protection.feature.onboarding

import com.muslimrecovery.protection.localization.ResourceParity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** EN/AR/DE parity and copy hygiene for `strings_onboarding.xml`. Tone and meaning still need the human content review (DRAFT). */
class OnboardingStringsTest {
    private val res = File("src/main/res")
    private val entryPattern = Regex("""<string name="([^"]+)"[^>]*>(.*?)</string>""", RegexOption.DOT_MATCHES_ALL)

    private fun values(dir: String): Map<String, String> =
        entryPattern.findAll(File(res, "$dir/strings_onboarding.xml").readText()).associate { it.groupValues[1] to it.groupValues[2] }

    private val en get() = values("values")
    private val ar get() = values("values-ar")
    private val de get() = values("values-de")

    @Test
    fun threeLanguagesHaveTheSameKeysPlaceholdersAndShapes() {
        val default = File(res, "values/strings_onboarding.xml").readText()
        val problems = ResourceParity.problems(
            "strings_onboarding.xml",
            default,
            ResourceParity.locales.associateWith { File(res, "values-$it/strings_onboarding.xml").readText() },
        )
        assertEquals(emptyList<String>(), problems)
        assertTrue("expected the full copy set, saw ${en.size}", en.size >= 40)
        assertEquals(en.keys, ar.keys)
        assertEquals(en.keys, de.keys)
    }

    @Test
    fun everyKeyIsUsedByTheScreensAndEveryUsedKeyExists() {
        val code = File("src/main/java/com/muslimrecovery/protection/feature/onboarding").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }.joinToString("\n") { it.readText() }
        val used = Regex("""R\.string\.(onboarding_[a-z0-9_]+)""").findAll(code).map { it.groupValues[1] }.toSet()
        assertEquals("keys used but not defined", emptySet<String>(), used - en.keys)
        assertEquals("keys defined but unused (dead copy needs review too)", emptySet<String>(), en.keys - used)
    }

    @Test
    fun translationsAreNotLeftAsTheEnglishText() {
        val sameAllowed = setOf("onboarding_language_english", "onboarding_language_arabic", "onboarding_language_german")
        for ((key, english) in en) {
            if (key in sameAllowed) continue
            assertNotEquals("$key untranslated in ar", english, ar[key])
            assertNotEquals("$key untranslated in de", english, de[key])
        }
    }

    @Test
    fun arabicCopyIsArabicScript() {
        val arabic = Regex("[\\u0600-\\u06FF]")
        for ((key, text) in ar) {
            assertTrue("$key should contain Arabic script", arabic.containsMatchIn(text) || key == "onboarding_language_english" || key == "onboarding_language_german")
        }
    }

    @Test
    fun copyDoesNotHardCodeTheAppNameOrUseForbiddenTone() {
        val appName = Regex("""<string name="app_name"[^>]*>(.*?)</string>""").find(File(res, "values/strings.xml").readText())!!.groupValues[1]
        assertTrue(appName.isNotBlank())
        val forbiddenEnglish = listOf("streak", "relapse", "reset", "you failed", "100%", "guaranteed", "fully protected", "cured")
        for (language in listOf(en, ar, de)) {
            for ((key, text) in language) {
                assertTrue("$key contains the placeholder app name", !text.contains(appName, ignoreCase = true))
            }
        }
        for ((key, text) in en) {
            for (word in forbiddenEnglish) {
                assertTrue("$key contains '$word'", !text.contains(word, ignoreCase = true))
            }
        }
    }

    @Test
    fun placeholderCopyDoesNotClaimProtectionIsActive() {
        // The privacy text may only say that no protection is started during setup.
        val privacy = en.getValue("onboarding_privacy_body")
        assertTrue(privacy.contains("does not start any protection"))
        assertTrue(!en.values.any { it.contains("you are protected", ignoreCase = true) || it.contains("is protecting", ignoreCase = true) })
    }
}

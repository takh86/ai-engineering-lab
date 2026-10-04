package com.muslimrecovery.protection.core.design

import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import org.junit.Assert.assertEquals
import org.junit.Test

/** The E5 mapping is total and frozen: empty -> SYSTEM; first supported in list order; none supported -> SYSTEM. */
class SupportedLanguageTest {
    private fun map(vararg tags: String) = SupportedLanguage.fromLanguageTags(tags.toList())

    @Test
    fun anEmptyListIsSystem() = assertEquals(SupportedLanguage.SYSTEM, map())

    @Test
    fun theFirstSupportedLocaleInListOrderWins() {
        assertEquals(SupportedLanguage.GERMAN, map("de-DE", "ar"))
        assertEquals(SupportedLanguage.ARABIC, map("ar-EG", "de"))
        assertEquals(SupportedLanguage.ENGLISH, map("en"))
    }

    @Test
    fun unsupportedEntriesBeforeASupportedOneAreSkipped() {
        assertEquals(SupportedLanguage.GERMAN, map("fr-FR", "he", "de"))
        assertEquals(SupportedLanguage.ARABIC, map("fa-IR", "ar-SA", "en"))
    }

    @Test
    fun noSupportedLocaleIsSystem() {
        assertEquals(SupportedLanguage.SYSTEM, map("fr", "he-IL"))
        assertEquals(SupportedLanguage.SYSTEM, map("zh-Hans-CN"))
    }

    @Test
    fun theMapperIsTotalOverMalformedInput() {
        assertEquals(SupportedLanguage.SYSTEM, map("", "   ", "-", "_", "und", "x-private"))
        assertEquals(SupportedLanguage.GERMAN, map("  DE_at ", "en"))
        assertEquals(SupportedLanguage.ARABIC, map("AR"))
    }

    @Test
    fun regionAndScriptSubtagsDoNotChangeTheLanguage() {
        assertEquals(SupportedLanguage.ARABIC, map("ar-Arab-EG"))
        assertEquals(SupportedLanguage.GERMAN, map("de-CH-1996"))
        // "deu" is not a supported tag spelling: only the two-letter language subtag is compared.
        assertEquals(SupportedLanguage.SYSTEM, map("deu"))
    }

    @Test
    fun theSupportedSetIsExactlySystemEnglishArabicGerman() {
        assertEquals(
            listOf(null, "en", "ar", "de"),
            SupportedLanguage.entries.map { it.languageTag },
        )
    }
}

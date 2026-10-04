package com.muslimrecovery.protection.feature.helpnow

import com.muslimrecovery.protection.localization.ResourceParity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class HelpNowResourcesTest {
    private fun res(locale: String?): String {
        val folder = if (locale == null) "values" else "values-$locale"
        return File("src/main/res/$folder/strings_helpnow.xml").readText()
    }

    private val keys: Set<String> = ResourceParity.parse(res(null)).map { it.name }.toSet()

    @Test
    fun everyKeyExistsInEnglishArabicAndGermanWithMatchingPlaceholders() {
        val problems = ResourceParity.problems(
            "strings_helpnow.xml", res(null), mapOf("ar" to res("ar"), "de" to res("de")),
        )
        assertEquals(emptyList<String>(), problems)
        assertTrue(keys.size >= 40)
    }

    @Test
    fun everyNeedAndStepHasItsStrings() {
        for (need in HelpNeed.values()) assertTrue(need.name, "helpnow_need_${need.name.lowercase()}" in keys)
        for (step in HelpStep.values()) {
            assertTrue(step.name, "helpnow_step_${step.name.lowercase()}_title" in keys)
            assertTrue(step.name, "helpnow_step_${step.name.lowercase()}_body" in keys)
        }
    }

    @Test
    fun noEmergencyOrHelpLineContentIsInventedOD_F3_3() {
        for (locale in listOf(null, "ar", "de")) {
            val values = Regex("<string[^>]*>(.*?)</string>", RegexOption.DOT_MATCHES_ALL).findAll(res(locale)).map { it.groupValues[1] }
            for (v in values) {
                val withoutPlaceholders = v.replace(Regex("%\\d\\$[a-z]"), "")
                assertTrue("digits in '$v'", withoutPlaceholders.none { it.isDigit() })
                assertTrue("url or phone in '$v'", !Regex("(https?:|www\\.|tel:|\\+\\d)").containsMatchIn(v))
            }
        }
        assertTrue(keys.none { it.contains("emergency") || it.contains("hotline") || it.contains("helpline") })
    }

    @Test
    fun theReviewRecordListsEveryKeyAsDraftUntilApproved() {
        val record = File("../../docs/android/f3-help-now-task-record.md").readText()
        val rows = Regex("\\|\\s*`(helpnow_[a-z0-9_]+)`\\s*\\|\\s*(DRAFT|APPROVED)\\s*\\|").findAll(record)
            .associate { it.groupValues[1] to it.groupValues[2] }
        assertEquals("keys missing from the review record", emptySet<String>(), keys - rows.keys)
        assertEquals("review record rows with no string", emptySet<String>(), rows.keys - keys)
        // Release gate (informational here): release is blocked until every row is APPROVED.
        assertTrue(rows.values.all { it == "DRAFT" || it == "APPROVED" })
    }
}

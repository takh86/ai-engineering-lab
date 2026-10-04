package com.muslimrecovery.protection.feature.plan

import com.muslimrecovery.protection.localization.ResourceParity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** F5 copy: parity (EN/AR/DE, placeholders) and the content-review record covers every key (OD-W1-5, F5-local). */
class PlanStringsTest {
    private val res = File("src/main/res")
    private val record = File("../../docs/android/f5-my-plan-task-record.md")

    private fun keys(path: String) = ResourceParity.parse(File(res, path).readText())

    @Test
    fun planStringsExistInAllThreeLanguagesWithMatchingPlaceholders() {
        val problems = ResourceParity.problems(
            "strings_plan.xml",
            File(res, "values/strings_plan.xml").readText(),
            ResourceParity.locales.associateWith { File(res, "values-$it/strings_plan.xml").takeIf { f -> f.isFile }?.readText() },
        )
        assertEquals(emptyList<String>(), problems)
        assertTrue(keys("values/strings_plan.xml").size >= 40)
    }

    @Test
    fun everyKeyIsListedInTheReviewRecordAsDraft() {
        assertTrue("review record missing: ${record.absolutePath}", record.isFile)
        val text = record.readText()
        val missing = keys("values/strings_plan.xml").map { it.name }.filter { !text.contains("`$it`") }
        assertEquals("every plan_ key must appear in the record's copy table", emptyList<String>(), missing)
        assertTrue("copy status must be recorded as DRAFT", text.contains("DRAFT"))
    }

    @Test
    fun noUserVisibleStringIsHardCodedInTheScreen() {
        val src = File("src/main/java/com/muslimrecovery/protection/feature/plan/PlanScreen.kt").readText()
        val literalText = Regex("""\bText\(\s*(?:text\s*=\s*)?"[^"]+"""")
        assertTrue("Text must come from string resources", !literalText.containsMatchIn(src))
    }

    @Test
    fun everyDeclaredPlanStringIsUsedByTheScreen() {
        val src = File("src/main/java/com/muslimrecovery/protection/feature/plan/PlanScreen.kt").readText()
        val unused = keys("values/strings_plan.xml").map { it.name }.filter { !src.contains("R.string.$it") }
        assertEquals(emptyList<String>(), unused)
    }
}

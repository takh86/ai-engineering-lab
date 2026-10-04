package com.muslimrecovery.protection.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanValidatorTest {
    private fun ok(section: PlanSection, p: String, s: String = "") = PlanValidator.validate(section, p, s)

    @Test
    fun contractLimitsAreTheProposedOnes() {
        assertEquals(20, PlanLimits.MAX_ITEMS)
        assertEquals(500, PlanLimits.maxPrimary(PlanSection.REASONS))
        assertEquals(200, PlanLimits.maxPrimary(PlanSection.STEPS))
        assertEquals(300, PlanLimits.maxPrimary(PlanSection.IF_THEN))
        assertEquals(300, PlanLimits.maxSecondary(PlanSection.IF_THEN))
        assertEquals(0, PlanLimits.maxSecondary(PlanSection.REASONS))
    }

    @Test
    fun textIsTrimmed() {
        val v = ok(PlanSection.REASONS, "  \n my reason \t ")
        assertTrue(v.ok)
        assertEquals("my reason", v.primary)
    }

    @Test
    fun emptyAndWhitespaceOnlyAreRejected() {
        assertEquals(FieldError.EMPTY, ok(PlanSection.REASONS, "").primaryError)
        assertEquals(FieldError.EMPTY, ok(PlanSection.STEPS, "   \n\t ").primaryError)
        assertEquals(FieldError.EMPTY, ok(PlanSection.IF_THEN, "when", "  ").secondaryError)
        assertEquals(FieldError.EMPTY, ok(PlanSection.IF_THEN, " ", "act").primaryError)
    }

    @Test
    fun boundariesPerSection() {
        assertTrue(ok(PlanSection.REASONS, "a".repeat(500)).ok)
        assertEquals(FieldError.TOO_LONG, ok(PlanSection.REASONS, "a".repeat(501)).primaryError)
        assertTrue(ok(PlanSection.STEPS, "a".repeat(200)).ok)
        assertEquals(FieldError.TOO_LONG, ok(PlanSection.STEPS, "a".repeat(201)).primaryError)
        assertTrue(ok(PlanSection.IF_THEN, "a".repeat(300), "b".repeat(300)).ok)
        assertEquals(FieldError.TOO_LONG, ok(PlanSection.IF_THEN, "a".repeat(301), "b").primaryError)
        assertEquals(FieldError.TOO_LONG, ok(PlanSection.IF_THEN, "a", "b".repeat(301)).secondaryError)
    }

    @Test
    fun lengthCountsCodePointsNotUtf16Units() {
        val emoji = "😀" // one code point, two chars
        assertTrue(ok(PlanSection.STEPS, emoji.repeat(200)).ok)
        assertEquals(FieldError.TOO_LONG, ok(PlanSection.STEPS, emoji.repeat(201)).primaryError)
    }

    @Test
    fun secondaryIsIgnoredOutsideIfThen() {
        val v = ok(PlanSection.REASONS, "r", "ignored")
        assertTrue(v.ok)
        assertEquals("", v.secondary)
    }

    @Test
    fun controlAndBidiOverrideCharactersAreRejectedButNewlinesAndArabicAreFine() {
        assertEquals(FieldError.INVALID_CHARACTERS, ok(PlanSection.REASONS, "a\u0000b").primaryError)
        assertEquals(FieldError.INVALID_CHARACTERS, ok(PlanSection.REASONS, "a‮b").primaryError)
        assertEquals(FieldError.INVALID_CHARACTERS, ok(PlanSection.REASONS, "a⁦b").primaryError)
        assertEquals(FieldError.INVALID_CHARACTERS, ok(PlanSection.REASONS, "a\tb").primaryError)
        assertTrue(ok(PlanSection.REASONS, "line one\nline two").ok)
        assertTrue(ok(PlanSection.REASONS, "لأن عائلتي تستحق ذلك").ok)
        assertTrue(ok(PlanSection.REASONS, "Weil es mir wichtig ist: über alles").ok)
    }

    @Test
    fun duplicatesAreFlaggedCaseAndWhitespaceInsensitivelyExcludingTheItemItself() {
        val rows = listOf(PlanRow(1, "My Reason"), PlanRow(2, "other"))
        assertTrue(PlanValidator.isDuplicate(rows, null, "  my   reason ", ""))
        assertFalse(PlanValidator.isDuplicate(rows, 1L, "my reason", ""))
        assertFalse(PlanValidator.isDuplicate(rows, null, "new", ""))
        assertFalse(PlanValidator.isDuplicate(rows, null, "   ", ""))
    }

    @Test
    fun ifThenDuplicateNeedsBothFieldsEqual() {
        val rows = listOf(PlanRow(1, "bored", "walk"))
        assertTrue(PlanValidator.isDuplicate(rows, null, "BORED", "Walk"))
        assertFalse(PlanValidator.isDuplicate(rows, null, "bored", "call a friend"))
    }

    @Test
    fun validatedAndModelToStringsAreRedacted() {
        val secret = "SENTINEL-secret-text"
        val all = listOf(
            PlanValidator.validate(PlanSection.REASONS, secret, "").toString(),
            Reason(1, secret).toString(), SupportStep(1, secret).toString(), IfThenPlan(1, secret, secret).toString(),
            PlanRow(1, secret, secret).toString(), PlanSnapshot(listOf(Reason(1, secret))).toString(),
            PlanEdit.Add(PlanSection.REASONS, secret, secret).toString(),
            PlanEdit.Update(PlanSection.REASONS, 1, secret, secret).toString(),
            EditorState(PlanSection.REASONS, null, secret, secret).toString(),
            PlanState(PlanAccessKind.OPEN, PlanSnapshot(listOf(Reason(1, secret))), EditorState(PlanSection.REASONS, null, secret)).toString(),
            PlanEvent.PrimaryChanged(secret).toString(), PlanEvent.SecondaryChanged(secret).toString(),
            PlanAccess.Open(PlanSnapshot(listOf(Reason(1, secret)))).toString(),
        )
        all.forEach { assertFalse(it, it.contains(secret)) }
        assertNull(ok(PlanSection.REASONS, "x").primaryError)
    }
}

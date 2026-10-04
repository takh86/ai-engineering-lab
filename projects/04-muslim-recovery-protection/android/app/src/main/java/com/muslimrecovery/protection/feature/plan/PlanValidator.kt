package com.muslimrecovery.protection.feature.plan

import java.util.Locale

enum class FieldError { EMPTY, TOO_LONG, INVALID_CHARACTERS }

/** Result of validating one editor. [primary]/[secondary] are the trimmed texts that would be stored. */
class Validated(
    val primary: String,
    val secondary: String,
    val primaryError: FieldError?,
    val secondaryError: FieldError?,
) {
    val ok: Boolean get() = primaryError == null && secondaryError == null

    override fun toString() = "Validated(ok=$ok)"
}

/** Pure validation and duplicate detection (OD-F5-2). No Android types, no I/O. */
object PlanValidator {
    fun validate(section: PlanSection, primary: String, secondary: String): Validated {
        val p = primary.trim()
        val s = if (PlanLimits.hasSecondary(section)) secondary.trim() else ""
        return Validated(
            primary = p,
            secondary = s,
            primaryError = fieldError(p, PlanLimits.maxPrimary(section)),
            secondaryError = if (PlanLimits.hasSecondary(section)) fieldError(s, PlanLimits.maxSecondary(section)) else null,
        )
    }

    private fun fieldError(text: String, max: Int): FieldError? = when {
        text.isEmpty() -> FieldError.EMPTY
        hasForbiddenCharacters(text) -> FieldError.INVALID_CHARACTERS
        text.codePointCount(0, text.length) > max -> FieldError.TOO_LONG
        else -> null
    }

    /**
     * Rejects control characters (a newline is allowed) and the Unicode bidirectional override/isolate controls, which
     * could visually reorder text and spoof what is shown back to the user.
     */
    fun hasForbiddenCharacters(text: String): Boolean = text.any { c ->
        (Character.isISOControl(c) && c != '\n') || c in '‪'..'‮' || c in '⁦'..'⁩'
    }

    private fun normalize(text: String): String =
        text.trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)

    /** Duplicates are allowed but flagged. Compares trimmed, whitespace-collapsed, case-insensitive text (both fields). */
    fun isDuplicate(rows: List<PlanRow>, excludeId: Long?, primary: String, secondary: String): Boolean {
        val p = normalize(primary)
        val s = normalize(secondary)
        if (p.isEmpty()) return false
        return rows.any { it.id != excludeId && normalize(it.primary) == p && normalize(it.secondary) == s }
    }
}

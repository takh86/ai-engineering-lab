package com.muslimrecovery.protection.core.design

import com.muslimrecovery.protection.architecture.BoundaryRules

/**
 * Narrow design rules (A6) as a pure function so they are tested against synthetic violating sources.
 *
 * Enforced outside `core/design`:
 *  - no raw brand color literals (the six brand hex values, as Kotlin hex or `Color(0x...)` literals);
 *  - no feature-defined font families (`FontFamily(` / `Font(`);
 *  - no absolute left/right layout assumptions where start/end applies.
 * Dp literals are deliberately allowed. Comments are ignored.
 */
internal object DesignRules {
    private val brandHex = listOf("0B3B8F", "1456C5", "B7E445", "5F8FD9", "F3F6FB")
    private val brandLiteral = Regex("0x(?:FF)?(?:${brandHex.joinToString("|")})", RegexOption.IGNORE_CASE)
    private val rawColorConstructor = Regex("""\bColor\(\s*0x[0-9A-Fa-f]+""")
    private val fontFamily = Regex("""\b(?:FontFamily|Font)\s*\(""")
    private val directional = listOf(
        Regex("""\.absolutePadding\b"""),
        Regex("""\.absoluteOffset\b"""),
        Regex("""\bArrangement\.Absolute\b"""),
        Regex("""\bTextAlign\.(?:Left|Right)\b"""),
        Regex("""\bAlignment\.(?:CenterLeft|CenterRight|TopLeft|TopRight|BottomLeft|BottomRight)\b"""),
        Regex("""\bpadding\s*\([^)]*\b(?:left|right)\s*="""),
        Regex("""\bPaddingValues\s*\([^)]*\b(?:left|right)\s*="""),
        Regex("""\bPaddingValues\.Absolute\b"""),
    )

    fun violations(relPath: String, source: String): List<String> {
        if (relPath.startsWith("core/design/")) return emptyList()
        val code = BoundaryRules.stripComments(source)
        val found = mutableListOf<String>()
        if (brandLiteral.containsMatchIn(code)) found += "$relPath: raw brand color literal (use the theme roles)"
        if (rawColorConstructor.containsMatchIn(code)) found += "$relPath: raw Color(0x...) literal (use the theme roles)"
        if (fontFamily.containsMatchIn(code)) found += "$relPath: feature-defined font family (typography is owned by core/design)"
        for (rule in directional) {
            if (rule.containsMatchIn(code)) found += "$relPath: absolute left/right layout (${rule.pattern}); use start/end"
        }
        return found
    }
}

package com.muslimrecovery.protection.core.design

import com.muslimrecovery.protection.architecture.BoundaryRules

/**
 * Narrow design rules (A6) as a pure function so they are tested against synthetic violating sources.
 *
 * Enforced everywhere except core/design/theme, core/design/type and core/design/layout:
 *  - no raw brand color literals (the five non-white brand hex values as hex literals, any `Color(` construction, named `Color.X` constants other than Transparent/Unspecified, color strings);
 *  - no feature-defined font families (`FontFamily(` / `Font(`);
 *  - no absolute left/right layout assumptions where start/end applies, no non-mirrored directional icons
 *    (use Icons.AutoMirrored) and no hard-coded layout direction.
 * Dp literals are deliberately allowed. Comments are ignored.
 */
internal object DesignRules {
    private val brandHex = listOf("0B3B8F", "1456C5", "B7E445", "5F8FD9", "F3F6FB")
    private val brandLiteral = Regex("0x(?:FF)?(?:${brandHex.joinToString("|")})", RegexOption.IGNORE_CASE)
    private val rawColorConstructor = Regex("""\bColor\(\s*0x[0-9A-Fa-f]+""")
    private val otherColorForms = listOf(
        Regex("""\bColor\.(?!Transparent\b|Unspecified\b)[A-Za-z]+"""),
        Regex("""\bColor\s*\("""),
        Regex("""\bparseColor\b"""),
        Regex("""["']#[0-9A-Fa-f]{6,8}["']"""),
        Regex("""0x(?:FF)?_?(?:${brandHex.joinToString("|")})""", RegexOption.IGNORE_CASE),
    )
    private val fontFamily = Regex("""\b(?:FontFamily|Font|GoogleFont|Typeface)\b""")
    private val directional = listOf(
        Regex("""\.absolutePadding\b"""),
        Regex("""\.absoluteOffset\b"""),
        Regex("""\bArrangement\.Absolute\b"""),
        Regex("""\bTextAlign\.(?:Left|Right)\b"""),
        Regex("""\bAlignment\.(?:CenterLeft|CenterRight|TopLeft|TopRight|BottomLeft|BottomRight)\b"""),
        Regex("""\b(?:left|right)\s*=(?!=)"""),
        Regex("""\b(?:CenterLeft|CenterRight|TopLeft|TopRight|BottomLeft|BottomRight)\b"""),
        Regex("""\bTextAlign\s*\.\s*(?:Companion\s*\.\s*)?(?:Left|Right)\b"""),
        Regex("""\b(?:dynamicLightColorScheme|dynamicDarkColorScheme)\b"""),
        Regex("""\bPaddingValues\.Absolute\b"""),
        Regex("""\bIcons\.Filled\.(?:ArrowBack|ArrowForward|KeyboardArrowLeft|KeyboardArrowRight|ArrowLeft|ArrowRight)\b"""),
        Regex("""\bLayoutDirection\.(?:Ltr|Rtl)\b"""),
    )

    fun violations(relPath: String, source: String): List<String> {
        // Only the token definitions themselves may name colors and fonts; the components are scanned like features.
        if (relPath.startsWith("core/design/theme/") || relPath.startsWith("core/design/type/") ||
            relPath.startsWith("core/design/layout/")
        ) {
            return emptyList()
        }
        val code = BoundaryRules.stripComments(source)
        val found = mutableListOf<String>()
        if (brandLiteral.containsMatchIn(code)) found += "$relPath: raw brand color literal (use the theme roles)"
        if (rawColorConstructor.containsMatchIn(code)) found += "$relPath: raw Color(0x...) literal (use the theme roles)"
        for (rule in otherColorForms) {
            if (rule.containsMatchIn(code)) found += "$relPath: raw color construction (${rule.pattern}); use the theme roles"
        }
        if (fontFamily.containsMatchIn(code)) found += "$relPath: font family/typeface (typography is owned by core/design)"
        for (rule in directional) {
            if (rule.containsMatchIn(code)) found += "$relPath: absolute left/right layout (${rule.pattern}); use start/end"
        }
        return found
    }
}

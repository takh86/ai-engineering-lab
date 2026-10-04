package com.muslimrecovery.protection.architecture

/**
 * Package-boundary rules from M3-01 section 2 and Amendment A5, as a pure function so they can be
 * tested against synthetic violating sources as well as against the real tree.
 *
 * `sourceSet` is the directory name under `src/` (`main`, `play`, `internal`, ...). `relPath` is the
 * path below `com/muslimrecovery/protection/`, e.g. `core/data/X.kt`.
 *
 * Rules (all strict by default; unknown source sets get no exemption):
 *  - the `package` declaration must match the directory (so path tricks cannot dodge the rules);
 *  - nothing may wildcard-import the project root package;
 *  - the `experimental` package tree may be referenced only from composition wiring (the `app` package tree) in the `internal`
 *    source set (Amendment A5) -- never from `src/main`, `src/play`, the `core` package tree or the `feature` package tree;
 *  - the `core` package tree must not depend on the `feature` package tree or the `app` package tree; features must not depend on other
 *    features or the `app` package tree; the `core` package tree, the `feature` package tree and the `app` package tree must not use the historical
 *    the `vpn` package tree or the `dns` package tree.
 *
 * Comments are ignored; string literals are NOT (a package name inside a string is a reflection
 * path and counts as a reference).
 */
internal object BoundaryRules {
    private const val BASE = "com.muslimrecovery.protection"
    private const val EXPERIMENTAL = "$BASE.experimental"
    private const val FEATURE = "$BASE.feature."
    private const val APP = "$BASE.app."
    private val HISTORICAL = listOf("$BASE.vpn.", "$BASE.dns.")
    private val PACKAGE_DECLARATION = Regex("^\\s*package\\s+([\\w.`]+)", RegexOption.MULTILINE)
    private val WILDCARD_ROOT_IMPORT = Regex("import\\s+${Regex.escape(BASE)}\\s*\\.\\s*\\*")
    private val DOT_SPACING = Regex("\\s*\\.\\s*")

    /** Removes `//` and (nested) block comments while leaving string and char literals intact. */
    fun stripComments(source: String): String {
        val out = StringBuilder(source.length)
        val n = source.length
        var i = 0
        while (i < n) {
            val c = source[i]
            val next = if (i + 1 < n) source[i + 1] else '\u0000'
            when {
                c == '/' && next == '/' -> {
                    while (i < n && source[i] != '\n') i++
                    out.append(' ')
                }
                c == '/' && next == '*' -> {
                    var depth = 1
                    i += 2
                    while (i < n && depth > 0) {
                        if (source[i] == '/' && i + 1 < n && source[i + 1] == '*') {
                            depth++
                            i += 2
                        } else if (source[i] == '*' && i + 1 < n && source[i + 1] == '/') {
                            depth--
                            i += 2
                        } else {
                            if (source[i] == '\n') out.append('\n')
                            i++
                        }
                    }
                    out.append(' ')
                }
                source.startsWith("\"\"\"", i) -> {
                    val end = source.indexOf("\"\"\"", i + 3)
                    val stop = if (end < 0) n else end + 3
                    out.append(source, i, stop)
                    i = stop
                }
                c == '"' || c == '\'' -> {
                    out.append(c)
                    i++
                    while (i < n) {
                        val d = source[i]
                        out.append(d)
                        i++
                        if (d == '\\' && i < n) {
                            out.append(source[i])
                            i++
                        } else if (d == c || d == '\n') {
                            break
                        }
                    }
                }
                else -> {
                    out.append(c)
                    i++
                }
            }
        }
        return out.toString()
    }

    private fun normalize(code: String): String = DOT_SPACING.replace(code.replace("`", ""), ".")

    fun violations(sourceSet: String, relPath: String, source: String): List<String> {
        val where = "$sourceSet/$relPath"
        val found = mutableListOf<String>()
        val code = normalize(stripComments(source))
        val segments = relPath.split('/')
        val area = if (segments.size > 1) segments[0] else ""

        val expectedPackage = (listOf(BASE) + segments.dropLast(1)).joinToString(".")
        val declared = PACKAGE_DECLARATION.find(stripComments(source))?.groupValues?.get(1)?.replace("`", "")
        if (declared != expectedPackage) {
            found += "$where: package declaration '$declared' does not match its directory ('$expectedPackage')"
        }

        if (WILDCARD_ROOT_IMPORT.containsMatchIn(code)) {
            found += "$where: wildcard import of the project root package is not allowed"
        }

        // A5: only composition wiring under src/internal/app may reference experimental packages.
        val mayReferenceExperimental = sourceSet == "internal" && area == "app"
        if (code.contains(EXPERIMENTAL) && !mayReferenceExperimental) {
            found += "$where: references experimental packages"
        }

        when (area) {
            "core" -> {
                if (code.contains(FEATURE)) found += "$where: core must not depend on feature packages"
                if (code.contains(APP)) found += "$where: core must not depend on app packages"
                found += historicalReferences(where, code, "core")
            }
            "feature" -> {
                val self = segments.getOrNull(1)
                val others = Regex("${Regex.escape(FEATURE)}([A-Za-z0-9_]+)")
                    .findAll(code).map { it.groupValues[1] }.filter { it != self }.toSet()
                for (other in others) found += "$where: feature/$self must not depend on feature/$other"
                if (code.contains(APP)) found += "$where: feature must not depend on app packages"
                found += historicalReferences(where, code, "feature")
            }
            "app" -> found += historicalReferences(where, code, "app")
        }
        return found
    }

    private fun historicalReferences(where: String, code: String, area: String): List<String> =
        HISTORICAL.filter { code.contains(it) }
            .map { "$where: $area must not depend on historical ${it.removeSuffix(".")}" }
}

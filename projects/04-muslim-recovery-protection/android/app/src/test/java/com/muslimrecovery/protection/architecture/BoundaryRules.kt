package com.muslimrecovery.protection.architecture

/**
 * Package-boundary rules from M3-01 §2 and Amendment A5, as a pure function so they can be tested
 * against synthetic violating sources as well as against the real tree.
 *
 * Source sets: `main`, `play`, `internal` (the flavor source sets under `src/`).
 * `relPath` is the path below `com/muslimrecovery/protection/`, e.g. `core/data/X.kt`.
 */
internal object BoundaryRules {
    private const val BASE = "com.muslimrecovery.protection"
    private const val EXPERIMENTAL = "$BASE.experimental"
    private const val FEATURE = "$BASE.feature."
    private val HISTORICAL = listOf("$BASE.vpn.", "$BASE.dns.")

    private val BLOCK_COMMENT = Regex("/\\*.*?\\*/", RegexOption.DOT_MATCHES_ALL)
    private val LINE_COMMENT = Regex("//[^\\n]*")

    private fun stripComments(source: String): String =
        source.replace(BLOCK_COMMENT, " ").replace(LINE_COMMENT, " ")

    fun violations(sourceSet: String, relPath: String, source: String): List<String> {
        // A5: src/internal composition wiring may import experimental implementations.
        if (sourceSet == "internal") return emptyList()

        val code = stripComments(source)
        val found = mutableListOf<String>()
        val segments = relPath.split('/')
        val area = if (segments.size > 1) segments[0] else ""

        // A5: src/main and src/play must never reference experimental/**.
        if (code.contains(EXPERIMENTAL)) {
            found += "$sourceSet/$relPath references experimental/**"
        }

        when (area) {
            "core" -> {
                if (code.contains(FEATURE)) found += "$sourceSet/$relPath: core must not depend on feature/**"
                found += historicalReferences(sourceSet, relPath, code, "core")
            }
            "feature" -> {
                val self = segments.getOrNull(1)
                val others = Regex("${Regex.escape(FEATURE)}([A-Za-z0-9_]+)")
                    .findAll(code).map { it.groupValues[1] }.filter { it != self }.toSet()
                for (other in others) {
                    found += "$sourceSet/$relPath: feature/$self must not depend on feature/$other"
                }
                found += historicalReferences(sourceSet, relPath, code, "feature")
            }
            "app" -> found += historicalReferences(sourceSet, relPath, code, "app")
        }
        return found
    }

    private fun historicalReferences(
        sourceSet: String,
        relPath: String,
        code: String,
        area: String,
    ): List<String> =
        HISTORICAL.filter { code.contains(it) }
            .map { "$sourceSet/$relPath: $area must not depend on historical ${it.removeSuffix(".")}" }
}

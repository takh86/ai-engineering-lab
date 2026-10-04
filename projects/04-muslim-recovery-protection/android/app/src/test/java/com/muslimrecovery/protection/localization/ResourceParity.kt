package com.muslimrecovery.protection.localization

import java.io.File

/**
 * Translation/resource parity rules (D-5: a missing required translation is a release error), as pure functions
 * over XML text so they are tested against synthetic bad resources as well as the real tree.
 *
 * A "resource file set" is `values/strings_<name>.xml` plus the same file name under `values-ar` and `values-de`.
 */
internal object ResourceParity {
    val locales = listOf("ar", "de")

    data class Entry(val kind: String, val name: String, val translatable: Boolean, val shape: String)

    private val comment = Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL)
    private val element = Regex(
        """<(string-array|plurals|string)(?=[\s>/])([^>]*?)(?:/>|>(.*?)</\1>)""",
        RegexOption.DOT_MATCHES_ALL,
    )
    private val nameAttr = Regex("""\bname\s*=\s*"([^"]+)"""")
    private val translatableFalse = Regex("""\btranslatable\s*=\s*"false"""")
    private val placeholder = Regex("""%(?:\d+\$)?[-#+ 0,(]*\d*(?:\.\d+)?[a-zA-Z]""")

    /** Shape = sorted placeholder multiset for strings, item names for plurals, item count for arrays. */
    fun parse(xml: String): List<Entry> {
        val cleaned = comment.replace(xml, " ")
        return element.findAll(cleaned).map { m ->
            val kind = m.groupValues[1]
            val attrs = m.groupValues[2]
            val body = m.groupValues[3]
            val selfClosing = m.value.endsWith("/>") && !m.value.contains("</")
            val name = checkNotNull(nameAttr.find(attrs)?.groupValues?.get(1)) { "$kind without a name: ${m.value.take(60)}" }
            val items = Regex("<item\\b([^>]*)>(.*?)</item>", RegexOption.DOT_MATCHES_ALL).findAll(body).toList()
            val shape = when (kind) {
                "string" -> if (selfClosing || body.isBlank()) "EMPTY" else placeholders(body)
                // quantity set + the placeholders of each quantity (quantity names legitimately differ per language, so
                // only the union of placeholders is compared, plus that an `other` form exists)
                "plurals" -> "plurals other=" + items.any { Regex("""quantity\s*=\s*"other"""").containsMatchIn(it.groupValues[1]) } +
                    " ph=" + items.flatMap { placeholders(it.groupValues[2]).split(",") }.filter { it.isNotEmpty() }.toSortedSet().joinToString(",")
                else -> "items=" + items.size + " ph=" + items.joinToString("|") { placeholders(it.groupValues[2]) }
            }
            Entry(kind, name, !translatableFalse.containsMatchIn(attrs), shape)
        }.toList()
    }

    /** Positional indices are kept (`%1$s`, `%2$d`), so swapping or duplicating an index is a difference. */
    private fun placeholders(text: String): String =
        placeholder.findAll(text.replace("%%", "")).map { it.value }.sorted().joinToString(",")

    /** Problems for one default file and its translations. [translations] maps locale -> file text (null = missing file). */
    fun problems(fileName: String, defaultXml: String, translations: Map<String, String?>): List<String> {
        val problems = mutableListOf<String>()
        val prefix = keyPrefix(fileName)
        val default = parse(defaultXml)
        val duplicates = default.groupBy { it.name }.filterValues { it.size > 1 }.keys
        if (duplicates.isNotEmpty()) problems += "$fileName: duplicate keys $duplicates"
        if (prefix != null) {
            default.filter { !it.name.startsWith(prefix) }.forEach { problems += "$fileName: key '${it.name}' must start with '$prefix'" }
        }
        val required = default.filter { it.translatable }.associateBy { it.name }
        for (locale in locales) {
            val text = translations[locale]
            if (text == null) {
                if (required.isNotEmpty()) problems += "values-$locale/$fileName is missing (${required.size} required strings)"
                continue
            }
            val translated = parse(text)
            val dupes = translated.groupBy { it.name }.filterValues { it.size > 1 }.keys
            if (dupes.isNotEmpty()) problems += "values-$locale/$fileName: duplicate keys $dupes"
            val byName = translated.associateBy { it.name }
            for ((name, entry) in required) {
                val other = byName[name]
                when {
                    other == null -> problems += "values-$locale/$fileName: missing translation '$name'"
                    other.kind != entry.kind -> problems += "values-$locale/$fileName: '$name' is a ${other.kind}, default is a ${entry.kind}"
                    other.shape != entry.shape -> problems += "values-$locale/$fileName: '$name' differs from the default (${other.shape} vs ${entry.shape})"
                }
            }
            for (extra in byName.keys - required.keys) {
                problems += "values-$locale/$fileName: '$extra' has no translatable default (extra translation)"
            }
        }
        return problems
    }

    /** `strings_common.xml` -> `common_`, `strings_home_screen.xml` -> `home_screen_`; the bare `strings.xml` has no prefix rule. */
    fun keyPrefix(fileName: String): String? =
        Regex("^strings_([a-z0-9_]+)\\.xml$").find(fileName)?.groupValues?.get(1)?.let { "${it}_" }

    fun defaultFiles(resDir: File): List<File> =
        File(resDir, "values").listFiles().orEmpty()
            .filter { it.isFile && Regex("^strings(_[a-z0-9_]+)?\\.xml$").matches(it.name) }.sortedBy { it.name }
}

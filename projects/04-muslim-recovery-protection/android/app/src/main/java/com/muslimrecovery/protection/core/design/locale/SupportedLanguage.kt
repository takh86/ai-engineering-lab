package com.muslimrecovery.protection.core.design.locale

/**
 * The UI languages the product supports (D-5: English fallback, Arabic, German), as an application-domain type.
 * It is never persisted: the language preference is owned solely by the Android/AppCompat per-app locale
 * mechanism. [SYSTEM] is the empty application locale list, i.e. follow the platform.
 */
enum class SupportedLanguage(val languageTag: String?) {
    SYSTEM(null),
    ENGLISH("en"),
    ARABIC("ar"),
    GERMAN("de"),
    ;

    companion object {
        /**
         * Frozen mapping (E5), total over any input:
         *  - empty list -> [SYSTEM];
         *  - non-empty list -> the first entry, in list order, whose language is supported;
         *  - no supported entry -> [SYSTEM].
         * Tags are BCP-47 or legacy `_` forms; only the language subtag is compared, case-insensitively.
         */
        fun fromLanguageTags(tags: List<String>): SupportedLanguage {
            for (tag in tags) {
                val language = tag.trim().substringBefore('-').substringBefore('_').lowercase()
                val match = entries.firstOrNull { it.languageTag != null && it.languageTag == language }
                if (match != null) return match
            }
            return SYSTEM
        }
    }
}

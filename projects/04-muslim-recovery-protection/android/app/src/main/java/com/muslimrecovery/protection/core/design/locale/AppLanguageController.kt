package com.muslimrecovery.protection.core.design.locale

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * Reads and changes the app language through the Android per-app locale mechanism (single source of truth).
 * Features depend on this interface; there is no custom locale store and no DataStore copy.
 *
 * Changing the language recreates the visible activities, so features must keep unsaved input in
 * `rememberSaveable` or a ViewModel. Call from the main thread.
 */
interface AppLanguageController {
    fun current(): SupportedLanguage

    fun set(language: SupportedLanguage)
}

/**
 * AppCompat implementation: the platform per-app language on Android 13+, the AppCompat backport (persisted with
 * `autoStoreLocales`) on API 24 to 32. AppCompat may perform blocking disk reads/writes internally on API <= 32; that
 * is accepted standard behavior (E3) and no workaround is added.
 */
object AppCompatLanguageController : AppLanguageController {
    override fun current(): SupportedLanguage {
        val locales = AppCompatDelegate.getApplicationLocales()
        val tags = (0 until locales.size()).mapNotNull { locales.get(it)?.toLanguageTag() }
        return SupportedLanguage.fromLanguageTags(tags)
    }

    override fun set(language: SupportedLanguage) {
        val tag = language.languageTag
        AppCompatDelegate.setApplicationLocales(
            if (tag == null) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(tag),
        )
    }
}

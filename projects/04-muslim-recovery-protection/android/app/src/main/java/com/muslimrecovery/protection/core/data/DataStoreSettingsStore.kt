package com.muslimrecovery.protection.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

/**
 * [SettingsStore] backed by a Preferences [DataStore]. It has no Android framework dependency, so
 * it is unit tested on the JVM; [createAndroidSettingsStore] supplies the on-device DataStore.
 *
 * Defined corruption behaviour:
 *  - a corrupt file is replaced by an empty one through [settingsCorruptionHandler] (defaults);
 *  - an [IOException] while reading yields defaults for that read;
 *  - an unknown stored value yields the default.
 */
class DataStoreSettingsStore(
    private val dataStore: DataStore<Preferences>,
) : SettingsStore {

    private val preferences: Flow<Preferences> =
        dataStore.data.catch { error ->
            if (error is IOException) emit(emptyPreferences()) else throw error
        }

    override val themeMode: Flow<ThemeMode> =
        preferences.map { prefs ->
            val stored = prefs[THEME_MODE_KEY]
            ThemeMode.values().firstOrNull { it.name == stored } ?: ThemeMode.SYSTEM
        }

    override val uiLanguage: Flow<UiLanguage> =
        preferences.map { prefs ->
            val stored = prefs[UI_LANGUAGE_KEY]
            UiLanguage.values().firstOrNull { it.name == stored } ?: UiLanguage.SYSTEM
        }

    override suspend fun setThemeMode(mode: ThemeMode) {
        dataStore.edit { it[THEME_MODE_KEY] = mode.name }
    }

    override suspend fun setUiLanguage(language: UiLanguage) {
        dataStore.edit { it[UI_LANGUAGE_KEY] = language.name }
    }

    companion object {
        private const val THEME_MODE_NAME = "theme_mode"
        private const val UI_LANGUAGE_NAME = "ui_language"

        private val THEME_MODE_KEY = stringPreferencesKey(THEME_MODE_NAME)
        private val UI_LANGUAGE_KEY = stringPreferencesKey(UI_LANGUAGE_NAME)

        /** Every key this store may ever persist. Tests assert nothing else is written (no D1). */
        val persistedKeyNames: Set<String> = setOf(THEME_MODE_NAME, UI_LANGUAGE_NAME)
    }
}

/** Replaces a corrupt settings file with an empty one, i.e. resets to defaults. */
fun settingsCorruptionHandler(): ReplaceFileCorruptionHandler<Preferences> =
    ReplaceFileCorruptionHandler { emptyPreferences() }

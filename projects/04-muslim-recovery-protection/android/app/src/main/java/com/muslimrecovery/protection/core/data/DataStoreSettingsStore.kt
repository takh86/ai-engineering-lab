package com.muslimrecovery.protection.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.retryWhen
import java.io.IOException

/**
 * [SettingsStore] backed by a Preferences [DataStore]. It has no Android framework dependency, so
 * it is unit tested on the JVM; [createAndroidSettingsStore] supplies the on-device DataStore.
 *
 * Defined behaviour (reads are total, writes are not):
 *  - a corrupt file is replaced by an empty one through [settingsCorruptionHandler] (defaults);
 *  - an [IOException] while reading emits defaults and the read is retried after [retryDelayMillis],
 *    so a long-lived collector recovers instead of being completed by one transient error;
 *  - an unknown stored value yields the default (enum constants are stored by name, so renaming a
 *    constant silently resets that setting);
 *  - the setters may throw [IOException] if the write fails; callers decide how to surface that.
 */
class DataStoreSettingsStore(
    private val dataStore: DataStore<Preferences>,
    private val retryDelayMillis: Long = DEFAULT_RETRY_DELAY_MILLIS,
) : SettingsStore {

    private val preferences: Flow<Preferences> =
        dataStore.data.retryWhen { cause, _ ->
            if (cause is IOException) {
                emit(emptyPreferences())
                delay(retryDelayMillis)
                true
            } else {
                false
            }
        }

    override val themeMode: Flow<ThemeMode> =
        preferences.map { prefs ->
            val stored = prefs[THEME_MODE_KEY]
            ThemeMode.values().firstOrNull { it.name == stored } ?: ThemeMode.SYSTEM
        }

    override suspend fun setThemeMode(mode: ThemeMode) {
        dataStore.edit { it[THEME_MODE_KEY] = mode.name }
    }

    companion object {
        private const val THEME_MODE_NAME = "theme_mode"

        private val THEME_MODE_KEY = stringPreferencesKey(THEME_MODE_NAME)

        private const val DEFAULT_RETRY_DELAY_MILLIS = 1_000L

        /** Every key this store may ever persist. Tests assert nothing else is written (no D1). */
        internal val persistedKeyNames: Set<String> = setOf(THEME_MODE_NAME)
    }
}

/** Replaces a corrupt settings file with an empty one, i.e. resets to defaults. */
fun settingsCorruptionHandler(): ReplaceFileCorruptionHandler<Preferences> =
    ReplaceFileCorruptionHandler { emptyPreferences() }

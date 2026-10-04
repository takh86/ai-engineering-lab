package com.muslimrecovery.protection.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.preferencesOf
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

class SettingsStoreTest {

    @get:Rule
    val folder = TemporaryFolder()

    private val openScopes = mutableListOf<Job>()

    @After
    fun closeOpenScopes() {
        runBlocking { openScopes.forEach { it.cancelAndJoin() } }
    }

    private fun settingsFile(): File = File(folder.root, "settings.preferences_pb")

    private fun openDataStore(file: File = settingsFile()): DataStore<Preferences> {
        val job = Job()
        openScopes += job
        return PreferenceDataStoreFactory.create(
            corruptionHandler = settingsCorruptionHandler(),
            scope = CoroutineScope(Dispatchers.IO + job),
            produceFile = { file },
        )
    }

    private fun closeAll() {
        runBlocking { openScopes.forEach { it.cancelAndJoin() } }
        openScopes.clear()
    }

    @Test
    fun missingFileYieldsDefaults() = runBlocking {
        val store = DataStoreSettingsStore(openDataStore())

        assertEquals(ThemeMode.SYSTEM, store.themeMode.first())
    }

    @Test
    fun valuesRoundTrip() = runBlocking {
        val store = DataStoreSettingsStore(openDataStore())

        store.setThemeMode(ThemeMode.DARK)

        assertEquals(ThemeMode.DARK, store.themeMode.first())
    }

    @Test
    fun valuesSurviveReopeningTheStore() = runBlocking {
        val first = DataStoreSettingsStore(openDataStore())
        first.setThemeMode(ThemeMode.LIGHT)
        closeAll()

        val second = DataStoreSettingsStore(openDataStore())

        assertEquals(ThemeMode.LIGHT, second.themeMode.first())
    }

    @Test
    fun corruptFileIsReplacedAndYieldsDefaults() = runBlocking {
        val file = settingsFile()
        file.writeBytes(ByteArray(64) { (it * 7 + 3).toByte() })
        val store = DataStoreSettingsStore(openDataStore(file))

        assertEquals(ThemeMode.SYSTEM, store.themeMode.first())

        store.setThemeMode(ThemeMode.DARK)
        assertEquals(ThemeMode.DARK, store.themeMode.first())
    }

    @Test
    fun unknownStoredValuesYieldDefaults() = runBlocking {
        val dataStore = openDataStore()
        dataStore.edit {
            it[stringPreferencesKey("theme_mode")] = "NEON"
        }
        val store = DataStoreSettingsStore(dataStore)

        assertEquals(ThemeMode.SYSTEM, store.themeMode.first())
    }

    @Test
    fun aLegacyUiLanguageKeyIsIgnoredBecauseLanguageIsOwnedByAppCompat() = runBlocking {
        val dataStore = openDataStore()
        dataStore.edit {
            it[stringPreferencesKey("theme_mode")] = "LIGHT"
            it[stringPreferencesKey("ui_language")] = "ARABIC"
        }
        val store = DataStoreSettingsStore(dataStore)

        assertEquals(ThemeMode.LIGHT, store.themeMode.first())
    }

    @Test
    fun ioErrorWhileReadingYieldsDefaults() = runBlocking {
        val failing = object : DataStore<Preferences> {
            override val data: Flow<Preferences> = flow { throw IOException("unreadable") }

            override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences =
                throw IOException("unwritable")
        }
        val store = DataStoreSettingsStore(failing)

        assertEquals(ThemeMode.SYSTEM, store.themeMode.first())
    }

    @Test
    fun transientIoErrorYieldsDefaultsThenRecoversForALongLivedCollector() = runBlocking {
        var attempts = 0
        val flaky = object : DataStore<Preferences> {
            override val data: Flow<Preferences> = flow {
                if (attempts++ == 0) throw IOException("transient")
                emit(preferencesOf(stringPreferencesKey("theme_mode") to "DARK"))
            }

            override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences =
                throw IOException("unwritable")
        }
        val store = DataStoreSettingsStore(flaky, retryDelayMillis = 1)

        assertEquals(listOf(ThemeMode.SYSTEM, ThemeMode.DARK), store.themeMode.take(2).toList())
    }

    @Test
    fun onlyApprovedD0KeysArePersisted() = runBlocking {
        val dataStore = openDataStore()
        val store = DataStoreSettingsStore(dataStore)

        store.setThemeMode(ThemeMode.DARK)

        val persisted = dataStore.data.first().asMap().keys.map { it.name }.toSet()
        assertEquals(setOf("theme_mode"), persisted)
        assertEquals(DataStoreSettingsStore.persistedKeyNames, persisted)
    }
}

package com.muslimrecovery.protection.core.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

// One DataStore instance per process for this file, as DataStore requires.
private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "settings",
    corruptionHandler = settingsCorruptionHandler(),
)

/** Creates the on-device [SettingsStore]. Retains only the application context. */
fun createAndroidSettingsStore(context: Context): SettingsStore =
    DataStoreSettingsStore(context.applicationContext.settingsDataStore)

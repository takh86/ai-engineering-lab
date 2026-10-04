package com.muslimrecovery.protection.app

import android.content.Context
import com.muslimrecovery.protection.core.data.SettingsStore
import com.muslimrecovery.protection.core.data.createAndroidSettingsStore

/**
 * Manual composition root (M3-01 §2: manual DI, no Hilt). Holds lazily created singletons.
 *
 * Features must not depend on this class; they receive narrow interfaces by constructor.
 * Dependencies are supplied as factories so tests can inject fakes without a framework.
 */
class AppContainer(
    settingsStoreFactory: () -> SettingsStore,
) {
    val settingsStore: SettingsStore by lazy(settingsStoreFactory)

    companion object {
        /** Production wiring. Only the application context is retained by what it creates. */
        fun create(context: Context): AppContainer {
            val applicationContext = context.applicationContext
            return AppContainer(
                settingsStoreFactory = { createAndroidSettingsStore(applicationContext) },
            )
        }
    }
}

package com.muslimrecovery.protection.app

import com.muslimrecovery.protection.core.data.SettingsStore
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.data.UiLanguage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class AppContainerTest {

    private class FakeSettingsStore : SettingsStore {
        override val themeMode: Flow<ThemeMode> = flowOf(ThemeMode.DARK)
        override val uiLanguage: Flow<UiLanguage> = flowOf(UiLanguage.GERMAN)

        override suspend fun setThemeMode(mode: ThemeMode) = Unit

        override suspend fun setUiLanguage(language: UiLanguage) = Unit
    }

    @Test
    fun settingsStoreIsNotCreatedUntilFirstAccess() {
        var created = 0
        val container = AppContainer(settingsStoreFactory = { created++; FakeSettingsStore() })

        assertEquals(0, created)
        container.settingsStore
        assertEquals(1, created)
    }

    @Test
    fun settingsStoreIsASingleton() {
        var created = 0
        val container = AppContainer(settingsStoreFactory = { created++; FakeSettingsStore() })

        assertSame(container.settingsStore, container.settingsStore)
        assertEquals(1, created)
    }

    @Test
    fun aFakeCanBeInjectedWithoutAnyFramework() {
        val fake = FakeSettingsStore()
        val container = AppContainer(settingsStoreFactory = { fake })

        assertSame(fake, container.settingsStore)
    }
}

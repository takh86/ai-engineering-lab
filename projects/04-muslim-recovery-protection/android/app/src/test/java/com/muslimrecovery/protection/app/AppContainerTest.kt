package com.muslimrecovery.protection.app

import com.muslimrecovery.protection.core.data.SettingsStore
import com.muslimrecovery.protection.core.data.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class AppContainerTest {

    private class FakeSettingsStore : SettingsStore {
        override val themeMode: Flow<ThemeMode> = flowOf(ThemeMode.DARK)

        override suspend fun setThemeMode(mode: ThemeMode) = Unit
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

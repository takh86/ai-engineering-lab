package com.muslimrecovery.protection.core.design

import android.view.View
import androidx.appcompat.app.AppCompatDelegate
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.muslimrecovery.protection.MainActivity
import com.muslimrecovery.protection.core.design.locale.AppCompatLanguageController
import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The AppCompat per-app locale path, end to end on a real activity: a language change recreates the activity with
 * the new locale and layout direction, and SYSTEM is the empty application locale list. On API 30 this exercises the
 * AppCompat backport, on API 34 the platform LocaleManager.
 */
@RunWith(AndroidJUnit4::class)
class AppLanguageControllerTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    @After
    fun backToSystem() {
        instrumentation.runOnMainSync { AppCompatLanguageController.set(SupportedLanguage.SYSTEM) }
    }

    private fun switchAndAwait(scenario: ActivityScenario<MainActivity>, language: SupportedLanguage, rtl: Boolean) {
        instrumentation.runOnMainSync { AppCompatLanguageController.set(language) }
        var observed = ""
        val deadline = System.currentTimeMillis() + 15_000
        while (System.currentTimeMillis() < deadline) {
            instrumentation.waitForIdleSync()
            try {
                scenario.onActivity { activity ->
                    val config = activity.resources.configuration
                    val isRtl = config.layoutDirection == View.LAYOUT_DIRECTION_RTL
                    observed = "${config.locales[0].language}/rtl=$isRtl"
                    if (config.locales[0].language == language.languageTag && isRtl == rtl) observed = "OK"
                }
            } catch (_: IllegalStateException) {
                // the activity is being recreated; try again
            }
            if (observed == "OK") break
            Thread.sleep(250)
        }
        assertEquals("$language must reach the activity configuration", "OK", observed)
        instrumentation.runOnMainSync {
            assertEquals(language, AppCompatLanguageController.current())
            assertTrue(!AppCompatDelegate.getApplicationLocales().isEmpty)
        }
    }

    @Test
    fun switchingLanguageRecreatesTheActivityWithTheLocaleAndDirectionAndSystemResets() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            switchAndAwait(scenario, SupportedLanguage.GERMAN, rtl = false)
            switchAndAwait(scenario, SupportedLanguage.ARABIC, rtl = true)
            switchAndAwait(scenario, SupportedLanguage.ENGLISH, rtl = false)
            instrumentation.runOnMainSync { AppCompatLanguageController.set(SupportedLanguage.SYSTEM) }
            instrumentation.runOnMainSync {
                assertTrue("SYSTEM is the empty application locale list", AppCompatDelegate.getApplicationLocales().isEmpty)
                assertEquals(SupportedLanguage.SYSTEM, AppCompatLanguageController.current())
            }
        }
    }
}

package com.muslimrecovery.protection.feature.onboarding

import android.view.View
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.muslimrecovery.protection.MainActivity
import com.muslimrecovery.protection.core.design.locale.AppCompatLanguageController
import com.muslimrecovery.protection.core.design.locale.SupportedLanguage
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The real language controller and a real activity recreation (the platform recreates the activity on a language
 * change): the ViewModel-held onboarding draft, step and choices survive, nothing is committed, and the language is
 * applied through the single source of truth. Instances are hosted by [MainActivity] only as a ViewModelStoreOwner:
 * this does not wire onboarding into the app.
 */
@RunWith(AndroidJUnit4::class)
class OnboardingRecreationTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    @After
    fun backToSystem() {
        instrumentation.runOnMainSync { AppCompatLanguageController.set(SupportedLanguage.SYSTEM) }
    }

    @Test
    fun aLanguageChangeRecreatesTheActivityButKeepsTheOnboardingDraft() {
        val store = InMemoryOnboardingStore()
        val factory = onboardingViewModelFactory(store, AppCompatLanguageController, faithAvailable = false)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            var before: OnboardingViewModel? = null
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity, factory)[OnboardingViewModel::class.java]
                before = vm
                val h = vm.holder
                h.onEvent(OnboardingEvent.Next)
                h.onEvent(OnboardingEvent.Next)
                h.onEvent(OnboardingEvent.Next)
                h.onEvent(OnboardingEvent.ReasonInputChanged("a draft that must survive"))
                h.onEvent(OnboardingEvent.Back)
                h.onEvent(OnboardingEvent.Back)
                h.onEvent(OnboardingEvent.SetLanguage(SupportedLanguage.GERMAN))
            }
            var observed = ""
            val deadline = System.currentTimeMillis() + 15_000
            while (System.currentTimeMillis() < deadline && observed != "OK") {
                instrumentation.waitForIdleSync()
                try {
                    scenario.onActivity { activity ->
                        val config = activity.resources.configuration
                        observed = if (config.locales[0].language == "de" &&
                            config.layoutDirection == View.LAYOUT_DIRECTION_LTR
                        ) {
                            val vm = ViewModelProvider(activity, factory)[OnboardingViewModel::class.java]
                            assertSame("the same ViewModel instance after recreation", before, vm)
                            val state = vm.holder.state.value
                            assertEquals(OnboardingStep.LANGUAGE, state.step)
                            assertEquals(SupportedLanguage.GERMAN, state.language)
                            assertEquals("a draft that must survive", state.reasonInput)
                            "OK"
                        } else {
                            "${config.locales[0].language}"
                        }
                    }
                } catch (_: IllegalStateException) {
                    // the activity is being recreated; try again
                }
                if (observed != "OK") Thread.sleep(250)
            }
            assertEquals("German must reach the activity configuration", "OK", observed)
            instrumentation.runOnMainSync {
                assertEquals(SupportedLanguage.GERMAN, AppCompatLanguageController.current())
            }
            assertNull("a language change must never commit anything", store.snapshot())
        }
    }
}

package com.muslimrecovery.protection.app

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.MainActivity
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** PLAY flavor: the historical experiment must not exist at runtime. Compiled in CI; execution deferred (D-17). */
@RunWith(AndroidJUnit4::class)
class PlayHasNoHistoricalExperimentTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun theShellOffersNoInternalHarnessEntry() {
        rule.onNodeWithTag("internal_harness_entry").assertDoesNotExist()
    }

    @Test
    fun theHistoricalClassesAreNotInTheApp() {
        for (name in listOf(
            "com.muslimrecovery.protection.ExperimentalHarnessActivity",
            "com.muslimrecovery.protection.vpn.LocalProtectionVpnService",
            "com.muslimrecovery.protection.dns.DnsFilteringEngine",
        )) {
            try {
                Class.forName(name)
                fail("$name must not exist in the play flavor")
            } catch (expected: ClassNotFoundException) {
                // good
            }
        }
    }
}

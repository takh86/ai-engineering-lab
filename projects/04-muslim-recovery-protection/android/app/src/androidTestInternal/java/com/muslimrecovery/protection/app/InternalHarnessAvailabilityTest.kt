package com.muslimrecovery.protection.app

import android.content.ComponentName
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.ExperimentalHarnessActivity
import com.muslimrecovery.protection.MainActivity
import com.muslimrecovery.protection.vpn.LocalProtectionVpnService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** INTERNAL flavor: the historical experiment stays reachable and correctly guarded. Compiled in CI; execution deferred (D-17). */
@RunWith(AndroidJUnit4::class)
class InternalHarnessAvailabilityTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun theShellOffersTheHarnessEntry() {
        rule.onNodeWithTag(INTERNAL_HARNESS_ENTRY_TAG).assertIsDisplayed()
    }

    @Test
    fun theHarnessIsDeclaredAndNotExported() {
        val info = rule.activity.packageManager.getActivityInfo(
            ComponentName(rule.activity, ExperimentalHarnessActivity::class.java), 0,
        )
        assertFalse("the internal harness must not be exported", info.exported)
    }

    @Test
    fun theVpnServiceIsDeclaredAndGuardedBySystemBindPermission() {
        val info = rule.activity.packageManager.getServiceInfo(
            ComponentName(rule.activity, LocalProtectionVpnService::class.java), 0,
        )
        assertEquals("android.permission.BIND_VPN_SERVICE", info.permission)
    }
}

package com.muslimrecovery.protection.app

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.muslimrecovery.protection.MainActivity
import com.muslimrecovery.protection.R
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Product shell launch test (all flavors). Compiled in CI; emulator execution arrives with the first integrated UI (D-17). */
@RunWith(AndroidJUnit4::class)
class ProductShellTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun theShellLaunchesAndShowsTheAppName() {
        val appName = rule.activity.getString(R.string.app_name)
        rule.onNodeWithTag(PRODUCT_SHELL_TITLE_TAG).assertTextEquals(appName)
    }
}

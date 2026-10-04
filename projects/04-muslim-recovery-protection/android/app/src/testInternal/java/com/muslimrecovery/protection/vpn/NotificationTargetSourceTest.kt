package com.muslimrecovery.protection.vpn

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Regression guard for the approved W0b edit: the VPN foreground notification must open
 * ExperimentalHarnessActivity, never the product shell. A real PendingIntent cannot be built in a JVM unit
 * test, so this reads the service source; the instrumentation test in androidTestInternal checks the
 * target component resolves.
 */
class NotificationTargetSourceTest {

    private val source: String by lazy {
        File("src/internal/java/com/muslimrecovery/protection/vpn/LocalProtectionVpnService.kt").readText()
    }

    @Test
    fun theNotificationContentIntentTargetsTheExperimentalHarness() {
        assertTrue(source.contains("Intent(this, ExperimentalHarnessActivity::class.java)"))
        assertTrue(source.contains("import com.muslimrecovery.protection.ExperimentalHarnessActivity"))
    }

    @Test
    fun theServiceNoLongerReferencesTheProductShell() {
        assertFalse(Regex("\\bMainActivity\\b").containsMatchIn(source))
    }
}

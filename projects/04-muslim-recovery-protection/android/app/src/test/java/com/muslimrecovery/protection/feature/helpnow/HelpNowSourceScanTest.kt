package com.muslimrecovery.protection.feature.helpnow

import com.muslimrecovery.protection.architecture.BoundaryRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Source scans for the F3 boundaries: persists nothing, logs nothing, needs no permission or background
 * component, and contains no protection behavior (F3 is recovery-first help, not a blocking or security feature).
 */
class HelpNowSourceScanTest {
    private val dir = File("src/main/java/com/muslimrecovery/protection/feature/helpnow")

    private fun sources(): List<File> = dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    private fun code(f: File) = BoundaryRules.stripComments(f.readText())

    private fun hits(patterns: List<Regex>): List<String> =
        sources().flatMap { f -> patterns.filter { it.containsMatchIn(code(f)) }.map { "${f.name}: ${it.pattern}" } }

    @Test
    fun theScanSeesTheFeatureFiles() {
        assertTrue(sources().size >= 8)
    }

    @Test
    fun nothingIsPersisted() {
        val forbidden = listOf(
            "SharedPreferences", "DataStore", "SettingsStore", "PreferenceManager", "SavedStateHandle", "rememberSaveable",
            "onSaveInstanceState", "Parcelable", "Serializable", "openFileOutput", "FileOutputStream", "FileWriter",
            "writeText", "java\\.io\\.File", "\\bRoom\\b", "SQLite", "ContentResolver\\.insert", "MediaStore", "Bundle",
            "RecoveryProfileStore",
        ).map { Regex("\\b$it|$it") }
        assertEquals(emptyList<String>(), hits(forbidden))
    }

    @Test
    fun nothingIsLoggedOrSentAnywhere() {
        val forbidden = listOf(
            "android\\.util\\.Log", "\\bLog\\.", "println\\(", "\\bprint\\(", "Timber", "Logger", "printStackTrace",
            "HttpURLConnection", "\\bURL\\(", "OkHttp", "Socket", "https?://", "Firebase", "Analytics", "Crashlytics",
        ).map { Regex(it) }
        assertEquals(emptyList<String>(), hits(forbidden))
    }

    @Test
    fun noPermissionNotificationServiceWakeLockOrVibration() {
        val forbidden = listOf(
            "Manifest\\.permission", "checkSelfPermission", "requestPermission", "NotificationManager", "NotificationCompat",
            "\\bService\\b", "startForeground", "WakeLock", "PowerManager", "Vibrator", "VibrationEffect", "AlarmManager",
            "WorkManager", "BroadcastReceiver", "JobScheduler",
        ).map { Regex(it) }
        assertEquals(emptyList<String>(), hits(forbidden))
    }

    @Test
    fun noProtectionBehaviorCrossesTheBoundary() {
        val forbidden = listOf(
            "VpnService", "AccessibilityService", "AccessibilityEvent", "UsageStatsManager", "BiometricPrompt",
            "domain\\.protection", "domain\\.rules", "ProtectionState", "RuleSet", "\\.vpn\\.", "\\.dns\\.", "\\.experimental\\.",
            "DevicePolicyManager", "MediaProjection", "ScreenCapture", "TrustedPerson[A-Z]\\w*Report", "SmsManager",
        ).map { Regex(it) }
        assertEquals(emptyList<String>(), hits(forbidden))
    }

    @Test
    fun theStateMachineTimerAndPolicyAreFreeOfAndroidAndCompose() {
        val pure = listOf("HelpNowState.kt", "SuggestionPolicy.kt", "HelpNowModel.kt", "PersonalSupport.kt")
        for (name in pure) {
            val text = code(File(dir, name))
            assertTrue("$name must not import android or compose", !Regex("import\\s+(android|androidx)\\.").containsMatchIn(text))
        }
        // the timer file may only reach Android through the production clock
        val timer = code(File(dir, "HelpNowTimer.kt"))
        assertEquals(listOf("android.os.SystemClock"), Regex("android\\.[a-zA-Z.]+[A-Za-z]").findAll(timer).map { it.value }.toList())
    }

    @Test
    fun aPlainLanguageCopyScanFindsNoRecoveryClaimsOrShame() {
        val text = File("src/main/res/values/strings_helpnow.xml").readText()
        val banned = listOf(
            "cure", "cured", "heal", "healed", "treatment", "therapy", "diagnos\\w*", "addict\\w*", "streak\\w*", "relapse\\w*",
            "shame\\w*", "guilt\\w*", "fail\\w*", "weak\\w*", "dopamine", "protect\\w*", "block\\w*", "guarantee\\w*",
            "will pass", "always works", "clinically", "proven",
        )
        for (word in banned) {
            val match = Regex("\\b$word\\b", RegexOption.IGNORE_CASE).find(text)
            assertTrue("copy contains '${match?.value}' (matched $word)", match == null)
        }
    }
}

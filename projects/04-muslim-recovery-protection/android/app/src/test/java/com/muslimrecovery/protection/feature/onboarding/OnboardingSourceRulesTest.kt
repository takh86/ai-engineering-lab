package com.muslimrecovery.protection.feature.onboarding

import com.muslimrecovery.protection.architecture.BoundaryRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * F1 source and package boundaries: the feature writes nothing itself (no D0/D1 persistence, no saved instance state),
 * logs nothing, uses no network, permission, protection or biometric API, and its in-memory store is never wired into
 * a product source set. Regex scans over comment-stripped code: they catch the forms listed, not every conceivable one.
 */
class OnboardingSourceRulesTest {
    private val featureDir = File("src/main/java/com/muslimrecovery/protection/feature/onboarding")

    private fun featureFiles(): List<File> = featureDir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    private val forbidden = listOf(
        "logging" to Regex("""\b(?:Log\s*\.\s*[a-z]+|println|print|Timber|Logger|printStackTrace)\s*\("""),
        "android.util.Log import" to Regex("""import\s+android\.util\.Log\b"""),
        "persistence" to Regex("""\b(?:SharedPreferences|DataStore|SettingsStore|AndroidSettingsStore|openFileOutput|FileOutputStream|FileWriter|Room|SQLite|PreferenceManager)\b"""),
        "saved instance state" to Regex("""\b(?:SavedStateHandle|rememberSaveable|onSaveInstanceState|SaveableStateRegistry|mutableStateSaver|listSaver|mapSaver)\b"""),
        "network" to Regex("""\b(?:HttpURLConnection|OkHttp|URLConnection|Socket|Retrofit|java\.net|android\.net|WebView)\b"""),
        "protection / permissions / biometrics / accessibility" to
            Regex("""\b(?:VpnService|AccessibilityService|BiometricPrompt|BiometricManager|requestPermissions|RequestPermission|ActivityResultContracts|checkSelfPermission|DevicePolicyManager|UsageStatsManager)\b"""),
        "clipboard / sharing / analytics" to Regex("""\b(?:ClipboardManager|LocalClipboard|ClipData|Intent|FirebaseAnalytics|Analytics|Crashlytics)\b"""),
        "other feature or app wiring" to Regex("""\bcom\.muslimrecovery\.protection\.(?:feature\.(?!onboarding)|app\.|experimental|vpn|dns)"""),
    )

    @Test
    fun theScanSeesTheFeature() {
        val names = featureFiles().map { it.name }
        assertTrue("saw $names", names.containsAll(listOf("OnboardingModel.kt", "OnboardingStateHolder.kt", "OnboardingContent.kt", "OnboardingRoute.kt")))
    }

    @Test
    fun featureCodeHasNoForbiddenApi() {
        val found = featureFiles().flatMap { file ->
            val code = BoundaryRules.stripComments(file.readText())
            forbidden.filter { (_, rule) -> rule.containsMatchIn(code) }.map { (name, _) -> "${file.name}: $name" }
        }
        assertEquals(emptyList<String>(), found)
    }

    @Test
    fun theRulesRejectSyntheticViolations() {
        fun hit(source: String) = forbidden.any { (_, rule) -> rule.containsMatchIn(BoundaryRules.stripComments(source)) }
        assertTrue(hit("Log.d(\"x\", reason)"))
        assertTrue(hit("println(reason)"))
        assertTrue(hit("val s = rememberSaveable { 1 }"))
        assertTrue(hit("val p: SharedPreferences"))
        assertTrue(hit("import com.muslimrecovery.protection.feature.help.X"))
        assertTrue(!hit("// Log.d(\"x\") in a comment only\nval ok = 1"))
    }

    @Test
    fun theInMemoryStoreIsNotReferencedByAnyProductSourceOutsideTheFeature() {
        val offenders = listOf("main", "play").flatMap { set ->
            File("src/$set").walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java") }.toList()
        }.filter { file ->
            !file.invariantSeparatorsPath.contains("/feature/onboarding/") &&
                BoundaryRules.stripComments(file.readText()).contains("InMemoryOnboardingStore")
        }.map { it.invariantSeparatorsPath }
        assertEquals("only developer (src/internal) wiring and tests may use the in-memory store", emptyList<String>(), offenders)
    }

    @Test
    fun thePortHasNoWayToSetCompletionOnItsOwn() {
        val methods = OnboardingStore::class.java.declaredMethods.map { it.name }
        assertEquals("commit is the only write, so completion cannot exist without the choice", listOf("commitOnboarding"), methods)
    }

    @Test
    fun noRecoveryDataTypeEscapesIntoSharedPackages() {
        val shared = File("src/main/java/com/muslimrecovery/protection/core")
        val leaks = shared.walkTopDown().filter { it.isFile && it.extension == "kt" }
            .filter { BoundaryRules.stripComments(it.readText()).contains("feature.onboarding") }
            .map { it.name }.toList()
        assertEquals(emptyList<String>(), leaks)
    }
}

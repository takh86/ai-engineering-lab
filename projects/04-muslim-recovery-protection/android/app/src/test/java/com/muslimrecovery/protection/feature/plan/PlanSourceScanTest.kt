package com.muslimrecovery.protection.feature.plan

import com.muslimrecovery.protection.architecture.BoundaryRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Proof that F5 contains no insecure D1 persistence, logging, network, clipboard, saved-state or sharing path.
 * The rules are a pure function so they are exercised against synthetic violating sources as well as the real tree.
 * Plan content is D1: it may exist only in memory (ViewModel/controller) until F7 provides secure storage.
 */
internal object PlanSourceRules {
    private val banned = listOf(
        "logging" to Regex("""\b(?:Log|Timber|Logger)\s*\.|\bprintln\b|\bprint\s*\(|\bprintStackTrace\b|\bandroid\.util\.Log\b|\bjava\.util\.logging\b"""),
        "preferences/datastore" to Regex("""SharedPreferences|PreferenceManager|getSharedPreferences|androidx\.datastore|\bDataStore\b|\bSettingsStore\b|\bAndroidSettingsStore\b|\bDataStoreSettingsStore\b|core\.data"""),
        "files" to Regex("""\bjava\.io\.|\bjava\.nio\.file|\bFileOutputStream\b|\bFileWriter\b|\bopenFileOutput\b|\bfilesDir\b|\bcacheDir\b|\bgetExternal\w*|\bContext\b\s*\.\s*openFile|\bwriteText\b|\bwriteBytes\b|\bappendText\b|\bFile\s*\("""),
        "database" to Regex("""\bandroidx\.room\b|\bSQLiteDatabase\b|\bSQLiteOpenHelper\b|android\.database"""),
        "network" to Regex("""\bjava\.net\.|\bokhttp3?\b|\bHttpURLConnection\b|\bretrofit\b|\bandroid\.net\b|\bWebView\b|\bConnectivityManager\b"""),
        "clipboard/sharing" to Regex("""\bClipboardManager\b|\bClipData\b|\bLocalClipboard\w*|\bLocalClipboardManager\b|\bIntent\b|\bShareCompat\b|\bFileProvider\b|\bContentResolver\b"""),
        "saved state/serialization" to Regex("""\bSavedStateHandle\b|\brememberSaveable\b|\bSaver\b|\bBundle\b|\bParcelable\b|\bParcelize\b|\bSerializable\b|\bkotlinx\.serialization\b|\bonSaveInstanceState\b|\bSavedStateRegistry\b|\bmapSaver\b|\blistSaver\b"""),
        "reflection/export" to Regex("""\bjava\.lang\.reflect\b|\bClass\.forName\b|\bWorkManager\b|\bNotificationManager\b|\bNotificationCompat\b|\bAutofill\w*"""),
    )

    fun violations(path: String, source: String): List<String> {
        val code = BoundaryRules.stripComments(source)
        return banned.filter { (_, rule) -> rule.containsMatchIn(code) }.map { (name, rule) -> "$path: $name (${rule.pattern.take(40)}...)" }
    }
}

class PlanSourceScanTest {
    private fun planSources(): List<File> =
        (File("src").listFiles() ?: emptyArray())
            .filter { it.isDirectory && !it.name.startsWith("test") && !it.name.startsWith("androidTest") }
            .flatMap { set ->
                listOf("java", "kotlin").flatMap { dir ->
                    File(set, "$dir/com/muslimrecovery/protection/feature/plan").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
                }
            }

    @Test
    fun realPlanSourcesHaveNoPersistenceLoggingNetworkClipboardOrSavedState() {
        val files = planSources()
        assertTrue("scan must see the plan sources", files.size >= 6)
        assertTrue(files.any { it.name == "PlanStore.kt" } && files.any { it.name == "PlanScreen.kt" })
        assertEquals(emptyList<String>(), files.flatMap { PlanSourceRules.violations(it.name, it.readText()) })
    }

    @Test
    fun onlyTheFeatureLocalInMemoryStoreImplementsThePort() {
        val implementers = planSources().filter { Regex("""\)\s*:\s*PlanStore\b|:\s*PlanStore\s*\{""").containsMatchIn(BoundaryRules.stripComments(it.readText())) }
        assertEquals(listOf("PlanStore.kt"), implementers.map { it.name })
        assertTrue(implementers.single().readText().contains("class InMemoryPlanStore"))
    }

    @Test
    fun noOtherProductSourceReferencesThePlanContentOutsideTheFeature() {
        val base = "com/muslimrecovery/protection/"
        val offenders = (File("src").listFiles() ?: emptyArray())
            .filter { it.isDirectory && !it.name.startsWith("test") && !it.name.startsWith("androidTest") }
            .flatMap { set -> File(set, "java").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList() }
            .filter { !it.invariantSeparatorsPath.contains("${base}feature/plan/") }
            .filter { it.readText().contains("feature.plan") }
            .map { it.name }
        assertEquals("only the Integration Agent wires F5 later; nothing wires it now", emptyList<String>(), offenders)
    }

    private fun v(src: String) = PlanSourceRules.violations("X.kt", src)

    @Test
    fun rulesRejectEveryForbiddenFormAndAcceptCleanCode() {
        val bad = listOf(
            "Log.d(\"t\", text)", "android.util.Log.e(a, b)", "println(text)", "e.printStackTrace()", "Timber.d(x)",
            "context.getSharedPreferences(\"p\", 0)", "import androidx.datastore.preferences.core.edit", "val s: SettingsStore",
            "import com.muslimrecovery.protection.core.data.SettingsStore", "File(dir, \"plan.json\").writeText(t)",
            "context.openFileOutput(\"x\", 0)", "java.io.FileOutputStream(f)", "context.filesDir",
            "import androidx.room.Entity", "SQLiteDatabase.openDatabase()",
            "java.net.URL(u).openStream()", "import okhttp3.Request",
            "LocalClipboardManager.current.setText(t)", "ClipboardManager", "Intent(Intent.ACTION_SEND)",
            "val h: SavedStateHandle", "rememberSaveable { mutableStateOf(t) }", "Bundle()", "class A : Parcelable", "class A : java.io.Serializable",
            "@Serializable class P", "WorkManager.getInstance(c)",
        )
        for (src in bad) assertTrue(src, v(src).isNotEmpty())
        assertEquals(emptyList<String>(), v("val state by viewModel.state.collectAsState()\nrememberCoroutineScope()"))
        assertEquals(emptyList<String>(), v("// Log.d(x) and SharedPreferences in a comment only\n/* println */ val x = 1"))
    }
}

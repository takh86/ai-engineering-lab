package com.muslimrecovery.protection.architecture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PackageBoundaryTest {

    private val basePath = "com/muslimrecovery/protection/"

    private fun scan(sourceSet: String): List<String> {
        val root = File("src/$sourceSet/java")
        if (!root.isDirectory) return emptyList()
        return root.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .flatMap { file ->
                val normalized = file.invariantSeparatorsPath
                val index = normalized.indexOf(basePath)
                if (index < 0) {
                    emptySequence()
                } else {
                    val rel = normalized.substring(index + basePath.length)
                    BoundaryRules.violations(sourceSet, rel, file.readText()).asSequence()
                }
            }
            .toList()
    }

    @Test
    fun realMainSourcesRespectBoundaries() {
        assertTrue("src/main/java must be found from the unit-test working directory", File("src/main/java").isDirectory)
        val scanned = File("src/main/java").walkTopDown().count { it.isFile && it.extension == "kt" }
        assertTrue("Expected the scan to cover the real tree, got $scanned files", scanned >= 20)
        assertEquals(emptyList<String>(), scan("main"))
    }

    @Test
    fun realPlaySourcesRespectBoundaries() {
        assertEquals(emptyList<String>(), scan("play"))
    }

    // --- The rules must reject known-bad synthetic sources and accept good ones. ---

    private fun v(sourceSet: String, rel: String, src: String) = BoundaryRules.violations(sourceSet, rel, src)

    @Test
    fun mainAppAndRootMayNotImportExperimental() {
        val bad = "import com.muslimrecovery.protection.experimental.dns.Thing\nclass A"
        assertEquals(1, v("main", "app/AppContainer.kt", bad).size)
        assertEquals(1, v("main", "MainActivity.kt", bad).size)
    }

    @Test
    fun playMayNotImportExperimental() {
        val bad = "import com.muslimrecovery.protection.experimental.api.Client\nclass P"
        assertEquals(1, v("play", "app/ExperimentalFeaturesProvider.kt", bad).size)
    }

    @Test
    fun wildcardAndFullyQualifiedExperimentalReferencesAreRejected() {
        assertEquals(1, v("main", "app/A.kt", "import com.muslimrecovery.protection.experimental.*").size)
        assertEquals(
            1,
            v("main", "app/A.kt", "val x = com.muslimrecovery.protection.experimental.webguard.Probe()").size,
        )
    }

    @Test
    fun coreAndFeatureMayNeverImportExperimental() {
        val bad = "import com.muslimrecovery.protection.experimental.webguard.Probe"
        assertTrue(v("main", "core/data/X.kt", bad).isNotEmpty())
        assertTrue(v("main", "feature/home/X.kt", bad).isNotEmpty())
    }

    @Test
    fun internalCompositionWiringMayImportExperimental() {
        val wiring = "import com.muslimrecovery.protection.experimental.dns.DnsExperiment\nclass W"
        assertEquals(emptyList<String>(), v("internal", "app/ExperimentalFeaturesProvider.kt", wiring))
    }

    @Test
    fun coreMustNotDependOnFeature() {
        val bad = "import com.muslimrecovery.protection.feature.home.HomeScreen"
        assertEquals(1, v("main", "core/design/Theme.kt", bad).size)
    }

    @Test
    fun featureMustNotDependOnAnotherFeatureButMayUseItself() {
        val other = "import com.muslimrecovery.protection.feature.plan.PlanRepository"
        val self = "import com.muslimrecovery.protection.feature.home.HomeState"
        assertEquals(1, v("main", "feature/home/HomeScreen.kt", other).size)
        assertEquals(emptyList<String>(), v("main", "feature/home/HomeScreen.kt", self))
    }

    @Test
    fun featureMayDependOnCore() {
        val ok = "import com.muslimrecovery.protection.core.data.SettingsStore"
        assertEquals(emptyList<String>(), v("main", "feature/home/HomeScreen.kt", ok))
    }

    @Test
    fun coreFeatureAndAppMayNotUseHistoricalVpnOrDns() {
        assertEquals(1, v("main", "core/data/X.kt", "import com.muslimrecovery.protection.vpn.VpnRuntimeStatus").size)
        assertEquals(1, v("main", "feature/home/X.kt", "import com.muslimrecovery.protection.dns.DnsProxyStatus").size)
        assertEquals(1, v("main", "app/X.kt", "import com.muslimrecovery.protection.vpn.LocalProtectionVpnService").size)
    }

    @Test
    fun historicalRootHarnessMayStillUseVpnAndDnsInW0a() {
        val harness = "import com.muslimrecovery.protection.vpn.VpnRuntimeStatus\nclass MainActivity"
        assertEquals(emptyList<String>(), v("main", "MainActivity.kt", harness))
    }

    @Test
    fun mentionsInCommentsAreNotReferences() {
        val src = "// see com.muslimrecovery.protection.experimental.dns\n/* com.muslimrecovery.protection.experimental */\nclass A"
        assertEquals(emptyList<String>(), v("main", "app/A.kt", src))
    }
}

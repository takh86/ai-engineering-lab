package com.muslimrecovery.protection.architecture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PackageBoundaryTest {

    private val basePath = "com/muslimrecovery/protection/"

    private fun sourceSets(): List<String> =
        (File("src").listFiles() ?: emptyArray())
            .filter { it.isDirectory }
            .map { it.name }
            // Unit/instrumentation test source sets are not product code.
            .filterNot { it.startsWith("test") || it.startsWith("androidTest") }
            .sorted()

    private fun sourceFiles(sourceSet: String): List<File> =
        listOf("java", "kotlin").flatMap { dir ->
            val root = File("src/$sourceSet/$dir")
            if (root.isDirectory) {
                root.walkTopDown().filter { it.isFile && (it.extension == "kt" || it.extension == "java") }.toList()
            } else {
                emptyList()
            }
        }

    private fun scan(sourceSet: String): List<String> =
        sourceFiles(sourceSet).flatMap { file ->
            val normalized = file.invariantSeparatorsPath
            val index = normalized.indexOf(basePath)
            if (index < 0) {
                listOf("$sourceSet: $normalized is outside the com/muslimrecovery/protection package")
            } else {
                BoundaryRules.violations(sourceSet, normalized.substring(index + basePath.length), file.readText())
            }
        }

    @Test
    fun everyRealSourceSetRespectsTheBoundaries() {
        val sets = sourceSets()
        assertTrue("src/main must be found from the unit-test working directory: $sets", "main" in sets)
        assertEquals(emptyList<String>(), sets.flatMap { scan(it) })
    }

    @Test
    fun theScanIsNotVacuous() {
        val main = sourceFiles("main").map { it.invariantSeparatorsPath }
        assertTrue("expected the scan to see the foundation files, saw ${main.size} files", main.size >= 5)
        assertTrue(main.any { it.endsWith("app/AppContainer.kt") })
        assertTrue(main.any { it.endsWith("core/data/SettingsStore.kt") })
    }

    // --- The rules must reject known-bad synthetic sources and accept good ones. ---

    private fun v(sourceSet: String, rel: String, body: String): List<String> {
        val pkg = (listOf("com.muslimrecovery.protection") + rel.split('/').dropLast(1)).joinToString(".")
        val src = if (body.contains("package ")) body else "package $pkg\n$body"
        return BoundaryRules.violations(sourceSet, rel, src)
    }

    private val exp = "import com.muslimrecovery.protection.experimental.dns.Thing\nclass A"

    @Test
    fun mainAndPlayMayNotReferenceExperimentalAnywhere() {
        assertEquals(1, v("main", "app/AppContainer.kt", exp).size)
        assertEquals(1, v("main", "MainActivity.kt", exp).size)
        assertEquals(1, v("play", "app/ExperimentalFeaturesProvider.kt", exp).size)
        assertEquals(1, v("playRelease", "app/X.kt", exp).size)
    }

    @Test
    fun onlyInternalAppWiringMayReferenceExperimental() {
        assertEquals(emptyList<String>(), v("internal", "app/ExperimentalFeaturesProvider.kt", exp))
        assertEquals(1, v("internal", "core/data/X.kt", exp).size)
        assertEquals(1, v("internal", "feature/home/X.kt", exp).size)
    }

    @Test
    fun coreAndFeatureMayNeverImportExperimental() {
        assertTrue(v("main", "core/data/X.kt", exp).isNotEmpty())
        assertTrue(v("main", "feature/home/X.kt", exp).isNotEmpty())
    }

    @Test
    fun wildcardFullyQualifiedBacktickedAndSpacedReferencesAreRejected() {
        assertEquals(1, v("main", "app/A.kt", "import com.muslimrecovery.protection.experimental.*").size)
        assertEquals(1, v("main", "app/A.kt", "val x = com.muslimrecovery.protection.experimental.webguard.Probe()").size)
        assertEquals(1, v("main", "app/A.kt", "val x = com.muslimrecovery.protection.`experimental`.webguard.Probe()").size)
        assertEquals(1, v("main", "app/A.kt", "val x = com.muslimrecovery.protection . experimental .webguard.Probe()").size)
        assertEquals(1, v("main", "app/A.kt", "import com.muslimrecovery.protection.*").size)
    }

    @Test
    fun stringLiteralsAreReflectionPathsAndCountAsReferences() {
        val src = "val c = Class.forName(\"com.muslimrecovery.protection.experimental.dns.Thing\")"
        assertEquals(1, v("main", "app/A.kt", src).size)
    }

    @Test
    fun commentEvasionTricksDoNotHideReferences() {
        // '//' inside a string literal must not swallow the rest of the line.
        val urlTrick = "val u = \"http://x\"; val p = com.muslimrecovery.protection.experimental.Probe()"
        assertEquals(1, v("main", "app/A.kt", urlTrick).size)
        // '/*' inside a string literal must not start a block comment that hides later code.
        val mimeTrick = "val m = \"image/*\"\nval p = com.muslimrecovery.protection.experimental.Probe()\n/* real comment */"
        assertEquals(1, v("main", "app/A.kt", mimeTrick).size)
    }

    @Test
    fun mentionsInRealCommentsAreNotReferences() {
        val src = "// see com.muslimrecovery.protection.experimental.dns\n" +
            "/* com.muslimrecovery.protection.experimental /* nested */ still comment */\nclass A"
        assertEquals(emptyList<String>(), v("main", "app/A.kt", src))
    }

    @Test
    fun packageDeclarationMustMatchTheDirectory() {
        val liar = "package com.muslimrecovery.protection.app\nimport com.muslimrecovery.protection.experimental.dns.T"
        val violations = v("main", "feature/home/X.kt", liar)
        assertTrue(violations.any { it.contains("does not match its directory") })
        assertTrue(v("main", "core/data/X.kt", "class NoPackage").isNotEmpty() ||
            BoundaryRules.violations("main", "core/data/X.kt", "class NoPackage").isNotEmpty())
    }

    @Test
    fun coreMustNotDependOnFeatureOrApp() {
        assertEquals(1, v("main", "core/design/Theme.kt", "import com.muslimrecovery.protection.feature.home.HomeScreen").size)
        assertEquals(1, v("main", "core/data/X.kt", "import com.muslimrecovery.protection.app.AppContainer").size)
    }

    @Test
    fun featureMustNotDependOnAnotherFeatureOrAppButMayUseItselfAndCore() {
        val other = "import com.muslimrecovery.protection.feature.plan.PlanRepository"
        val self = "import com.muslimrecovery.protection.feature.home.HomeState"
        val core = "import com.muslimrecovery.protection.core.data.SettingsStore"
        assertEquals(1, v("main", "feature/home/HomeScreen.kt", other).size)
        assertEquals(1, v("main", "feature/home/HomeScreen.kt", "import com.muslimrecovery.protection.app.AppContainer").size)
        assertEquals(emptyList<String>(), v("main", "feature/home/HomeScreen.kt", self))
        assertEquals(emptyList<String>(), v("main", "feature/home/HomeScreen.kt", core))
    }

    @Test
    fun coreFeatureAndAppMayNotUseHistoricalVpnOrDns() {
        assertEquals(1, v("main", "core/data/X.kt", "import com.muslimrecovery.protection.vpn.VpnRuntimeStatus").size)
        assertEquals(1, v("main", "feature/home/X.kt", "import com.muslimrecovery.protection.dns.DnsProxyStatus").size)
        assertEquals(1, v("main", "app/X.kt", "import com.muslimrecovery.protection.vpn.LocalProtectionVpnService").size)
    }

    @Test
    fun productSourceSetsMayNotReferenceTheHistoricalExperimentInAnyFile() {
        val vpn = "import com.muslimrecovery.protection.vpn.VpnRuntimeStatus"
        val dns = "val x = com.muslimrecovery.protection.dns.DnsProxyStatus"
        assertEquals(1, v("main", "MainActivity.kt", vpn).size)
        assertEquals(1, v("main", "domain/protection/X.kt", dns).size)
        assertEquals(1, v("play", "app/X.kt", vpn).size)
        assertEquals(1, v("main", "MainActivity.kt", "import com.muslimrecovery.protection.ExperimentalHarnessActivity").size)
        assertEquals(1, v("playRelease", "X.kt", "class X { val c = ExperimentalHarnessActivity::class.java }").size)
    }

    @Test
    fun theInternalSourceSetMayUseTheHistoricalExperimentAtItsRootAndInItsOwnPackages() {
        val harness = "import com.muslimrecovery.protection.vpn.VpnRuntimeStatus\nclass ExperimentalHarnessActivity"
        assertEquals(emptyList<String>(), v("internal", "ExperimentalHarnessActivity.kt", harness))
        assertEquals(emptyList<String>(), v("internal", "vpn/X.kt", "import com.muslimrecovery.protection.dns.DnsProxyStatus"))
        assertEquals(
            emptyList<String>(),
            v("internal", "app/InternalToolsEntry.kt", "import com.muslimrecovery.protection.ExperimentalHarnessActivity"),
        )
    }

    @Test
    fun insideInternalCoreFeatureAndAppStillMustNotUseVpnOrDns() {
        assertEquals(1, v("internal", "core/data/X.kt", "import com.muslimrecovery.protection.vpn.VpnRuntimeStatus").size)
        assertEquals(1, v("internal", "app/X.kt", "import com.muslimrecovery.protection.dns.DnsProxyStatus").size)
    }

    @Test
    fun theHistoricalExperimentLivesOnlyInTheInternalSourceSet() {
        fun files(set: String) = sourceFiles(set).map { it.invariantSeparatorsPath.substringAfter(basePath) }
        val main = files("main")
        assertTrue("main must not contain vpn/dns/harness: $main", main.none {
            it.startsWith("vpn/") || it.startsWith("dns/") || it.contains("ExperimentalHarnessActivity")
        })
        val play = files("play")
        assertTrue("play must not contain vpn/dns/harness: $play", play.none {
            it.startsWith("vpn/") || it.startsWith("dns/") || it.contains("ExperimentalHarnessActivity")
        })
        val internal = files("internal")
        assertTrue(internal.contains("ExperimentalHarnessActivity.kt"))
        assertTrue(internal.contains("vpn/LocalProtectionVpnService.kt"))
        assertEquals(8, internal.count { it.startsWith("vpn/") })
        assertEquals(7, internal.count { it.startsWith("dns/") })
    }

    @Test
    fun historicalTestsLiveInTheInternalTestSourceSetAndNotInTheSharedOne() {
        fun testFiles(set: String) = File("src/$set/java").walkTopDown().filter { it.isFile && it.extension == "kt" }
            .map { it.invariantSeparatorsPath.substringAfter(basePath) }.toList()
        val shared = testFiles("test")
        assertTrue("shared tests must not need the moved implementation: $shared", shared.none {
            it.startsWith("vpn/") || it.startsWith("dns/")
        })
        val internalTests = testFiles("testInternal")
        val historicalTests = listOf(
            "vpn/CapturedNetworkWatchTest.kt", "vpn/UnderlyingNetworkInvalidationLifecycleTest.kt",
            "vpn/VpnLifecycleControllerTest.kt", "vpn/VpnRuntimeFactsTest.kt",
            "dns/DnsFilteringEngineTest.kt", "dns/DnsMessageCodecTest.kt", "dns/DnsPacketProcessorTest.kt",
            "dns/DnsParserRobustnessTest.kt", "dns/Ipv4UdpDnsPacketAdapterTest.kt", "dns/UpstreamDnsSelectorTest.kt",
            "dns/DnsTestPackets.kt",
        )
        assertTrue("missing historical tests: ${historicalTests - internalTests.toSet()}", internalTests.containsAll(historicalTests))
    }
}

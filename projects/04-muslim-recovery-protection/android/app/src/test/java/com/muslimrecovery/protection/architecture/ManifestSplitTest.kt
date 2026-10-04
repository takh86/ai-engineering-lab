package com.muslimrecovery.protection.architecture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Source-level proof of the W0b manifest split (the built play/internal artifacts are checked separately
 * in CI by the release-boundary scripts). Reads `src/<flavor>/AndroidManifest.xml` with comments removed.
 */
class ManifestSplitTest {

    private val comment = Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL)

    private fun manifest(sourceSet: String): String? {
        val file = File("src/$sourceSet/AndroidManifest.xml")
        return if (file.isFile) comment.replace(file.readText(), " ") else null
    }

    private val historicalPermissions = listOf(
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
    )

    @Test
    fun mainManifestIsReleaseEligibleAndFreeOfTheHistoricalExperiment() {
        val main = checkNotNull(manifest("main")) { "src/main/AndroidManifest.xml must exist" }
        assertFalse("main must declare no permission", main.contains("uses-permission"))
        for (permission in historicalPermissions) assertFalse(permission, main.contains(permission))
        // F9 (E3): the only service main may declare is AppCompat's disabled, non-exported locale-storage holder.
        val services = Regex("<service[^>]*>", RegexOption.DOT_MATCHES_ALL).findAll(main).map { it.value }.toList()
        assertEquals("main may declare exactly the AppCompat locale holder service: $services", 1, services.size)
        assertTrue(services[0].contains("android:name=\"androidx.appcompat.app.AppLocalesMetadataHolderService\""))
        assertTrue(services[0].contains("android:enabled=\"false\""))
        assertTrue(services[0].contains("android:exported=\"false\""))
        // C1: the source manifest states the accepted artifact state, and the metadata AppCompat needs to persist locales.
        val serviceBlock = Regex("<service[^>]*>.*?</service>", RegexOption.DOT_MATCHES_ALL).find(main)!!.value
        assertTrue("autoStoreLocales must be true", Regex("<meta-data\\s+android:name=\"autoStoreLocales\"\\s+android:value=\"true\"").containsMatchIn(serviceBlock))
        assertTrue("RTL must be supported (F9)", main.contains("android:supportsRtl=\"true\""))
        assertFalse("no hand-written LocaleConfig reference (AGP generates it)", main.contains("android:localeConfig"))
        assertFalse(main.contains("BIND_VPN_SERVICE"))
        assertFalse(main.contains("VpnService"))
        assertFalse(main.contains("ExperimentalHarnessActivity"))
        assertFalse(main.contains("LocalProtectionVpnService"))
        assertTrue(main.contains("android:allowBackup=\"false\""))
        assertEquals("exactly one launcher", 1, Regex("android.intent.category.LAUNCHER").findAll(main).count())
        assertTrue(main.contains("android:name=\".MainActivity\""))
    }

    @Test
    fun internalManifestOwnsThePermissionsTheHarnessAndTheVpnService() {
        val internal = checkNotNull(manifest("internal")) { "src/internal/AndroidManifest.xml must exist" }
        for (permission in historicalPermissions) {
            assertTrue(permission, internal.contains("<uses-permission android:name=\"$permission\""))
        }
        assertTrue(internal.contains("android:name=\".vpn.LocalProtectionVpnService\""))
        assertTrue(internal.contains("android:permission=\"android.permission.BIND_VPN_SERVICE\""))
        assertTrue(internal.contains("android.net.VpnService.SUPPORTS_ALWAYS_ON"))
        // The harness is internal-only: never exported, never a second launcher.
        val harness = Regex("<activity[^>]*ExperimentalHarnessActivity[^>]*>").find(internal)?.value
        assertTrue("harness activity must be declared", harness != null)
        assertTrue("harness must not be exported: $harness", harness!!.contains("android:exported=\"false\""))
        assertFalse("internal must not add a launcher", internal.contains("android.intent.category.LAUNCHER"))
    }

    @Test
    fun thePlayFlavorAddsNoManifestComponentsOrPermissions() {
        val play = manifest("play")
        assertTrue("a play manifest, if present, must be empty of components and permissions", play == null ||
            (!play.contains("<activity") && !play.contains("<service") && !play.contains("<receiver") &&
                !play.contains("<provider") && !play.contains("uses-permission")))
    }
}

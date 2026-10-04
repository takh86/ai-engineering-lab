"""Self-test of the internal-artifact inclusion check: passes by accepting a complete internal fixture
and rejecting each way an internal artifact could lose or mis-configure the experiment."""
import os
import tempfile
import unittest
import zipfile

import check_internal_artifact as cia

PKG = cia.PKG
GOOD = """<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="%s.internal">
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <application android:allowBackup="false">
    <activity android:name="%s.MainActivity" android:exported="true"><intent-filter>
      <action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity>
    <activity android:name="%s.ExperimentalHarnessActivity" android:exported="false"/>
    <service android:name="androidx.appcompat.app.AppLocalesMetadataHolderService" android:enabled="false" android:exported="false">
      <meta-data android:name="autoStoreLocales" android:value="true"/>
    </service>
    <service android:name="%s.vpn.LocalProtectionVpnService" android:exported="true"
        android:permission="android.permission.BIND_VPN_SERVICE"><intent-filter>
      <action android:name="android.net.VpnService"/></intent-filter></service>
  </application>
</manifest>""" % (PKG, PKG, PKG, PKG)
CLASSES = ["vpn/LocalProtectionVpnService", "dns/DnsFilteringEngine", "ExperimentalHarnessActivity", "MainActivity"]


def make_apk(directory, classes, name="internal.apk"):
    path = os.path.join(directory, name)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("classes.dex", b"dex\n035\x00" + b"\x00".join(
            ("Lcom/muslimrecovery/protection/%s;" % c).encode() for c in classes))
    return path


class InternalArtifactTest(unittest.TestCase):
    def setUp(self):
        self._d = tempfile.TemporaryDirectory()
        self.apk = make_apk(self._d.name, CLASSES)

    def tearDown(self):
        self._d.cleanup()

    def problems(self, manifest=GOOD, apk=None, version="0.1.0-internal"):
        return cia.check(manifest, apk or self.apk, version)

    def test_complete_internal_fixture_passes(self):
        self.assertEqual([], self.problems())

    def test_missing_permission_is_reported(self):
        bad = GOOD.replace('<uses-permission android:name="android.permission.INTERNET"/>', "")
        self.assertTrue(any("android.permission.INTERNET" in p for p in self.problems(bad)))

    def test_missing_service_or_unguarded_service_is_reported(self):
        start = GOOD.index('<service android:name="%s.vpn' % PKG)
        gone = GOOD.replace(GOOD[start:GOOD.index("</service>", start) + len("</service>")], "")
        self.assertTrue(any("LocalProtectionVpnService" in p for p in self.problems(gone)))
        unguarded = GOOD.replace('android:permission="android.permission.BIND_VPN_SERVICE"', "")
        self.assertTrue(any("LocalProtectionVpnService" in p for p in self.problems(unguarded)))

    def test_exported_harness_is_reported(self):
        bad = GOOD.replace('ExperimentalHarnessActivity" android:exported="false"', 'ExperimentalHarnessActivity" android:exported="true"')
        problems = self.problems(bad)
        self.assertTrue(any("ExperimentalHarnessActivity" in p for p in problems))
        self.assertTrue(any("may be exported" in p for p in problems))

    def test_locale_service_enabled_or_metadata_mutations_are_reported(self):
        for bad in (GOOD.replace('android:enabled="false"', 'android:enabled="true"'),
                    GOOD.replace('android:value="true"', 'android:value="false"'),
                    GOOD.replace('<meta-data android:name="autoStoreLocales" android:value="true"/>', "")):
            problems = self.problems(bad)
            self.assertTrue(any("AppLocalesMetadataHolderService" in p or "autoStoreLocales" in p for p in problems), problems)

    def test_known_debug_tooling_activities_are_tolerated_but_unknown_exported_ones_are_not(self):
        tooling = GOOD.replace("</application>", '<activity android:name="androidx.activity.ComponentActivity" android:exported="true"/>'
                               '<activity android:name="androidx.compose.ui.tooling.PreviewActivity" android:exported="true"/></application>')
        self.assertEqual([], self.problems(tooling))
        rogue = GOOD.replace("</application>", '<activity android:name="com.evil.Backdoor" android:exported="true"/></application>')
        self.assertTrue(any("com.evil.Backdoor" in p for p in self.problems(rogue)))

    def test_other_exported_component_kinds_and_aliases_are_rejected(self):
        for extra in (
            '<activity-alias android:name="x.Alias" android:targetActivity="%s.ExperimentalHarnessActivity" android:exported="true"/>' % PKG,
            '<receiver android:name="x.R" android:exported="true"/>',
            '<provider android:name="x.P" android:exported="true"/>',
            '<service android:name="x.S" android:exported="true"/>',
        ):
            problems = self.problems(GOOD.replace("</application>", extra + "</application>"))
            self.assertTrue(any("may be exported" in p for p in problems), extra)

    def test_vpn_service_with_a_foreign_intent_filter_action_is_rejected(self):
        bad = GOOD.replace('<action android:name="android.net.VpnService"/>',
                           '<action android:name="android.net.VpnService"/><action android:name="com.evil.START"/>')
        self.assertTrue(any("LocalProtectionVpnService" in p for p in self.problems(bad)))

    def test_missing_classes_are_reported(self):
        apk = make_apk(self._d.name, ["MainActivity"], name="thin.apk")
        problems = self.problems(apk=apk)
        self.assertEqual(3, sum("class missing" in p for p in problems))

    def test_application_id_and_version_marker_are_checked(self):
        self.assertTrue(any("applicationId" in p for p in self.problems(GOOD.replace(PKG + ".internal", PKG))))
        self.assertTrue(any("versionName" in p for p in self.problems(version="0.1.0")))


if __name__ == "__main__":
    unittest.main()


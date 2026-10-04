"""Self-test of the release-boundary checker.

This suite PASSES by proving the checker correctly rejects known-bad synthetic fixtures (and
accepts a known-good one). It never expects a failing workflow.  Run: python3 -m unittest
"""
import contextlib
import io
import os
import tempfile
import unittest
import zipfile
from unittest import mock

import check_release_boundary as crb

PKG = "com.muslimrecovery.protection"
HERE = os.path.dirname(os.path.abspath(__file__))

ALLOWED = {
    "permissions": {PKG + ".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"},
    "components": {"activity|%s.MainActivity|exported=true|permission=none|filters=no" % PKG},
    "dependencies": {"androidx.core:core-ktx", "org.jetbrains.kotlin:kotlin-stdlib"},
    "code_entries": {"lib/x86/libok.so"},
}
APP = '<application android:allowBackup="false">'
DENIED = {PKG + ".experimental.", PKG + ".vpn.", PKG + ".dns."}

GOOD_MANIFEST = """<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="%s">
  <permission android:name="%s.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"/>
  <uses-permission android:name="%s.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"/>
  <application android:allowBackup="false">
    <activity android:name="%s.MainActivity" android:exported="true"/>
  </application>
</manifest>""" % (PKG, PKG, PKG, PKG)

GOOD_DEPS = """playReleaseRuntimeClasspath - Runtime classpath
+--- androidx.core:core-ktx:1.13.1
|    \\--- org.jetbrains.kotlin:kotlin-stdlib:1.8.22 -> 2.1.20 (*)
\\--- project :other
"""


def make_apk(directory, descriptors, extra_dex=None, with_dex=True, name="app.apk"):
    path = os.path.join(directory, name)
    with zipfile.ZipFile(path, "w") as archive:
        if with_dex:
            body = b"dex\n035\x00" + b"\x00".join(("L" + d + ";").encode() for d in descriptors)
            archive.writestr("classes.dex", body)
            for index, extra in enumerate(extra_dex or [], start=2):
                archive.writestr("classes%d.dex" % index, b"dex\n035\x00" + ("L" + extra + ";").encode())
        archive.writestr("AndroidManifest.xml", b"binary")
    return path


class CheckerTest(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.dir = self._dir.name
        self.good_apk = make_apk(self.dir, ["com/muslimrecovery/protection/MainActivity", "androidx/core/Foo"])

    def tearDown(self):
        self._dir.cleanup()

    def run_eval(self, manifest=GOOD_MANIFEST, apk=None, deps=GOOD_DEPS, r8=None, version="0.1.0", baseline=None):
        return crb.evaluate(manifest, apk or self.good_apk, deps, ALLOWED, DENIED, r8, version, baseline)

    # --- known-good ---
    def test_known_good_fixture_has_no_findings(self):
        findings, hard, _ = self.run_eval()
        self.assertEqual(set(), findings)
        self.assertEqual(set(), hard)
        self.assertEqual(([], [], []), crb.verdict(findings, hard, None))

    # --- known-bad: manifest ---
    def test_extra_permission_is_rejected(self):
        bad = GOOD_MANIFEST.replace(APP, '<uses-permission android:name="android.permission.INTERNET"/>' + APP)
        findings, _, _ = self.run_eval(manifest=bad)
        self.assertIn("permission|android.permission.INTERNET", findings)

    def test_undeclared_extra_permission_definition_is_rejected(self):
        bad = GOOD_MANIFEST.replace(APP, '<permission android:name="x.EVIL"/>' + APP)
        findings, _, _ = self.run_eval(manifest=bad)
        self.assertIn("declared-permission|x.EVIL", findings)

    def test_unlisted_service_is_rejected(self):
        bad = GOOD_MANIFEST.replace("</application>", '<service android:name=".vpn.LocalProtectionVpnService" android:exported="true"/></application>')
        findings, _, _ = self.run_eval(manifest=bad)
        self.assertIn("component|service|%s.vpn.LocalProtectionVpnService|exported=true|permission=none|filters=no" % PKG, findings)

    def test_exported_flag_change_on_allowed_component_is_rejected(self):
        bad = GOOD_MANIFEST.replace('android:exported="true"', 'android:exported="false"')
        findings, _, _ = self.run_eval(manifest=bad)
        self.assertIn("component|activity|%s.MainActivity|exported=false|permission=none|filters=no" % PKG, findings)

    def test_relative_component_names_are_qualified(self):
        relative = GOOD_MANIFEST.replace(PKG + ".MainActivity", ".MainActivity")
        findings, _, _ = self.run_eval(manifest=relative)
        self.assertEqual(set(), findings)

    def test_malformed_manifest_is_an_input_error(self):
        with self.assertRaises(crb.InputError):
            self.run_eval(manifest="<manifest")

    def test_sdk_m_permission_and_permission_tree_are_rejected(self):
        bad = GOOD_MANIFEST.replace(APP, '<uses-permission-sdk-m android:name="android.permission.CAMERA"/>'
                                    '<permission-tree android:name="x.TREE"/>' + APP)
        findings, _, _ = self.run_eval(manifest=bad)
        self.assertIn("permission|android.permission.CAMERA", findings)
        self.assertIn("declared-permission|x.TREE", findings)

    def test_removed_bind_permission_or_added_intent_filter_changes_the_component_key(self):
        guarded = GOOD_MANIFEST.replace("</application>", '<service android:name=".vpn.S" android:exported="true" '
                                        'android:permission="android.permission.BIND_VPN_SERVICE"/></application>')
        unguarded = GOOD_MANIFEST.replace("</application>", '<service android:name=".vpn.S" android:exported="true"/></application>')
        keys_g, _, _ = self.run_eval(manifest=guarded)
        keys_u, _, _ = self.run_eval(manifest=unguarded)
        self.assertIn("component|service|%s.vpn.S|exported=true|permission=android.permission.BIND_VPN_SERVICE|filters=no" % PKG, keys_g)
        self.assertIn("component|service|%s.vpn.S|exported=true|permission=none|filters=no" % PKG, keys_u)
        browsable = GOOD_MANIFEST.replace('<activity android:name="%s.MainActivity" android:exported="true"/>' % PKG,
                                          '<activity android:name="%s.MainActivity" android:exported="true"><intent-filter/></activity>' % PKG)
        findings, _, _ = self.run_eval(manifest=browsable)
        self.assertIn("component|activity|%s.MainActivity|exported=true|permission=none|filters=yes" % PKG, findings)

    def test_backup_debuggable_cleartext_and_package_changes_are_hard_failures(self):
        for old, new, needle in (
            ('android:allowBackup="false"', 'android:allowBackup="true"', "application|android:allowBackup"),
            ('android:allowBackup="false"', 'android:allowBackup="false" android:debuggable="true"', "application|android:debuggable"),
            ('android:allowBackup="false"', 'android:allowBackup="false" android:usesCleartextTraffic="true"', "application|android:usesCleartextTraffic"),
            ('<application android:allowBackup="false">', "<application>", "application|android:allowBackup"),
        ):
            _, hard, _ = self.run_eval(manifest=GOOD_MANIFEST.replace(old, new))
            self.assertTrue(any(h.startswith(needle) for h in hard), needle)
        renamed = GOOD_MANIFEST.replace('package="%s"' % PKG, 'package="com.example.other"')
        _, hard, _ = self.run_eval(manifest=renamed)
        self.assertTrue(any(h.startswith("package|") for h in hard))

    def test_embedded_native_jar_or_stray_dex_entries_are_rejected(self):
        path = os.path.join(self.dir, "embedded.apk")
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("classes.dex", b"dex\n035\x00Landroidx/core/Foo;")
            archive.writestr("lib/arm64-v8a/libhidden.so", b"x")
            archive.writestr("assets/payload.jar", b"x")
            archive.writestr("assets/extra.dex", b"dex\n035\x00Lcom/muslimrecovery/protection/vpn/Hidden;")
        findings, _, _ = self.run_eval(apk=path)
        self.assertIn("code-entry|lib/arm64-v8a/libhidden.so", findings)
        self.assertIn("code-entry|assets/payload.jar", findings)
        self.assertIn("code-entry|assets/extra.dex", findings)
        self.assertIn("class|%s.vpn." % PKG, findings)

    def test_allow_listed_native_library_is_accepted_but_others_are_not(self):
        path = os.path.join(self.dir, "native.apk")
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("classes.dex", b"dex\n035\x00Landroidx/core/Foo;")
            archive.writestr("lib/x86/libok.so", b"x")
            archive.writestr("lib/x86/libnew.so", b"x")
        findings, _, _ = self.run_eval(apk=path)
        self.assertEqual({"code-entry|lib/x86/libnew.so"}, findings)

    # --- known-bad: dex ---
    def test_experimental_vpn_and_dns_classes_are_rejected(self):
        for package in ("experimental/webguard", "vpn", "dns"):
            apk = make_apk(self.dir, ["com/muslimrecovery/protection/%s/Thing" % package], name=package.replace("/", "_") + ".apk")
            findings, _, _ = self.run_eval(apk=apk)
            expected = "class|%s.%s." % (PKG, package.split("/")[0])
            self.assertIn(expected, findings)

    def test_denied_class_in_secondary_dex_is_rejected(self):
        apk = make_apk(self.dir, ["androidx/core/Foo"], extra_dex=["com/muslimrecovery/protection/dns/Leak"], name="multi.apk")
        findings, _, _ = self.run_eval(apk=apk)
        self.assertIn("class|%s.dns." % PKG, findings)

    def test_similar_but_allowed_package_is_not_a_false_positive(self):
        apk = make_apk(self.dir, ["com/muslimrecovery/protection/domain/rules/RuleSet", "com/muslimrecovery/protection/core/data/X"], name="ok.apk")
        findings, _, _ = self.run_eval(apk=apk)
        self.assertEqual(set(), findings)

    def test_apk_without_dex_is_an_input_error(self):
        apk = make_apk(self.dir, [], with_dex=False, name="nodex.apk")
        with self.assertRaises(crb.InputError):
            self.run_eval(apk=apk)

    def test_missing_apk_is_an_input_error(self):
        with self.assertRaises(crb.InputError):
            self.run_eval(apk=os.path.join(self.dir, "missing.apk"))

    # --- known-bad: dependencies ---
    def test_unlisted_dependency_is_rejected(self):
        deps = GOOD_DEPS + "+--- com.google.firebase:firebase-analytics:21.0.0\n"
        findings, _, _ = self.run_eval(deps=deps)
        self.assertIn("dependency|com.google.firebase:firebase-analytics", findings)

    def test_dependency_parser_handles_gradle_tree_forms(self):
        text = (
            "+--- androidx.compose:compose-bom:2025.06.01\n"
            "|    \\--- androidx.compose.ui:ui:1.8.0 (c)\n"
            "+--- androidx.annotation:annotation:1.8.1 -> 1.9.1\n"
            "|    +--- org.x:y:{strictly 1.0} -> 1.0 (*)\n"
            "\\--- project :app\n"
        )
        self.assertEqual(
            {"androidx.compose:compose-bom", "androidx.annotation:annotation", "org.x:y"},
            crb.parse_dependencies(text),
        )

    # --- known-bad: R8 / version ---
    def test_r8_mapping_is_a_hard_failure(self):
        mapping = os.path.join(self.dir, "mapping.txt")
        open(mapping, "w").close()
        _, hard, _ = self.run_eval(r8=mapping)
        self.assertTrue(any(h.startswith("r8|") for h in hard))

    def test_absent_r8_mapping_is_fine(self):
        _, hard, _ = self.run_eval(r8=os.path.join(self.dir, "mapping.txt"))
        self.assertEqual(set(), hard)

    def test_baseline_requires_nonreleasable_version_and_vice_versa(self):
        _, hard, _ = self.run_eval(version="0.1.0", baseline=set())
        self.assertTrue(any(h.startswith("version|baseline in use") for h in hard))
        _, hard, _ = self.run_eval(version="0.1.0-nonreleasable-w0a", baseline=None)
        self.assertTrue(any(h.startswith("version|versionName still marked") for h in hard))
        _, hard, _ = self.run_eval(version="0.1.0-nonreleasable-w0a", baseline=set())
        self.assertEqual(set(), hard)

    # --- baseline semantics ---
    def test_baseline_tolerates_exactly_the_known_findings(self):
        bad = GOOD_MANIFEST.replace(APP, '<uses-permission android:name="android.permission.INTERNET"/>' + APP)
        baseline = {"permission|android.permission.INTERNET"}
        findings, hard, _ = self.run_eval(manifest=bad, baseline=baseline, version="0-nonreleasable")
        self.assertEqual(([], [], []), crb.verdict(findings, hard, baseline))

    def test_new_violation_beyond_baseline_is_unexpected(self):
        bad = GOOD_MANIFEST.replace(APP, '<uses-permission android:name="android.permission.CAMERA"/>' + APP)
        findings, hard, _ = self.run_eval(manifest=bad, baseline=set(), version="0-nonreleasable")
        unexpected, stale, _ = crb.verdict(findings, hard, set())
        self.assertEqual(["permission|android.permission.CAMERA"], unexpected)
        self.assertEqual([], stale)

    def test_stale_baseline_entry_is_a_violation(self):
        baseline = {"permission|android.permission.INTERNET"}
        findings, hard, _ = self.run_eval(baseline=baseline, version="0-nonreleasable")
        unexpected, stale, _ = crb.verdict(findings, hard, baseline)
        self.assertEqual([], unexpected)
        self.assertEqual(["permission|android.permission.INTERNET"], stale)

    # --- command line: exit codes ---
    def _write(self, name, text):
        path = os.path.join(self.dir, name)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        return path

    def _rules_dir(self):
        rules = os.path.join(self.dir, "rules")
        os.makedirs(rules, exist_ok=True)
        for name, items in (
            ("allowed-permissions.txt", ALLOWED["permissions"]),
            ("allowed-components.txt", ALLOWED["components"]),
            ("allowed-dependencies.txt", ALLOWED["dependencies"]),
            ("allowed-code-entries.txt", ALLOWED["code_entries"]),
            ("denied-class-patterns.txt", DENIED),
        ):
            with open(os.path.join(rules, name), "w", encoding="utf-8") as handle:
                handle.write("\n".join(sorted(items)) + "\n")
        return rules

    def run_cli(self, manifest, apk, *extra):
        args = [
            "--apk", apk,
            "--manifest-xml", self._write("m.xml", manifest),
            "--dependencies-file", self._write("d.txt", GOOD_DEPS),
            "--rules-dir", self._rules_dir(),
            "--version-name", "0.1.0",
        ] + list(extra)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return crb.main(args)

    def test_cli_accepts_the_good_fixture(self):
        self.assertEqual(0, self.run_cli(GOOD_MANIFEST, self.good_apk))

    def test_cli_rejects_each_known_bad_fixture(self):
        bad_manifest = GOOD_MANIFEST.replace(APP, '<uses-permission android:name="android.permission.INTERNET"/>' + APP)
        self.assertEqual(1, self.run_cli(bad_manifest, self.good_apk))
        bad_apk = make_apk(self.dir, ["com/muslimrecovery/protection/vpn/X"], name="bad.apk")
        self.assertEqual(1, self.run_cli(GOOD_MANIFEST, bad_apk))

    def test_cli_report_mode_never_gates(self):
        bad_apk = make_apk(self.dir, ["com/muslimrecovery/protection/dns/X"], name="bad.apk")
        with mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "false"}):
            self.assertEqual(0, self.run_cli(GOOD_MANIFEST, bad_apk, "--mode", "report"))

    def test_report_mode_is_refused_on_github_actions_unless_explicitly_allowed(self):
        bad_apk = make_apk(self.dir, ["com/muslimrecovery/protection/dns/X"], name="bad.apk")
        with mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}, clear=False):
            os.environ.pop("BOUNDARY_ALLOW_REPORT_MODE", None)
            self.assertEqual(2, self.run_cli(GOOD_MANIFEST, bad_apk, "--mode", "report"))
        with mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "BOUNDARY_ALLOW_REPORT_MODE": "1"}):
            self.assertEqual(0, self.run_cli(GOOD_MANIFEST, bad_apk, "--mode", "report"))

    def test_empty_deny_list_is_an_input_error(self):
        rules = self._rules_dir()
        with open(os.path.join(rules, "denied-class-patterns.txt"), "w") as handle:
            handle.write("# emptied\n")
        args = ["--apk", self.good_apk, "--manifest-xml", self._write("m.xml", GOOD_MANIFEST),
                "--dependencies-file", self._write("d.txt", GOOD_DEPS), "--rules-dir", rules, "--version-name", "0.1.0"]
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(2, crb.main(args))

    def test_empty_dependency_file_is_an_input_error(self):
        with self.assertRaises(crb.InputError):
            self.run_eval(deps="")

    def test_cli_input_errors_exit_2(self):
        self.assertEqual(2, self.run_cli(GOOD_MANIFEST, os.path.join(self.dir, "missing.apk")))

    # --- the committed rule files ---
    def test_committed_rule_files_load_and_deny_the_experimental_packages(self):
        denied = crb.load_list(os.path.join(HERE, "denied-class-patterns.txt"))
        self.assertEqual(DENIED, denied)
        for name in ("allowed-permissions.txt", "allowed-components.txt", "allowed-dependencies.txt", "allowed-code-entries.txt"):
            crb.load_list(os.path.join(HERE, name))
        # A permission that belongs only to the historical VPN experiment must never be allowed.
        permissions = crb.load_list(os.path.join(HERE, "allowed-permissions.txt"))
        for forbidden in ("android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE",
                          "android.permission.FOREGROUND_SERVICE", "android.permission.POST_NOTIFICATIONS"):
            self.assertNotIn(forbidden, permissions)

    def test_committed_baseline_only_contains_historical_vpn_dns_evidence(self):
        baseline = crb.load_list(os.path.join(HERE, "w0a-known-historical.txt"))
        self.assertEqual(9, len(baseline))
        for entry in baseline:
            self.assertTrue(
                entry.startswith(("class|%s.dns." % PKG, "class|%s.vpn." % PKG,
                                  "component|service|%s.vpn." % PKG, "permission|android.permission.",
                                  "component|activity|%s.ExperimentalHarnessActivity|" % PKG)),
                entry,
            )
        self.assertFalse(any("experimental" in entry for entry in baseline))


if __name__ == "__main__":
    unittest.main()

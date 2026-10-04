import unittest

import w0b_diff_guard as g

SERVICE_BASE = g.MAIN + "/" + g.SERVICE_REL
OTHER_BASE = g.MAIN + "/dns/DnsMessageCodec.kt"
TEST_BASE = g.TEST + "/dns/DnsMessageCodecTest.kt"
BASE_FILES = {SERVICE_BASE, OTHER_BASE, TEST_BASE, g.MAIN_ACTIVITY, g.MAIN + "/domain/rules/RuleSet.kt"}

SERVICE_SRC = (
    "import a\nimport com.muslimrecovery.protection.MainActivity\nx\n"
    "            Intent(this, MainActivity::class.java),\nend\n"
)
SERVICE_OK = SERVICE_SRC.replace("protection.MainActivity", "protection.ExperimentalHarnessActivity").replace(
    "Intent(this, MainActivity::class.java)", "Intent(this, ExperimentalHarnessActivity::class.java)")


HARNESS_BASE = "package x\nclass MainActivity : ComponentActivity() {}\n"
HARNESS_OK = "package x\nclass ExperimentalHarnessActivity : ComponentActivity() {}\n"
HARNESS_PATH = g.INTERNAL + "/ExperimentalHarnessActivity.kt"


def run(changes, head_files):
    base = {SERVICE_BASE: SERVICE_SRC, OTHER_BASE: "A", TEST_BASE: "T", g.MAIN_ACTIVITY: HARNESS_BASE}
    return g.check(
        changes, BASE_FILES,
        read_base=lambda p: base[p],
        read_head=lambda p: head_files[p],
        exists_head=lambda p: p in head_files,
        head_files=set(head_files),
    )


GOOD_HEAD = {
    HARNESS_PATH: HARNESS_OK,
    g.INTERNAL + "/vpn/LocalProtectionVpnService.kt": SERVICE_OK,
    g.INTERNAL + "/dns/DnsMessageCodec.kt": "A",
    g.TEST_INTERNAL + "/dns/DnsMessageCodecTest.kt": "T",
}
GOOD_CHANGES = {
    SERVICE_BASE: "D", OTHER_BASE: "D", TEST_BASE: "D", g.MAIN_ACTIVITY: "M",
    g.INTERNAL + "/vpn/LocalProtectionVpnService.kt": "A",
}


class GuardTest(unittest.TestCase):
    def test_the_approved_relocation_passes(self):
        self.assertEqual([], run(GOOD_CHANGES, GOOD_HEAD))

    def test_intermediate_in_place_service_edit_passes(self):
        head = {SERVICE_BASE: SERVICE_OK, g.MAIN + "/ExperimentalHarnessActivity.kt": HARNESS_OK}
        self.assertEqual([], run({SERVICE_BASE: "M"}, head))

    def test_a_duplicated_approved_line_is_rejected(self):
        head = dict(GOOD_HEAD)
        head[g.INTERNAL + "/vpn/LocalProtectionVpnService.kt"] = SERVICE_OK + "            Intent(this, ExperimentalHarnessActivity::class.java),\n"
        self.assertTrue(any("beyond the approved edit" in p for p in run(GOOD_CHANGES, head)))

    def test_an_edited_harness_is_rejected_and_a_missing_one_too(self):
        head = dict(GOOD_HEAD)
        head[HARNESS_PATH] = HARNESS_OK + "// sneaky\n"
        self.assertTrue(any("beyond the class name" in p for p in run(GOOD_CHANGES, head)))
        del head[HARNESS_PATH]
        self.assertTrue(any("missing" in p and "Harness" in p for p in run(GOOD_CHANGES, head)))

    def test_new_files_under_internal_vpn_or_dns_are_rejected_except_the_notification_test(self):
        head = dict(GOOD_HEAD)
        head[g.INTERNAL + "/dns/NewThing.kt"] = "x"
        self.assertTrue(any("internal vpn/dns" in p for p in run(GOOD_CHANGES, head)))
        head = dict(GOOD_HEAD)
        head[g.TEST_INTERNAL + "/vpn/NotificationTargetSourceTest.kt"] = "x"
        self.assertEqual([], run(GOOD_CHANGES, head))

    def test_domain_is_frozen_in_every_source_set(self):
        for path in (
            g.ANDROID + "/app/src/play/java/" + g.PKG + "/domain/rules/X.kt",
            g.ANDROID + "/app/src/main/kotlin/" + g.PKG + "/domain/protection/Y.kt",
            g.ANDROID + "/app/src/internal/java/" + g.PKG + "/domain/Z.kt",
        ):
            self.assertTrue(run({path: "A"}, dict(GOOD_HEAD, **{path: "x"})), path)

    def test_a_moved_file_with_changed_content_is_rejected(self):
        head = dict(GOOD_HEAD)
        head[g.INTERNAL + "/dns/DnsMessageCodec.kt"] = "A tampered"
        self.assertTrue(any("content changed" in p for p in run(GOOD_CHANGES, head)))

    def test_a_moved_file_that_is_missing_is_rejected(self):
        head = dict(GOOD_HEAD)
        del head[g.INTERNAL + "/dns/DnsMessageCodec.kt"]
        self.assertTrue(any("missing" in p for p in run(GOOD_CHANGES, head)))

    def test_service_edit_beyond_the_approved_one_is_rejected(self):
        head = dict(GOOD_HEAD)
        head[g.INTERNAL + "/vpn/LocalProtectionVpnService.kt"] = SERVICE_OK + "extra line\n"
        self.assertTrue(any("beyond the approved edit" in p for p in run(GOOD_CHANGES, head)))

    def test_editing_a_non_service_historical_file_in_place_is_rejected(self):
        self.assertTrue(run({OTHER_BASE: "M"}, {OTHER_BASE: "B"}))

    def test_adding_files_to_historical_directories_is_rejected(self):
        added = g.MAIN + "/vpn/NewThing.kt"
        self.assertTrue(any("nothing may be added" in p for p in run({added: "A"}, {added: "x"})))

    def test_extension_domain_strings_and_scaffolding_are_always_frozen(self):
        for path in (
            g.PROJECT + "/chrome-extension/src/x.js",
            g.MAIN + "/domain/rules/RuleSet.kt",
            g.ANDROID + "/app/src/main/res/values/strings.xml",
            g.TEST + "/ScaffoldingSanityTest.kt",
        ):
            self.assertTrue(run({path: "M"}, {path: "x"}), path)

    def test_a_rename_out_of_a_frozen_dir_without_the_internal_copy_is_rejected(self):
        # --no-renames lists the deletion; without the destination the move is incomplete.
        self.assertTrue(run({OTHER_BASE: "D"}, {}))

    def test_destination_mapping(self):
        self.assertEqual(g.INTERNAL + "/vpn/X.kt", g.destination(g.MAIN + "/vpn/X.kt"))
        self.assertEqual(g.TEST_INTERNAL + "/dns/XTest.kt", g.destination(g.TEST + "/dns/XTest.kt"))


if __name__ == "__main__":
    unittest.main()


class PostW0bModeTest(unittest.TestCase):
    """After W0b merged: the base already holds the relocated harness (ExperimentalHarnessActivity)."""

    BASE = {g.POST_W0B_MARKER, g.INTERNAL + "/vpn/LocalProtectionVpnService.kt", g.MAIN_ACTIVITY}

    def run_changes(self, changes):
        def unexpected(_):
            raise AssertionError("post-W0b mode must not read file contents")
        return g.check(changes, self.BASE, unexpected, unexpected, lambda p: True, head_files=set(self.BASE))

    def test_feature_work_and_strings_xml_edits_pass(self):
        main_res = g.ANDROID + "/app/src/main/res/values/strings.xml"
        design = g.MAIN + "/core/design/theme/TabsiraTheme.kt"
        self.assertEqual([], self.run_changes({main_res: "M", design: "A", g.MAIN_ACTIVITY: "M"}))

    def test_domain_extension_and_scaffolding_stay_frozen(self):
        for path in (g.ANDROID + "/app/src/main/java/" + g.PKG + "/domain/rules/RuleSet.kt",
                     g.PROJECT + "/chrome-extension/src/x.js", g.TEST + "/ScaffoldingSanityTest.kt"):
            self.assertEqual(1, len(self.run_changes({path: "M"})), path)

    def test_relocated_historical_code_is_frozen_in_every_way(self):
        for path in (g.INTERNAL + "/vpn/LocalProtectionVpnService.kt", g.INTERNAL + "/dns/New.kt",
                     g.TEST_INTERNAL + "/dns/DnsMessageCodecTest.kt", g.POST_W0B_MARKER):
            for status in ("A", "M", "D"):
                self.assertEqual(1, len(self.run_changes({path: status})), (path, status))

    def test_nothing_may_return_to_the_main_vpn_or_dns_directories(self):
        self.assertEqual(1, len(self.run_changes({g.MAIN + "/dns/Back.kt": "A"})))
        self.assertEqual(1, len(self.run_changes({g.MAIN + "/vpn/Back.kt": "A"})))


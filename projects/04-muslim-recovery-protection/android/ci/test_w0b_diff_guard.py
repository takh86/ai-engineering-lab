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


def run(changes, head_files):
    base = {SERVICE_BASE: SERVICE_SRC, OTHER_BASE: "A", TEST_BASE: "T", g.MAIN_ACTIVITY: "H"}
    return g.check(
        changes, BASE_FILES,
        read_base=lambda p: base[p],
        read_head=lambda p: head_files[p],
        exists_head=lambda p: p in head_files,
    )


GOOD_HEAD = {
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
        head = {SERVICE_BASE: SERVICE_OK}
        self.assertEqual([], run({SERVICE_BASE: "M"}, head))

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

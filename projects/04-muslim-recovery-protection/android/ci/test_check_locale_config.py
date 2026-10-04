import unittest

import check_locale_config as c

NS = 'xmlns:android="http://schemas.android.com/apk/res/android"'


def manifest(reference):
    attr = ' android:localeConfig="%s"' % reference if reference is not None else ""
    return '<manifest %s><application%s/></manifest>' % (NS, attr)


def config(*names):
    return "<locale-config %s>%s</locale-config>" % (NS, "".join('<locale android:name="%s"/>' % n for n in names))


DUMP = """Package name=com.muslimrecovery.protection id=7f
  type xml id=10 entryCount=3
    resource 0x7f100000 xml/_generated_res_locale_config
      () (file) res/Ed.xml type=XML
    resource 0x7f100001 xml/decoy_locale_config
      () (file) res/Zz.xml type=XML
    resource 0x7f100002 xml/network_security
      () (file) res/Qq.xml type=XML
  type string id=11 entryCount=1
    resource 0x7f110000 string/common_ok
      (default) (string) "OK"
"""
FILES = {"res/Ed.xml": config("en", "ar", "de"), "res/Zz.xml": config("en", "ar", "de", "fr"), "res/Qq.xml": "<network-security-config/>"}
EXPECTED = ["en", "ar", "de"]


def run(reference, files=FILES, dump=DUMP):
    return c.evaluate(manifest(reference), c.parse_resource_table(dump), lambda p: files[p], EXPECTED)


class LinkedLocaleConfigTest(unittest.TestCase):
    def test_the_resource_table_parser_reads_ids_names_and_files(self):
        table = c.parse_resource_table(DUMP)
        self.assertEqual({"type": "xml", "name": "_generated_res_locale_config", "files": ["res/Ed.xml"]}, table["0x7f100000"])
        self.assertEqual([], table["0x7f110000"]["files"])

    def test_a_manifest_that_references_the_generated_config_by_numeric_id_passes(self):
        for form in ("@ref/0x7f100000", "@0x7f100000"):
            problems, details = run(form)
            self.assertEqual([], problems, form)
            self.assertEqual("res/Ed.xml", details["file"])
            self.assertEqual("xml/_generated_res_locale_config", details["resource"])

    def test_a_named_reference_also_links(self):
        self.assertEqual([], run("@xml/_generated_res_locale_config")[0])

    def test_a_reference_to_a_different_resource_cannot_pass_even_if_a_valid_config_exists_elsewhere(self):
        # Mutation: the manifest points at the decoy (extra locale) while a perfectly valid config is also in the APK.
        problems, _ = run("@ref/0x7f100001")
        self.assertTrue(any("!= expected" in p for p in problems), problems)
        problems, _ = run("@ref/0x7f100002")
        self.assertTrue(any("not a <locale-config>" in p for p in problems), problems)

    def test_missing_unusable_or_dangling_references_fail(self):
        for bad in (None, "", "@ref/0x7f1fffff", "@string/common_ok", "@xml/nonexistent", "@ref/0x7f110000"):
            self.assertTrue(run(bad)[0], bad)

    def test_locale_set_mutations_fail(self):
        for names in (("en", "ar"), ("en", "ar", "de", "fr"), ("EN", "ar", "de"), ("en", "ar", "de", "de"), ()):
            files = dict(FILES, **{"res/Ed.xml": config(*names)})
            self.assertTrue(run("@ref/0x7f100000", files)[0], names)

    def test_unparseable_target_and_a_resource_without_exactly_one_file_fail(self):
        self.assertTrue(run("@ref/0x7f100000", dict(FILES, **{"res/Ed.xml": "<<<"}))[0])
        two = DUMP.replace("      () (file) res/Ed.xml type=XML\n", "      () (file) res/Ed.xml type=XML\n      (night) (file) res/Ed2.xml type=XML\n")
        self.assertTrue(any("exactly one file" in p for p in run("@ref/0x7f100000", dict(FILES, **{"res/Ed2.xml": config(*EXPECTED)}), two)[0]))


if __name__ == "__main__":
    unittest.main()

import unittest

import check_locale_config as c

NS = 'xmlns:android="http://schemas.android.com/apk/res/android"'
MANIFEST_OK = '<manifest %s><application android:localeConfig="@xml/_generated_res_locale_config" /></manifest>' % NS
MANIFEST_NONE = '<manifest %s><application android:label="x" /></manifest>' % NS


def config(*names):
    body = "".join('<locale android:name="%s"/>' % n for n in names)
    return "<locale-config %s>%s</locale-config>" % (NS, body)


OTHER = '<paths %s><x/></paths>' % NS
EXPECTED = ["en", "ar", "de"]


class LocaleConfigCheckTest(unittest.TestCase):
    def test_the_exact_set_passes_in_any_order(self):
        problems, found, path = c.evaluate(MANIFEST_OK, {"res/xml/_generated_res_locale_config.xml": config("de", "en", "ar"), "res/xml/other.xml": OTHER}, EXPECTED)
        self.assertEqual([], problems)
        self.assertEqual(["de", "en", "ar"], found)

    def test_a_missing_manifest_reference_is_rejected(self):
        problems, _, _ = c.evaluate(MANIFEST_NONE, {"res/xml/a.xml": config(*EXPECTED)}, EXPECTED)
        self.assertTrue(any("android:localeConfig" in p for p in problems))

    def test_an_extra_missing_or_duplicate_locale_is_rejected(self):
        for names in (("en", "ar", "de", "fr"), ("en", "ar"), ("en", "ar", "de", "de"), ()):
            problems, _, _ = c.evaluate(MANIFEST_OK, {"res/xml/a.xml": config(*names)}, EXPECTED)
            self.assertTrue(problems, names)

    def test_no_config_or_two_configs_are_rejected(self):
        self.assertTrue(c.evaluate(MANIFEST_OK, {"res/xml/o.xml": OTHER}, EXPECTED)[0])
        both = {"res/xml/a.xml": config(*EXPECTED), "res/xml/b.xml": config(*EXPECTED)}
        self.assertTrue(any("exactly one" in p for p in c.evaluate(MANIFEST_OK, both, EXPECTED)[0]))

    def test_undecodable_files_are_skipped_not_fatal(self):
        problems, _, _ = c.evaluate(MANIFEST_OK, {"res/xml/a.xml": config(*EXPECTED), "res/xml/bad.xml": "<<<"}, EXPECTED)
        self.assertEqual([], problems)

    def test_candidate_selection_prefers_the_generated_name_and_skips_non_xml_dirs(self):
        listing = "/res/layout/a.xml\n/res/xml/_generated_res_locale_config.xml\n/res/xml/network.xml\n/classes.dex\n"
        self.assertEqual(["res/xml/_generated_res_locale_config.xml"], c.candidate_files(listing))
        shortened = "/res/ab.xml\n/res/cd.xml\n/res/layout/e.xml\n"
        self.assertEqual(["res/ab.xml", "res/cd.xml"], c.candidate_files(shortened))


if __name__ == "__main__":
    unittest.main()

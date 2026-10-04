import os
import tempfile
import unittest

import test_counts as tc


def write_suite(directory, name, tests, failures=0, errors=0, skipped=0):
    path = os.path.join(directory, "TEST-%s.xml" % name)
    with open(path, "w") as handle:
        handle.write('<testsuite name="%s" tests="%d" skipped="%d" failures="%d" errors="%d"/>' % (name, tests, skipped, failures, errors))


class CompareTest(unittest.TestCase):
    base = {"A": {"tests": 3, "failures": 0, "errors": 0, "skipped": 0}}

    def test_identical_passes_and_new_classes_are_allowed(self):
        cur = dict(self.base, B={"tests": 1, "failures": 0, "errors": 0, "skipped": 0})
        self.assertEqual([], tc.compare(self.base, cur))

    def test_missing_class_is_rejected(self):
        self.assertEqual(1, len(tc.compare(self.base, {})))

    def test_fewer_or_more_tests_are_rejected(self):
        for count in (2, 4):
            cur = {"A": {"tests": count, "failures": 0, "errors": 0, "skipped": 0}}
            self.assertEqual(1, len(tc.compare(self.base, cur)))

    def test_failure_or_skip_is_rejected(self):
        for field in ("failures", "errors", "skipped"):
            cur = {"A": {"tests": 3, "failures": 0, "errors": 0, "skipped": 0}}
            cur["A"][field] = 1
            self.assertEqual(1, len(tc.compare(self.base, cur)))

    def test_excluded_prefixes_skip_only_the_moved_classes(self):
        base = {
            "p.vpn.A": {"tests": 1, "failures": 0, "errors": 0, "skipped": 0, "cases": ["a"]},
            "p.core.B": {"tests": 1, "failures": 0, "errors": 0, "skipped": 0, "cases": ["b"]},
        }
        cur = {"p.core.B": base["p.core.B"]}
        self.assertEqual(1, len(tc.compare(base, cur)))
        self.assertEqual([], tc.compare(base, cur, ["p.vpn."]))
        cur_missing_other = {}
        self.assertEqual(1, len(tc.compare(base, cur_missing_other, ["p.vpn."])))

    def test_cli_rejects_an_excluded_class_that_leaks_into_the_flavor(self):
        import json, subprocess, sys
        with tempfile.TemporaryDirectory() as d:
            case = {"tests": 1, "failures": 0, "errors": 0, "skipped": 0, "cases": ["a"]}
            base_p, cur_p = os.path.join(d, "b.json"), os.path.join(d, "c.json")
            json.dump({"p.core.B": case}, open(base_p, "w"))
            json.dump({"p.core.B": case, "p.vpn.A": case}, open(cur_p, "w"))
            here = os.path.dirname(os.path.abspath(__file__))
            result = subprocess.run([sys.executable, os.path.join(here, "test_counts.py"), "compare", base_p, cur_p,
                                     "--exclude-prefix", "p.vpn."], capture_output=True, text=True)
            self.assertEqual(1, result.returncode, result.stdout)
            self.assertIn("must not exist in this flavor", result.stdout)

    def test_swapping_one_test_for_another_is_rejected(self):
        base = {"A": {"tests": 2, "failures": 0, "errors": 0, "skipped": 0, "cases": ["one", "two"]}}
        cur = {"A": {"tests": 2, "failures": 0, "errors": 0, "skipped": 0, "cases": ["one", "three"]}}
        problems = tc.compare(base, cur)
        self.assertEqual(1, len(problems))
        self.assertIn("two", problems[0])

    def test_summarize_reads_junit_xml_including_case_names(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "TEST-x.Y.xml"), "w") as handle:
                handle.write('<testsuite name="x.Y" tests="2" skipped="1" failures="0" errors="0">'
                             '<testcase name="b"/><testcase name="a"/></testsuite>')
            self.assertEqual(
                {"x.Y": {"tests": 2, "failures": 0, "errors": 0, "skipped": 1, "cases": ["a", "b"]}},
                tc.summarize(d),
            )


if __name__ == "__main__":
    unittest.main()

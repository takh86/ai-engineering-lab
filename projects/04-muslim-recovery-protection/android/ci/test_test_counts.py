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

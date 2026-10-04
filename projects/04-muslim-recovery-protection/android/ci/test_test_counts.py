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

    def test_summarize_reads_junit_xml(self):
        with tempfile.TemporaryDirectory() as d:
            write_suite(d, "x.Y", 5, skipped=1)
            self.assertEqual({"x.Y": {"tests": 5, "failures": 0, "errors": 0, "skipped": 1}}, tc.summarize(d))


if __name__ == "__main__":
    unittest.main()

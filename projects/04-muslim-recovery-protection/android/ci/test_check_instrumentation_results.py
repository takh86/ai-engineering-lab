import os
import tempfile
import unittest

import check_instrumentation_results as c


def suite(cases):
    body = ""
    for cls, name, outcome in cases:
        inner = {"ok": "", "fail": "<failure message='x'/>", "err": "<error message='x'/>", "skip": "<skipped/>"}[outcome]
        body += "<testcase classname='%s' name='%s'>%s</testcase>" % (cls, name, inner)
    return "<testsuite name='s'>%s</testsuite>" % body


class InstrumentationResultsTest(unittest.TestCase):
    def summarize(self, files):
        with tempfile.TemporaryDirectory() as d:
            for i, text in enumerate(files):
                sub = os.path.join(d, "dev%d" % i)
                os.makedirs(sub)
                with open(os.path.join(sub, "TEST-%d.xml" % i), "w") as f:
                    f.write(text)
            return c.summarize(d)

    def test_a_green_run_passes_and_counts_across_files(self):
        s = self.summarize([suite([("A", "t1", "ok"), ("A", "t2", "ok")]), suite([("B", "t", "ok")])])
        self.assertEqual({"A": 2, "B": 1}, {k: v["tests"] for k, v in s.items()})
        self.assertEqual([], c.problems(s, ["A", "B"], 3))

    def test_nothing_executed_is_a_failure(self):
        self.assertTrue(c.problems({}, [], 1))
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual({}, c.summarize(d))

    def test_failures_errors_and_skips_are_failures(self):
        for outcome in ("fail", "err", "skip"):
            s = self.summarize([suite([("A", "t", outcome)])])
            self.assertTrue(c.problems(s, [], 1), outcome)

    def test_a_missing_required_class_and_too_few_tests_are_failures(self):
        s = self.summarize([suite([("A", "t", "ok")])])
        self.assertTrue(any("required class" in p for p in c.problems(s, ["B"], 1)))
        self.assertTrue(any("only 1" in p for p in c.problems(s, [], 5)))


if __name__ == "__main__":
    unittest.main()

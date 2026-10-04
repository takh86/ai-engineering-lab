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
        self.assertEqual({"A": 2, "B": 1}, {k: v["tests"] for k, v in s.items() if k != "__suite_problems__"})
        self.assertEqual([], c.problems(s, ["A", "B"], 3))

    def test_nothing_executed_is_a_failure(self):
        self.assertTrue(c.problems({}, [], 1))
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual({"__suite_problems__": []}, c.summarize(d))
            self.assertTrue(c.problems(c.summarize(d), [], 1))

    def test_suite_level_counters_crashed_suites_and_flaky_markers_fail(self):
        ok = suite([("A", "t", "ok")])
        for bad in ("<testsuite name='crash' tests='0' errors='1'/>",
                    "<testsuite name='x' tests='2' failures='1' errors='1'><testcase classname='a.B' name='t'/></testsuite>",
                    "<testsuite name='x' tests='1'><testcase classname='a.B' name='t'><rerunFailure/></testcase></testsuite>",
                    "<testsuite name='x' tests='1'><testcase classname='a.B' name='t'><flakyFailure/></testcase></testsuite>"):
            self.assertTrue(c.problems(self.summarize([ok, bad]), [], 1), bad)

    def test_duplicate_test_cases_do_not_inflate_the_executed_count(self):
        s = self.summarize([suite([("A", "t", "ok")] * 30)])
        self.assertEqual(1, s["A"]["tests"])
        self.assertTrue(c.problems(s, [], 20))

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

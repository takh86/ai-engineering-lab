#!/usr/bin/env python3
"""Summarize and compare JUnit XML results (M3-01 W0a: existing tests must be preserved).

  test_counts.py summarize <results-dir>            -> JSON {class: {tests, failures, errors, skipped}}
  test_counts.py compare <baseline.json> <current.json>
      exit 0 only if every baseline class exists in current with the identical test count and the
      current class has no failures, errors or skips. New classes in current are allowed.
"""
import glob
import json
import os
import sys
import xml.etree.ElementTree as ET


def summarize(results_dir):
    summary = {}
    for path in sorted(glob.glob(os.path.join(results_dir, "**", "TEST-*.xml"), recursive=True)):
        suite = ET.parse(path).getroot()
        name = suite.get("name")
        summary[name] = {
            "tests": int(suite.get("tests", 0)),
            "failures": int(suite.get("failures", 0)),
            "errors": int(suite.get("errors", 0)),
            "skipped": int(suite.get("skipped", 0)),
        }
    return summary


def compare(baseline, current):
    problems = []
    for name, base in sorted(baseline.items()):
        cur = current.get(name)
        if cur is None:
            problems.append("missing test class: %s" % name)
            continue
        if cur["tests"] != base["tests"]:
            problems.append("%s: test count %d != baseline %d" % (name, cur["tests"], base["tests"]))
        if cur["failures"] or cur["errors"] or cur["skipped"]:
            problems.append("%s: failures=%d errors=%d skipped=%d" % (name, cur["failures"], cur["errors"], cur["skipped"]))
    return problems


def main(argv):
    if len(argv) == 3 and argv[1] == "summarize":
        summary = summarize(argv[2])
        if not summary:
            print("no TEST-*.xml under %s" % argv[2], file=sys.stderr)
            return 2
        json.dump(summary, sys.stdout, indent=2, sort_keys=True)
        print()
        return 0
    if len(argv) == 4 and argv[1] == "compare":
        with open(argv[2]) as handle:
            baseline = json.load(handle)
        with open(argv[3]) as handle:
            current = json.load(handle)
        problems = compare(baseline, current)
        total_base = sum(c["tests"] for c in baseline.values())
        total_cur = sum(c["tests"] for c in current.values())
        print("baseline: %d classes / %d tests; current: %d classes / %d tests" % (len(baseline), total_base, len(current), total_cur))
        for problem in problems:
            print("PROBLEM:", problem)
        if not baseline:
            print("PROBLEM: empty baseline")
            return 1
        return 1 if problems else 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))

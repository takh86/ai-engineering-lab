#!/usr/bin/env python3
"""Summarize and compare JUnit XML results (M3-01 W0a: existing tests must be preserved).

  test_counts.py summarize <results-dir>   -> JSON {class: {tests, failures, errors, skipped, cases}}
  test_counts.py compare <baseline.json> <current.json> [--exclude-prefix PREFIX]...
      (W0b: the play flavor legitimately no longer contains the moved historical vpn/dns tests;
       baseline classes starting with an excluded prefix are skipped, nothing else is)
      exit 0 only if every baseline class exists in current with the identical test count, every
      baseline test case name is still present, and the current class has no failures, errors or
      skips. New classes in current are allowed.
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
            "cases": sorted(case.get("name") for case in suite.iter("testcase")),
        }
    return summary


def compare(baseline, current, exclude_prefixes=()):
    problems = []
    for name, base in sorted(baseline.items()):
        if any(name.startswith(prefix) for prefix in exclude_prefixes):
            continue
        cur = current.get(name)
        if cur is None:
            problems.append("missing test class: %s" % name)
            continue
        if cur["tests"] != base["tests"]:
            problems.append("%s: test count %d != baseline %d" % (name, cur["tests"], base["tests"]))
        missing = sorted(set(base.get("cases", [])) - set(cur.get("cases", [])))
        if missing:
            problems.append("%s: baseline test cases missing: %s" % (name, ", ".join(missing)))
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
    if len(argv) >= 4 and argv[1] == "compare":
        extra = argv[4:]
        if len(extra) % 2 != 0 or any(extra[i] != "--exclude-prefix" for i in range(0, len(extra), 2)):
            print(__doc__, file=sys.stderr)
            return 2
        excluded = extra[1::2]
        with open(argv[2]) as handle:
            baseline = json.load(handle)
        with open(argv[3]) as handle:
            current = json.load(handle)
        problems = compare(baseline, current, excluded)
        for prefix in excluded:
            leaked = sorted(n for n in current if n.startswith(prefix))
            for name in leaked:
                problems.append("excluded prefix %s must not exist in this flavor but found %s" % (prefix, name))
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

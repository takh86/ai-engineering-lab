#!/usr/bin/env python3
"""F9 (E10): a managed-device run is evidence only if tests actually executed.

  check_instrumentation_results.py <results-dir> [--require-class FQCN]... [--min-tests N]

Parses every TEST-*.xml below the directory. Fails (exit 1) on: no result files, fewer tests than --min-tests,
any failure, error or skipped test, or a required class that is absent or has zero tests. A green Gradle task that
ran nothing therefore cannot pass.
"""
import argparse
import glob
import os
import sys
import xml.etree.ElementTree as ET


def summarize(results_dir):
    summary = {}
    for path in sorted(glob.glob(os.path.join(results_dir, "**", "TEST-*.xml"), recursive=True)):
        suite = ET.parse(path).getroot()
        for case in suite.iter("testcase"):
            cls = case.get("classname") or suite.get("name")
            entry = summary.setdefault(cls, {"tests": 0, "failures": 0, "errors": 0, "skipped": 0})
            entry["tests"] += 1
            if case.find("failure") is not None:
                entry["failures"] += 1
            if case.find("error") is not None:
                entry["errors"] += 1
            if case.find("skipped") is not None:
                entry["skipped"] += 1
    return summary


def problems(summary, required, min_tests):
    found = []
    if not summary:
        return ["no TEST-*.xml results found: nothing was executed"]
    total = sum(e["tests"] for e in summary.values())
    if total < min_tests:
        found.append("only %d tests executed (< %d)" % (total, min_tests))
    for cls, e in sorted(summary.items()):
        if e["failures"] or e["errors"] or e["skipped"]:
            found.append("%s: failures=%d errors=%d skipped=%d" % (cls, e["failures"], e["errors"], e["skipped"]))
    for cls in required:
        if summary.get(cls, {}).get("tests", 0) == 0:
            found.append("required class did not run: %s" % cls)
    return found


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("results_dir")
    parser.add_argument("--require-class", action="append", default=[])
    parser.add_argument("--min-tests", type=int, default=1)
    args = parser.parse_args(argv[1:])
    summary = summarize(args.results_dir)
    total = sum(e["tests"] for e in summary.values())
    for cls, e in sorted(summary.items()):
        print("%-90s tests=%d failures=%d errors=%d skipped=%d" % (cls, e["tests"], e["failures"], e["errors"], e["skipped"]))
    print("TOTAL executed instrumentation tests: %d in %d classes" % (total, len(summary)))
    found = problems(summary, args.require_class, args.min_tests)
    for item in found:
        print("::error::" + item)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

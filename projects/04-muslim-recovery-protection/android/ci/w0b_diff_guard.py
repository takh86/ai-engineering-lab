#!/usr/bin/env python3
"""W0b diff guard: frozen/historical paths may change only as the approved W0b relocation.

Approved (Owner, W0b): the historical M1 sources move from src/main to src/internal and their tests
from src/test to src/testInternal with NO content change, except LocalProtectionVpnService, whose only
edit is that its notification opens ExperimentalHarnessActivity instead of MainActivity; and
MainActivity.kt stops being the harness (it becomes the product shell).

Everything else under chrome-extension/, domain/, strings.xml, ScaffoldingSanityTest or the historical
vpn/dns directories is a violation. The check is stage-tolerant (any commit of the W0b series), because it
is evaluated per head against the merge-base.

  w0b_diff_guard.py <merge-base>      (run from the repository root)
"""
import difflib
import re
import subprocess
import sys

PROJECT = "projects/04-muslim-recovery-protection"
ANDROID = PROJECT + "/android"
PKG = "com/muslimrecovery/protection"
MAIN = "%s/app/src/main/java/%s" % (ANDROID, PKG)
TEST = "%s/app/src/test/java/%s" % (ANDROID, PKG)
INTERNAL = "%s/app/src/internal/java/%s" % (ANDROID, PKG)
TEST_INTERNAL = "%s/app/src/testInternal/java/%s" % (ANDROID, PKG)
SERVICE_REL = "vpn/LocalProtectionVpnService.kt"
MAIN_ACTIVITY = MAIN + "/MainActivity.kt"

ALWAYS_FROZEN = [
    re.compile("^" + re.escape(PROJECT + "/chrome-extension/")),
    re.compile("^" + re.escape(MAIN + "/domain/")),
    re.compile("^" + re.escape(TEST + "/domain/")),
    re.compile("^" + re.escape(ANDROID + "/app/src/main/res/values/strings.xml") + "$"),
    re.compile("^" + re.escape(TEST + "/ScaffoldingSanityTest.kt") + "$"),
]
HISTORICAL_DIRS = [MAIN + "/vpn/", MAIN + "/dns/", TEST + "/vpn/", TEST + "/dns/"]

SERVICE_EXPECTED_DIFF = {
    "-import com.muslimrecovery.protection.MainActivity",
    "+import com.muslimrecovery.protection.ExperimentalHarnessActivity",
    "-            Intent(this, MainActivity::class.java),",
    "+            Intent(this, ExperimentalHarnessActivity::class.java),",
}


def destination(base_path):
    if base_path.startswith(MAIN + "/"):
        return INTERNAL + base_path[len(MAIN):]
    if base_path.startswith(TEST + "/"):
        return TEST_INTERNAL + base_path[len(TEST):]
    return None


def check(changes, base_files, read_base, read_head, exists_head):
    """changes: {path: status} from `git diff --no-renames --name-status`. Returns a list of violations."""
    problems = []
    historical_base = {f for f in base_files if any(f.startswith(d) for d in HISTORICAL_DIRS)}
    service = MAIN + "/" + SERVICE_REL
    for path, status in sorted(changes.items()):
        if any(pattern.search(path) for pattern in ALWAYS_FROZEN):
            problems.append("%s %s: frozen path must not change" % (status, path))
        elif path in historical_base:
            if status == "D":
                continue
            if status == "M" and path == service:
                continue
            problems.append("%s %s: historical file may only be moved (or, for the service, narrowly edited)" % (status, path))
        elif any(path.startswith(d) for d in HISTORICAL_DIRS):
            problems.append("%s %s: nothing may be added to the historical vpn/dns directories" % (status, path))
        elif path == MAIN_ACTIVITY and status not in ("M", "D"):
            problems.append("%s %s: unexpected change" % (status, path))

    for base_path in sorted(historical_base):
        if changes.get(base_path) != "D":
            continue
        target = destination(base_path)
        if target is None or not exists_head(target):
            problems.append("D %s: moved file is missing at %s" % (base_path, target))
            continue
        if base_path == service:
            continue  # content checked below
        if read_base(base_path) != read_head(target):
            problems.append("%s -> %s: moved file content changed (a move must be byte-identical)" % (base_path, target))

    # The service may only change by the approved notification-target edit, wherever it lives.
    service_now = service if exists_head(service) else destination(service)
    if service in historical_base and service_now and exists_head(service_now):
        before = read_base(service).splitlines()
        after = read_head(service_now).splitlines()
        diff = {
            line for line in difflib.unified_diff(before, after, lineterm="", n=0)
            if line[:1] in "+-" and not line.startswith(("+++", "---"))
        }
        if diff and diff != SERVICE_EXPECTED_DIFF:
            problems.append("LocalProtectionVpnService changed beyond the approved edit: %s" % sorted(diff ^ SERVICE_EXPECTED_DIFF))
    return problems


def _git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    base = argv[1]
    changes = {}
    for line in _git("diff", "--no-renames", "--name-status", base, "HEAD").splitlines():
        status, path = line.split("\t", 1)
        changes[path] = status[0]
    base_files = set(_git("ls-tree", "-r", "--name-only", base).splitlines())

    def read_base(path):
        return _git("show", "%s:%s" % (base, path))

    def read_head(path):
        return _git("show", "HEAD:" + path)

    def exists_head(path):
        return subprocess.run(["git", "cat-file", "-e", "HEAD:" + path], capture_output=True).returncode == 0

    problems = check(changes, base_files, read_base, read_head, exists_head)
    for problem in problems:
        print("::error::" + problem)
    if problems:
        return 1
    print("W0b diff guard OK: %d changed paths, frozen/historical paths only moved as approved." % len(changes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

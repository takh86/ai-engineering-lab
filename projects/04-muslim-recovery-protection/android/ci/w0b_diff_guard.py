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

After W0b was merged (F9, IR-D): when the base tree already contains the relocated harness, the relocation rules
above no longer apply (nothing is being moved any more) and the guard switches to POST-W0B mode: chrome-extension,
domain and ScaffoldingSanityTest stay frozen, and the relocated historical code (internal vpn/dns, their tests and
the harness) must not change at all; nothing may reappear in the main vpn/dns directories. `strings.xml` stays frozen except that its content
may equal the one approved E6 text (F9 marks the placeholder app_name non-translatable) or the base content.
"""
import collections
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
    # domain/** is frozen in EVERY source set and source directory (java or kotlin, main/test/flavor).
    re.compile("^" + re.escape(ANDROID + "/app/src/") + "[^/]+/(java|kotlin)/" + re.escape(PKG + "/domain/")),
    re.compile("^" + re.escape(ANDROID + "/app/src/main/res/values/strings.xml") + "$"),
    re.compile("^" + re.escape(TEST + "/ScaffoldingSanityTest.kt") + "$"),
]
HISTORICAL_DIRS = [MAIN + "/vpn/", MAIN + "/dns/", TEST + "/vpn/", TEST + "/dns/"]

SERVICE_EXPECTED_DIFF = collections.Counter([
    "-import com.muslimrecovery.protection.MainActivity",
    "+import com.muslimrecovery.protection.ExperimentalHarnessActivity",
    "-            Intent(this, MainActivity::class.java),",
    "+            Intent(this, ExperimentalHarnessActivity::class.java),",
])
# The harness is the old MainActivity.kt with ONLY its class name changed.
HARNESS_OLD_DECLARATION = "class MainActivity : ComponentActivity()"
HARNESS_NEW_DECLARATION = "class ExperimentalHarnessActivity : ComponentActivity()"
# New files allowed under the internal vpn/dns test and source directories (everything else there must be a moved file).
INTERNAL_EXTRA_FILES = {TEST_INTERNAL + "/vpn/NotificationTargetSourceTest.kt"}


def destination(base_path):
    if base_path.startswith(MAIN + "/"):
        return INTERNAL + base_path[len(MAIN):]
    if base_path.startswith(TEST + "/"):
        return TEST_INTERNAL + base_path[len(TEST):]
    return None


POST_W0B_MARKER = INTERNAL + "/ExperimentalHarnessActivity.kt"
POST_W0B_FROZEN = [
    re.compile("^" + re.escape(PROJECT + "/chrome-extension/")),
    re.compile("^" + re.escape(ANDROID + "/app/src/") + "[^/]+/(java|kotlin)/" + re.escape(PKG + "/domain/")),
    re.compile("^" + re.escape(TEST + "/ScaffoldingSanityTest.kt") + "$"),
]
POST_W0B_NO_RETURN = [
    ANDROID + "/app/src/" + s + "/" + lang + "/" + PKG + "/" + d + "/"
    for s in ("main", "play", "test", "testPlay", "androidTest", "androidTestPlay")
    for lang in ("java", "kotlin")
    for d in ("vpn", "dns")
]
STRINGS_XML = ANDROID + "/app/src/main/res/values/strings.xml"
# F9 (E6): the only approved change to strings.xml. Anything else is a violation.
E6_STRINGS_XML = """<resources>
    <!-- Placeholder working name, NOT the approved public product name (undecided Owner item, D-11/OD-F9-6).
         Deliberately non-translatable: it must not be rendered into AR/DE as if it were the brand. -->
    <string name="app_name" translatable="false">Recovery Protection</string>
</resources>
"""
POST_W0B_HISTORICAL = [
    INTERNAL + "/vpn/", INTERNAL + "/dns/", TEST_INTERNAL + "/vpn/", TEST_INTERNAL + "/dns/",
    # kotlin/ source roots of the internal source sets (same code, other directory name)
    ANDROID + "/app/src/internal/kotlin/", ANDROID + "/app/src/testInternal/kotlin/",
]
POST_W0B_FROZEN_FILES = {
    POST_W0B_MARKER,
    ANDROID + "/app/src/internal/AndroidManifest.xml",  # holds the VPN service, harness and historical permissions
}


def check_post_w0b(changes, read_base=None, read_head=None):
    """After W0b: frozen paths and the relocated historical code must not change; nothing returns to main vpn/dns."""
    problems = []
    if STRINGS_XML in changes:
        ok = False
        if changes[STRINGS_XML] == "M" and read_base and read_head:
            ok = read_head(STRINGS_XML) in (read_base(STRINGS_XML), E6_STRINGS_XML)
        if not ok:
            problems.append("%s %s: strings.xml may only change to the approved F9 E6 text" % (changes[STRINGS_XML], STRINGS_XML))
    for path, status in sorted(changes.items()):
        if any(pattern.search(path) for pattern in POST_W0B_FROZEN):
            problems.append("%s %s: frozen path must not change" % (status, path))
        elif path in POST_W0B_FROZEN_FILES or any(path.startswith(d) for d in POST_W0B_HISTORICAL):
            problems.append("%s %s: relocated historical code is frozen after W0b" % (status, path))
        elif any(path.startswith(d) for d in HISTORICAL_DIRS + POST_W0B_NO_RETURN):
            problems.append("%s %s: nothing may return to a product vpn/dns directory" % (status, path))
    return problems


def check(changes, base_files, read_base, read_head, exists_head, head_files=()):
    """changes: {path: status} from `git diff --no-renames --name-status`. Returns a list of violations."""
    if POST_W0B_MARKER in base_files:
        return check_post_w0b(changes, read_base, read_head)
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

    # Nothing may be added under the internal vpn/dns directories except the moved files themselves.
    expected_internal = {destination(f) for f in historical_base} | INTERNAL_EXTRA_FILES
    for path in sorted(head_files):
        in_internal_dir = any(path.startswith(d) for d in (
            INTERNAL + "/vpn/", INTERNAL + "/dns/", TEST_INTERNAL + "/vpn/", TEST_INTERNAL + "/dns/"))
        if in_internal_dir and path not in expected_internal:
            problems.append("A %s: only the moved historical files may live in the internal vpn/dns directories" % path)

    # The harness is the old MainActivity with only the class name changed.
    if MAIN_ACTIVITY in base_files:
        harness = next((h for h in (MAIN + "/ExperimentalHarnessActivity.kt", INTERNAL + "/ExperimentalHarnessActivity.kt")
                        if exists_head(h)), None)
        if harness is None:
            problems.append("ExperimentalHarnessActivity.kt is missing (it must be the renamed historical MainActivity)")
        else:
            expected = read_base(MAIN_ACTIVITY).replace(HARNESS_OLD_DECLARATION, HARNESS_NEW_DECLARATION, 1)
            if read_head(harness) != expected:
                problems.append("%s differs from the old MainActivity beyond the class name" % harness)

    # The service may only change by the approved notification-target edit, wherever it lives.
    service_now = service if exists_head(service) else destination(service)
    if service in historical_base and service_now and exists_head(service_now):
        before = read_base(service).splitlines()
        after = read_head(service_now).splitlines()
        diff = collections.Counter(
            line for line in difflib.unified_diff(before, after, lineterm="", n=0)
            if line[:1] in "+-" and not line.startswith(("+++ ", "--- "))
        )
        if diff and diff != SERVICE_EXPECTED_DIFF:
            problems.append("LocalProtectionVpnService changed beyond the approved edit: %s"
                            % sorted(((diff - SERVICE_EXPECTED_DIFF) + (SERVICE_EXPECTED_DIFF - diff)).elements()))
    return problems


def parse_name_status_z(output):
    """`git diff -z --name-status` output -> {path: status}. NUL separated, so quoted/non-ASCII/tab names are exact
    (the plain output quotes such paths and would slip past the anchored frozen-path patterns)."""
    parts = [p for p in output.split("\0") if p != ""]
    changes = {}
    for i in range(0, len(parts) - 1, 2):
        changes[parts[i + 1]] = parts[i][0]
    return changes


def _git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    base = argv[1]
    changes = parse_name_status_z(_git("diff", "--no-renames", "-z", "--name-status", base, "HEAD"))
    base_files = set(p for p in _git("ls-tree", "-r", "-z", "--name-only", base).split("\0") if p)

    def read_base(path):
        return _git("show", "%s:%s" % (base, path))

    def read_head(path):
        return _git("show", "HEAD:" + path)

    def exists_head(path):
        return subprocess.run(["git", "cat-file", "-e", "HEAD:" + path], capture_output=True).returncode == 0

    head_files = set(p for p in _git("ls-tree", "-r", "-z", "--name-only", "HEAD").split("\0") if p)
    problems = check(changes, base_files, read_base, read_head, exists_head, head_files)
    for problem in problems:
        print("::error::" + problem)
    if problems:
        return 1
    print("Diff guard OK: %d changed paths, frozen/historical paths only moved as approved." % len(changes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""Release-boundary checker for the Play flavor (M3-01 sections 4 and 17).

Reads the *final artifacts* (APK dex bytes, merged manifest, resolved dependency list), not the
source tree, and compares them with allow-lists kept in this directory.

W0a runs it with --baseline (the exact set of known historical violations that still ship in the
NON-RELEASABLE W0a play build): anything not in the baseline fails, and a baseline entry that no
longer appears also fails (stale), so the baseline cannot silently outlive W0b. W0b deletes the
baseline and the checker then enforces a clean boundary.

Limits (documented in docs/android/release-boundary.md): class detection scans type descriptors in
the dex string tables, which is only valid while R8/minification is off; the checker fails if an
R8 mapping exists so enabling R8 forces the later hardening gate.

Exit codes: 0 pass (or report mode), 1 boundary violation, 2 usage/input error.
"""
import argparse
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ANDROID_NS = "{http://schemas.android.com/apk/res/android}"
COMPONENT_TAGS = ("activity", "activity-alias", "service", "receiver", "provider")
NONRELEASABLE_MARKER = "nonreleasable"


class InputError(Exception):
    pass


def load_list(path):
    """One entry per line; '#' comments and blank lines ignored."""
    entries = set()
    try:
        with open(path, encoding="utf-8") as handle:
            for raw in handle:
                line = raw.split("#", 1)[0].strip()
                if line:
                    entries.add(line)
    except OSError as error:
        raise InputError("cannot read %s: %s" % (path, error))
    return entries


def parse_manifest(xml_text):
    """Returns (uses_permissions, declared_permissions, components) from a merged manifest."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as error:
        raise InputError("manifest is not valid XML: %s" % error)
    package = root.get("package", "")

    def qualify(name):
        if name.startswith("."):
            return package + name
        if "." not in name and package:
            return package + "." + name
        return name

    uses, declared, components = set(), set(), set()
    for element in root.iter():
        tag = element.tag
        name = element.get(ANDROID_NS + "name")
        if tag in ("uses-permission", "uses-permission-sdk-23") and name:
            uses.add(name)
        elif tag == "permission" and name:
            declared.add(name)
        elif tag in COMPONENT_TAGS and name:
            exported = element.get(ANDROID_NS + "exported")
            components.add("%s|%s|exported=%s" % (tag, qualify(name), exported if exported else "unset"))
    return uses, declared, components


_TREE_LINE = re.compile(r"^[\s|]*[+\\]--- (.+)$")


def parse_dependencies(text):
    """Distinct group:artifact coordinates from `gradlew dependencies` output."""
    coordinates = set()
    for line in text.splitlines():
        match = _TREE_LINE.match(line)
        if not match:
            continue
        body = match.group(1).strip()
        if body.startswith("project ") or body.endswith("(c)"):
            continue
        parts = body.split()[0].split(":")
        if len(parts) >= 2 and parts[0] and parts[1]:
            coordinates.add("%s:%s" % (parts[0], parts[1]))
    return coordinates


def scan_dex(apk_path, denied_prefixes):
    """Denied dotted prefixes whose type descriptors occur in any classes*.dex of the APK."""
    found = set()
    try:
        archive = zipfile.ZipFile(apk_path)
    except (OSError, zipfile.BadZipFile) as error:
        raise InputError("cannot open APK %s: %s" % (apk_path, error))
    with archive:
        dex_names = [n for n in archive.namelist() if re.fullmatch(r"classes\d*\.dex", n)]
        if not dex_names:
            raise InputError("APK %s contains no classes.dex" % apk_path)
        for dex_name in dex_names:
            data = archive.read(dex_name)
            for prefix in denied_prefixes:
                descriptor = ("L" + prefix.replace(".", "/")).encode("utf-8")
                if descriptor in data:
                    found.add(prefix)
    return found


def evaluate(manifest_xml, apk_path, dependencies_text, allowed, denied_prefixes, r8_mapping_path, version_name, baseline):
    """Returns (findings, hard_findings, discovered)."""
    uses, declared, components = parse_manifest(manifest_xml)
    dependencies = parse_dependencies(dependencies_text)
    denied_found = scan_dex(apk_path, denied_prefixes)

    findings = set()
    findings |= {"permission|" + p for p in uses - allowed["permissions"]}
    findings |= {"declared-permission|" + p for p in declared - allowed["permissions"]}
    findings |= {"component|" + c for c in components - allowed["components"]}
    findings |= {"dependency|" + d for d in dependencies - allowed["dependencies"]}
    findings |= {"class|" + p for p in denied_found}

    hard = set()
    if r8_mapping_path and os.path.exists(r8_mapping_path):
        hard.add("r8|mapping-present: class-name scanning is insufficient once R8 is on; the hardening gate is required")
    has_marker = NONRELEASABLE_MARKER in (version_name or "")
    if baseline is not None and not has_marker:
        hard.add("version|baseline in use but versionName lacks '%s'" % NONRELEASABLE_MARKER)
    if baseline is None and has_marker:
        hard.add("version|versionName still marked '%s' but no baseline is in use" % NONRELEASABLE_MARKER)

    discovered = {
        "permissions": sorted(uses | declared),
        "components": sorted(components),
        "dependencies": sorted(dependencies),
        "denied-classes-found": sorted(denied_found),
    }
    return findings, hard, discovered


def verdict(findings, hard, baseline):
    """Returns (unexpected, stale, hard) sorted lists. Empty everywhere means the boundary holds."""
    expected = baseline if baseline is not None else set()
    unexpected = sorted(findings - expected)
    stale = sorted(expected - findings)
    return unexpected, stale, sorted(hard)


def render_report(label, mode, baseline, findings, hard, discovered, unexpected, stale):
    lines = ["RELEASE BOUNDARY REPORT: %s" % label, "mode: %s" % mode]
    if baseline is not None:
        lines.append("STAMP: NON-RELEASABLE (W0a) - baseline of %d known historical violations in use" % len(baseline))
    lines.append("")
    lines.append("== discovered (allow-list format) ==")
    for key in ("permissions", "components", "dependencies", "denied-classes-found"):
        lines.append("[%s] (%d)" % (key, len(discovered[key])))
        lines.extend("  " + item for item in discovered[key])
    lines.append("")
    lines.append("== findings against allow-lists/deny-lists (%d) ==" % len(findings))
    lines.extend("  " + f for f in sorted(findings))
    if baseline is not None:
        lines.append("== known historical baseline matched ==")
        lines.extend("  " + f for f in sorted(findings & baseline))
    lines.append("")
    lines.append("== VIOLATIONS ==")
    lines.extend("  UNEXPECTED " + u for u in unexpected)
    lines.extend("  STALE-BASELINE " + s for s in stale)
    lines.extend("  HARD " + h for h in hard)
    if not (unexpected or stale or hard):
        lines.append("  none")
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--label", default="play")
    parser.add_argument("--apk", required=True)
    parser.add_argument("--manifest-xml", required=True)
    parser.add_argument("--dependencies-file", required=True)
    parser.add_argument("--rules-dir", default=os.path.dirname(os.path.abspath(__file__)))
    parser.add_argument("--baseline", help="known-historical baseline; omit for a clean (W0b+) boundary")
    parser.add_argument("--r8-mapping", help="path an R8 mapping.txt would have; presence is a hard failure")
    parser.add_argument("--version-name", default="")
    parser.add_argument("--mode", choices=("enforce", "report"), default="enforce")
    parser.add_argument("--report-out")
    args = parser.parse_args(argv)

    try:
        allowed = {
            "permissions": load_list(os.path.join(args.rules_dir, "allowed-permissions.txt")),
            "components": load_list(os.path.join(args.rules_dir, "allowed-components.txt")),
            "dependencies": load_list(os.path.join(args.rules_dir, "allowed-dependencies.txt")),
        }
        denied = load_list(os.path.join(args.rules_dir, "denied-class-patterns.txt"))
        baseline = load_list(args.baseline) if args.baseline else None
        with open(args.manifest_xml, encoding="utf-8") as handle:
            manifest_xml = handle.read()
        with open(args.dependencies_file, encoding="utf-8") as handle:
            dependencies_text = handle.read()
        findings, hard, discovered = evaluate(
            manifest_xml, args.apk, dependencies_text, allowed, denied, args.r8_mapping, args.version_name, baseline
        )
    except (InputError, OSError) as error:
        print("input error: %s" % error, file=sys.stderr)
        return 2

    unexpected, stale, hard_list = verdict(findings, hard, baseline)
    report = render_report(args.label, args.mode, baseline, findings, hard, discovered, unexpected, stale)
    sys.stdout.write(report)
    if args.report_out:
        with open(args.report_out, "w", encoding="utf-8") as handle:
            handle.write(report)
    if args.mode == "report":
        print("REPORT MODE: not a gate.")
        return 0
    return 1 if (unexpected or stale or hard_list) else 0


if __name__ == "__main__":
    sys.exit(main())

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
EXPECTED_PACKAGE = "com.muslimrecovery.protection"


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


PERMISSION_TAGS = ("uses-permission", "uses-permission-sdk-23", "uses-permission-sdk-m")
DECLARATION_TAGS = ("permission", "permission-tree", "permission-group")


def filter_signature(element):
    """Normalized, order-independent signature of every intent filter of a component, or 'none'.

    Tokens: action:<name>, category:<name>, data:<attr>=<value> for scheme/host/mimeType/path*.
    A new VIEW/BROWSABLE filter on an allowed component therefore changes its key and fails.
    """
    tokens = set()
    for intent_filter in element.findall("intent-filter"):
        for child in intent_filter:
            name = child.get(ANDROID_NS + "name")
            if child.tag in ("action", "category") and name:
                tokens.add("%s:%s" % (child.tag, name))
            elif child.tag == "data":
                for attribute in ("scheme", "host", "port", "mimeType", "path", "pathPrefix", "pathPattern"):
                    value = child.get(ANDROID_NS + attribute)
                    if value:
                        tokens.add("data:%s=%s" % (attribute, value))
    return ",".join(sorted(tokens)) if tokens else "none"


def parse_manifest(xml_text):
    """Returns a dict: package, uses, declared, components and application attributes.

    A component key records everything that decides who can reach it: tag, qualified name, the
    exported flag, its guarding permission and whether it declares intent filters.
    """
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
    application = {}
    for element in root.iter():
        tag = element.tag
        name = element.get(ANDROID_NS + "name")
        if tag in PERMISSION_TAGS and name:
            uses.add(name)
        elif tag in DECLARATION_TAGS and name:
            declared.add(name)
        elif tag == "application":
            for attribute in ("allowBackup", "debuggable", "usesCleartextTraffic"):
                application[attribute] = element.get(ANDROID_NS + attribute)
        elif tag in COMPONENT_TAGS and name:
            exported = element.get(ANDROID_NS + "exported")
            guard = element.get(ANDROID_NS + "permission")
            components.add(
                "%s|%s|exported=%s|permission=%s|filters=%s"
                % (tag, qualify(name), exported if exported else "unset", guard if guard else "none",
                   filter_signature(element))
            )
    return {"package": package, "uses": uses, "declared": declared, "components": components, "application": application}


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


def scan_apk(apk_path, denied_prefixes):
    """Returns (denied_prefixes_found, embedded_code_entries).

    Denied dotted prefixes are searched as type descriptors in every *.dex entry of the APK.
    Any native library, jar, nested apk/zip or non-standard dex entry is reported as embedded code.
    """
    found, code_entries = set(), set()
    try:
        archive = zipfile.ZipFile(apk_path)
    except (OSError, zipfile.BadZipFile) as error:
        raise InputError("cannot open APK %s: %s" % (apk_path, error))
    with archive:
        names = archive.namelist()
        if not any(re.fullmatch(r"classes\d*\.dex", n) for n in names):
            raise InputError("APK %s contains no classes.dex" % apk_path)
        for name in names:
            lowered = name.lower()
            if lowered.endswith(".dex"):
                if not re.fullmatch(r"classes\d*\.dex", name):
                    code_entries.add(name)
                data = archive.read(name)
                for prefix in denied_prefixes:
                    if ("L" + prefix.replace(".", "/")).encode("utf-8") in data:
                        found.add(prefix)
            elif lowered.endswith((".so", ".jar", ".apk", ".zip")):
                code_entries.add(name)
    return found, code_entries


def scan_bundle(bundle_path, denied_prefixes):
    """Denied dotted prefixes found as type descriptors in any *.dex entry of an AAB (base/dex/...)."""
    found = set()
    try:
        archive = zipfile.ZipFile(bundle_path)
    except (OSError, zipfile.BadZipFile) as error:
        raise InputError("cannot open bundle %s: %s" % (bundle_path, error))
    with archive:
        dex_names = [n for n in archive.namelist() if n.lower().endswith(".dex")]
        if not dex_names:
            raise InputError("bundle %s contains no .dex entries" % bundle_path)
        for name in dex_names:
            data = archive.read(name)
            for prefix in denied_prefixes:
                if ("L" + prefix.replace(".", "/")).encode("utf-8") in data:
                    found.add(prefix)
    return found


def evaluate(manifest_xml, apk_path, dependencies_text, allowed, denied_prefixes, r8_mapping_path, version_name,
             baseline, expected_package=EXPECTED_PACKAGE, bundle_path=None):
    """Returns (findings, hard_findings, discovered)."""
    manifest = parse_manifest(manifest_xml)
    dependencies = parse_dependencies(dependencies_text)
    if not dependencies:
        raise InputError("no dependencies parsed from the dependency file (empty or failed resolution)")
    denied_found, code_entries = scan_apk(apk_path, denied_prefixes)

    findings = set()
    findings |= {"permission|" + p for p in manifest["uses"] - allowed["permissions"]}
    findings |= {"declared-permission|" + p for p in manifest["declared"] - allowed["permissions"]}
    findings |= {"component|" + c for c in manifest["components"] - allowed["components"]}
    findings |= {"dependency|" + d for d in dependencies - allowed["dependencies"]}
    findings |= {"class|" + p for p in denied_found}
    findings |= {"code-entry|" + e for e in code_entries - allowed["code_entries"]}
    if bundle_path:
        findings |= {"bundle-class|" + p for p in scan_bundle(bundle_path, denied_prefixes)}

    hard = set()
    if r8_mapping_path and os.path.exists(r8_mapping_path):
        hard.add("r8|mapping-present: class-name scanning is insufficient once R8 is on; the hardening gate is required")
    has_marker = NONRELEASABLE_MARKER in (version_name or "")
    if baseline is not None and not has_marker:
        hard.add("version|baseline in use but versionName lacks '%s'" % NONRELEASABLE_MARKER)
    if baseline is None and has_marker:
        hard.add("version|versionName still marked '%s' but no baseline is in use" % NONRELEASABLE_MARKER)
    if expected_package and manifest["package"] != expected_package:
        hard.add("package|applicationId/package is '%s', expected '%s' (D-11: not changed before the first Play publication)"
                 % (manifest["package"], expected_package))
    application = manifest["application"]
    if application.get("allowBackup") != "false":
        hard.add("application|android:allowBackup must be explicitly false (found %s)" % application.get("allowBackup"))
    if application.get("debuggable") == "true":
        hard.add("application|android:debuggable must not be true in the play release artifact")
    if application.get("usesCleartextTraffic") == "true":
        hard.add("application|android:usesCleartextTraffic must not be true")

    discovered = {
        "permissions": sorted(manifest["uses"] | manifest["declared"]),
        "components": sorted(manifest["components"]),
        "dependencies": sorted(dependencies),
        "denied-classes-found": sorted(denied_found),
        "code-entries": sorted(code_entries),
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
    for key in ("permissions", "components", "dependencies", "denied-classes-found", "code-entries"):
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
    parser.add_argument("--expected-package", default=EXPECTED_PACKAGE)
    parser.add_argument("--bundle", help="the playRelease .aab; its dex entries are scanned with the same deny-list")
    parser.add_argument("--mode", choices=("enforce", "report"), default="enforce")
    parser.add_argument("--report-out")
    args = parser.parse_args(argv)

    if (args.mode == "report" and os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("BOUNDARY_ALLOW_REPORT_MODE") != "1"):
        print("input error: report mode is not a gate and is refused on GitHub Actions "
              "unless BOUNDARY_ALLOW_REPORT_MODE=1 is set explicitly in the workflow", file=sys.stderr)
        return 2

    try:
        allowed = {
            "permissions": load_list(os.path.join(args.rules_dir, "allowed-permissions.txt")),
            "components": load_list(os.path.join(args.rules_dir, "allowed-components.txt")),
            "dependencies": load_list(os.path.join(args.rules_dir, "allowed-dependencies.txt")),
            "code_entries": load_list(os.path.join(args.rules_dir, "allowed-code-entries.txt")),
        }
        denied = load_list(os.path.join(args.rules_dir, "denied-class-patterns.txt"))
        if not denied:
            raise InputError("denied-class-patterns.txt is empty; the deny-list must not be emptied")
        baseline = load_list(args.baseline) if args.baseline else None
        with open(args.manifest_xml, encoding="utf-8") as handle:
            manifest_xml = handle.read()
        with open(args.dependencies_file, encoding="utf-8") as handle:
            dependencies_text = handle.read()
        findings, hard, discovered = evaluate(
            manifest_xml, args.apk, dependencies_text, allowed, denied, args.r8_mapping, args.version_name, baseline,
            args.expected_package, args.bundle,
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

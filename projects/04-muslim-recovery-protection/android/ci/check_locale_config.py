#!/usr/bin/env python3
"""F9 (E4, C2): objective proof that the final Play artifact's manifest LINKS to the generated LocaleConfig.

  check_locale_config.py --apk <apk> --apkanalyzer <path> --aapt2 <path> [--expected en,ar,de]

The chain is proven end to end, with the SDK's own tools (nothing assumes plain XML in the APK):

  1. `apkanalyzer manifest print`      -> the final manifest's `android:localeConfig` reference (a numeric id such as
                                          `@ref/0x7f100000` in a release APK, or `@xml/<name>`);
  2. `aapt2 dump resources`            -> the resource table entry for exactly that id/name, with its file path
                                          (release builds shorten paths, e.g. `res/Ed.xml`);
  3. `apkanalyzer resources xml`       -> the decoded XML of exactly that file, which must be a `<locale-config>`
                                          listing exactly the expected locales.

A manifest that references any other resource, an id that is missing from the table, a non-XML resource, or a config whose
locales differ cannot pass. A valid LocaleConfig that the manifest does NOT reference cannot pass either.
SYSTEM (the empty application locale list) is runtime AppCompat behavior, proven by the instrumentation test.
"""
import argparse
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"
_RESOURCE_LINE = re.compile(r"^\s*resource\s+(0x[0-9a-fA-F]{8})\s+([A-Za-z0-9_.+-]+)/(\S+)")
_FILE_LINE = re.compile(r"\(file\)\s+(\S+)")
_REFERENCE = re.compile(r"^@(?:ref/)?(0x[0-9a-fA-F]{8})$|^@xml/(.+)$")


def manifest_locale_config(manifest_xml):
    """Value of android:localeConfig on <application>, or None."""
    application = ET.fromstring(manifest_xml).find("application")
    if application is None:
        return None
    return application.get(ANDROID + "localeConfig") or application.get("android:localeConfig")


def parse_resource_table(dump):
    """`aapt2 dump resources` text -> {id: {"type", "name", "files": [paths]}} (files from `(file) path` lines)."""
    table, current = {}, None
    for line in dump.splitlines():
        match = _RESOURCE_LINE.match(line)
        if match:
            current = table.setdefault(match.group(1).lower(), {"type": match.group(2), "name": match.group(3), "files": []})
            continue
        if current is not None:
            file_match = _FILE_LINE.search(line)
            if file_match:
                current["files"].append(file_match.group(1))
            elif line.strip().startswith(("type ", "Package ", "package ")):
                current = None
    return table


def locale_config_locales(xml_text):
    """Locale names if the document's root is <locale-config>, else None."""
    root = ET.fromstring(xml_text)
    if root.tag != "locale-config":
        return None
    return [e.get(ANDROID + "name") or e.get("android:name") for e in root.findall("locale")]


def resolve(reference, table):
    """Returns (problems, entry_id, entry) for the manifest reference."""
    match = _REFERENCE.match(reference or "")
    if not match:
        return ["the manifest has no usable android:localeConfig reference (found %r)" % reference], None, None
    if match.group(1):
        key = match.group(1).lower()
        entry = table.get(key)
        if entry is None:
            return ["the manifest references %s but that id is not in the resource table" % key], key, None
    else:
        name = match.group(2)
        matches = [(k, v) for k, v in table.items() if v["type"] == "xml" and v["name"] == name]
        if len(matches) != 1:
            return ["the manifest references @xml/%s which matches %d resource table entries" % (name, len(matches))], None, None
        key, entry = matches[0]
    problems = []
    if entry["type"] != "xml":
        problems.append("the referenced resource %s is type %s, not xml" % (key, entry["type"]))
    if len(entry["files"]) != 1:
        problems.append("the referenced resource %s must map to exactly one file, found %s" % (key, entry["files"]))
    return problems, key, entry


def evaluate(manifest_xml, table, decode, expected):
    """decode(path) -> XML text. Returns (problems, details dict)."""
    reference = manifest_locale_config(manifest_xml)
    problems, key, entry = resolve(reference, table)
    details = {"reference": reference, "resource_id": key, "resource": None, "file": None, "locales": None}
    if problems or entry is None:
        return problems, details
    details["resource"] = "%s/%s" % (entry["type"], entry["name"])
    path = entry["files"][0]
    details["file"] = path
    try:
        locales = locale_config_locales(decode(path))
    except ET.ParseError:
        return ["the file %s of the referenced resource is not parseable XML" % path], details
    if locales is None:
        return ["the referenced resource %s (%s) is not a <locale-config>" % (key, path)], details
    details["locales"] = locales
    if None in locales or len(set(locales)) != len(locales):
        problems.append("the locale list has missing names or duplicates: %s" % locales)
    if set(locales) != set(expected):
        problems.append("locales %s != expected %s" % (sorted(locales, key=str), sorted(expected)))
    return problems, details


def _run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True)
    parser.add_argument("--apkanalyzer", required=True)
    parser.add_argument("--aapt2", required=True)
    parser.add_argument("--expected", default="en,ar,de")
    args = parser.parse_args(argv[1:])
    expected = [e.strip() for e in args.expected.split(",") if e.strip()]
    manifest = _run([args.apkanalyzer, "manifest", "print", args.apk])
    dump = _run([args.aapt2, "dump", "resources", args.apk])
    table = parse_resource_table(dump)
    problems, details = evaluate(
        manifest, table, lambda path: _run([args.apkanalyzer, "resources", "xml", "--file", path, args.apk]), expected)
    print("manifest android:localeConfig = %s" % details["reference"])
    print("resolved resource id          = %s" % details["resource_id"])
    print("resource table entry          = %s" % details["resource"])
    print("resource file                 = %s" % details["file"])
    print("locales                       = %s (expected %s)" % (details["locales"], expected))
    print("resource table entries parsed = %d" % len(table))
    for problem in problems:
        print("::error::" + problem)
    if problems:
        return 1
    print("LocaleConfig linked-reference proof OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

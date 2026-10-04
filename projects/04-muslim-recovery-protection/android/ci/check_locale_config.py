#!/usr/bin/env python3
"""F9 (E4): objective evidence that the final Play artifact carries the AGP-generated LocaleConfig.

  check_locale_config.py --apk <apk> --apkanalyzer <path> [--expected en,ar,de]

Does not assume the APK exposes plain XML. It asks `apkanalyzer` (the SDK's own tool) for:
  1. the decoded merged manifest, and requires `<application android:localeConfig=...>` to be present;
  2. the decoded resource XML files, and requires exactly one whose root element is `<locale-config>`;
  3. the locales listed in it, which must equal the expected set exactly (order-insensitive, no duplicates).
SYSTEM (the empty application locale list) is a runtime AppCompat behavior and is proven by the instrumentation test,
not by this static check.
"""
import argparse
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"
# Resource directories that never hold an XML locale-config (keeps the number of apkanalyzer calls small).
SKIP_DIRS = ("res/layout", "res/drawable", "res/mipmap", "res/color", "res/anim", "res/animator", "res/interpolator",
             "res/raw", "res/font", "res/menu", "res/transition", "res/navigation")


def manifest_locale_config(manifest_xml):
    """Value of android:localeConfig on <application>, or None."""
    root = ET.fromstring(manifest_xml)
    application = root.find("application")
    if application is None:
        return None
    return application.get(ANDROID + "localeConfig") or application.get("android:localeConfig")


def candidate_files(listing):
    """XML resource files worth decoding, fast path first (the AGP name is stable when names are not shortened)."""
    files = []
    for line in listing.splitlines():
        path = line.strip().split()[-1] if line.strip() else ""
        path = path.lstrip("/")
        if path.startswith("res/") and path.endswith(".xml") and not path.startswith(SKIP_DIRS):
            files.append(path)
    fast = [f for f in files if re.search(r"locale.*config", f, re.IGNORECASE)]
    return fast if fast else sorted(files)


def locale_config_locales(xml_text):
    """Locale names if the document's root is <locale-config>, else None."""
    root = ET.fromstring(xml_text)
    if root.tag != "locale-config":
        return None
    return [e.get(ANDROID + "name") or e.get("android:name") for e in root.findall("locale")]


def evaluate(manifest_xml, decoded_files, expected):
    """decoded_files: {path: xml text}. Returns (problems, found_locales, config_file)."""
    problems = []
    reference = manifest_locale_config(manifest_xml)
    if not reference:
        problems.append("the final manifest has no android:localeConfig on <application>")
    configs = {}
    for path, text in decoded_files.items():
        try:
            locales = locale_config_locales(text)
        except ET.ParseError:
            problems.append("candidate %s is not parseable XML" % path)
            continue
        if locales is not None:
            configs[path] = locales
    if len(configs) != 1:
        problems.append("expected exactly one <locale-config> resource, found %d: %s" % (len(configs), sorted(configs)))
        return problems, None, None
    path, locales = next(iter(configs.items()))
    named = re.match(r"^@xml/(.+)$", reference or "")
    if named and path.startswith("res/xml/") and path != "res/xml/%s.xml" % named.group(1):
        problems.append("manifest references @xml/%s but the locale-config resource is %s" % (named.group(1), path))
    if None in locales or len(set(locales)) != len(locales):
        problems.append("the locale list has missing names or duplicates: %s" % locales)
    if set(locales) != set(expected):
        problems.append("locales %s != expected %s" % (sorted(locales, key=str), sorted(expected)))
    return problems, locales, path


def _run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True)
    parser.add_argument("--apkanalyzer", required=True)
    parser.add_argument("--expected", default="en,ar,de")
    args = parser.parse_args(argv[1:])
    expected = [e.strip() for e in args.expected.split(",") if e.strip()]
    manifest = _run([args.apkanalyzer, "manifest", "print", args.apk])
    listing = _run([args.apkanalyzer, "files", "list", args.apk])
    decoded = {}
    for path in candidate_files(listing):
        try:
            decoded[path] = _run([args.apkanalyzer, "resources", "xml", "--file", path, args.apk])
        except subprocess.CalledProcessError as error:
            print("note: could not decode %s (%s)" % (path, error.returncode))
    problems, locales, path = evaluate(manifest, decoded, expected)
    print("manifest android:localeConfig = %s" % manifest_locale_config(manifest))
    print("locale-config resource = %s" % path)
    print("locales = %s (expected %s)" % (locales, expected))
    print("decoded %d candidate resource files" % len(decoded))
    for problem in problems:
        print("::error::" + problem)
    if problems:
        return 1
    print("LocaleConfig evidence OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

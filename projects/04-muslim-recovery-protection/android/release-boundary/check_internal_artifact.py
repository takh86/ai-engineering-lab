#!/usr/bin/env python3
"""Internal-flavor inclusion check (M3-01 W0b): the internal artifact must still contain the historical
M1 DNS/VPN experiment, wired as approved, and must stay clearly differentiated from the play build.

Reads the built internalDebug APK (merged manifest via `apkanalyzer manifest print`, dex type descriptors).
Exit codes: 0 pass, 1 a required element is missing or mis-configured, 2 usage/input error.
"""
import argparse
import sys

import check_release_boundary as crb

PKG = "com.muslimrecovery.protection"
REQUIRED_PERMISSIONS = {
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
}
SHELL = ("activity|%s.MainActivity|exported=true|permission=none|"
         "filters=action:android.intent.action.MAIN,category:android.intent.category.LAUNCHER" % PKG)
VPN_SERVICE = ("service|%s.vpn.LocalProtectionVpnService|exported=true|permission=android.permission.BIND_VPN_SERVICE|"
               "filters=action:android.net.VpnService" % PKG)
HARNESS = "activity|%s.ExperimentalHarnessActivity|exported=false|permission=none|filters=none" % PKG
REQUIRED_COMPONENTS = {VPN_SERVICE, HARNESS, SHELL}
REQUIRED_CLASSES = [
    PKG + ".vpn.LocalProtectionVpnService",
    PKG + ".dns.DnsFilteringEngine",
    PKG + ".ExperimentalHarnessActivity",
]
EXPECTED_APPLICATION_ID = PKG + ".internal"
# Debug-only AndroidX tooling activities merged into debug builds (ui-test-manifest, ui-tooling). They
# exist only because the internal artifact is a debug build; nothing else may be an exported activity.
DEBUG_TOOLING_EXPORTED_ACTIVITIES = {
    "activity|androidx.activity.ComponentActivity|exported=true|permission=none|filters=none",
    "activity|androidx.compose.ui.tooling.PreviewActivity|exported=true|permission=none|filters=none",
}
# Exported library component also present in the play artifact (protected by android.permission.DUMP).
PROFILE_INSTALL_RECEIVER = (
    "receiver|androidx.profileinstaller.ProfileInstallReceiver|exported=true|permission=android.permission.DUMP|"
    "filters=action:androidx.profileinstaller.action.BENCHMARK_OPERATION,action:androidx.profileinstaller.action.INSTALL_PROFILE,"
    "action:androidx.profileinstaller.action.SAVE_PROFILE,action:androidx.profileinstaller.action.SKIP_FILE"
)
ALLOWED_EXPORTED = {SHELL, VPN_SERVICE, PROFILE_INSTALL_RECEIVER} | DEBUG_TOOLING_EXPORTED_ACTIVITIES


def check(manifest_xml, apk_path, version_name):
    manifest = crb.parse_manifest(manifest_xml)
    problems = []
    for permission in sorted(REQUIRED_PERMISSIONS - manifest["uses"]):
        problems.append("missing permission " + permission)
    for component in sorted(REQUIRED_COMPONENTS - manifest["components"]):
        problems.append("missing or mis-configured component " + component)
    # Every exported component of ANY kind (activity, alias, service, receiver, provider) must be known.
    exported = {c for c in manifest["components"] if "|exported=true|" in c}
    unexpected = sorted(exported - ALLOWED_EXPORTED)
    if SHELL not in exported or unexpected:
        problems.append(
            "only the product shell, the guarded VPN service, the DUMP-guarded profileinstaller receiver and known "
            "debug-tooling activities may be exported; unexpected: %s" % unexpected
        )
    if manifest["package"] != EXPECTED_APPLICATION_ID:
        problems.append("applicationId is '%s', expected '%s'" % (manifest["package"], EXPECTED_APPLICATION_ID))
    if not (version_name or "").endswith("-internal"):
        problems.append("versionName '%s' must end with -internal" % version_name)
    found, _ = crb.scan_apk(apk_path, REQUIRED_CLASSES)
    for missing in sorted(set(REQUIRED_CLASSES) - found):
        problems.append("class missing from the internal artifact: " + missing)
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apk", required=True)
    parser.add_argument("--manifest-xml", required=True)
    parser.add_argument("--version-name", default="")
    args = parser.parse_args(argv)
    try:
        with open(args.manifest_xml, encoding="utf-8") as handle:
            manifest_xml = handle.read()
        problems = check(manifest_xml, args.apk, args.version_name)
    except (crb.InputError, OSError) as error:
        print("input error: %s" % error, file=sys.stderr)
        return 2
    for problem in problems:
        print("INTERNAL ARTIFACT PROBLEM:", problem)
    if problems:
        return 1
    print("Internal artifact OK: M1 DNS/VPN experiment, harness (not exported), service guard and differentiated id present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

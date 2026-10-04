# Release boundary (Play vs Internal)

Source: M3-01 §4, §7, §17 and Amendments A1, A2, A5, and the W0b isolation. Tooling lives in `android/release-boundary/`; CI in
`.github/workflows/project-04-android-ci.yml`.

## Variants

| Flavor | applicationId | May contain | May be uploaded |
|---|---|---|---|
| `play` | unchanged (`com.muslimrecovery.protection`) | release-approved features only | `playRelease` only, and only with Owner approval |
| `internal` | base + `.internal` | separately approved experiments, diagnostics | never; `internalRelease` is disabled |

Compile-time absence is the isolation. Runtime flags are never the boundary.

## W0b status: structural isolation

Since W0b the historical M1 VPN/DNS experiment lives only in `src/internal` (see `historical-code-map.md`). The play flavor therefore
contains no `vpn`/`dns` classes, no `ExperimentalHarnessActivity`, no VPN service and none of the historical M1 permissions, and the
W0a "NON-RELEASABLE" machinery is gone:

- `w0a-known-historical.txt` is deleted: the checker runs with **zero** historical exceptions, and CI fails if that file reappears;
- the `-nonreleasable-w0a` versionName suffix is removed (the checker rejects a marker without a baseline and a baseline without a marker);
- `denied-class-patterns.txt` additionally denies `ExperimentalHarnessActivity`;
- CI scans the built play **APK** (manifest, dex, native entries, dependencies) and **AAB** (dex), and separately proves the
  **internal** debug APK still contains the experiment (`check_internal_artifact.py`: permissions, VPN service guard, harness not exported,
  `.internal` application id, required classes).

This is *engineering* isolation evidence. Play artifacts are still **not authorized for Google Play upload**; no `playRelease`
binary is uploaded by CI, and release gates (R8 hardening, native-library / 16 KB alignment, Play declarations) remain open.

## What the checker reads (final play release artifact)

1. Merged manifest (`apkanalyzer manifest print`):
   - permissions (`uses-permission`, `-sdk-23`, `-sdk-m`) and declarations (`permission`, `permission-tree`,
     `permission-group`) must be in `allowed-permissions.txt`;
   - components must be in `allowed-components.txt` with the key
     `<tag>|<class>|exported=<true|false|unset>|enabled=<true|false|unset>|permission=<guard|none>|filters=<signature|none>`, so removing a
     service's `BIND_*` guard, adding an intent filter, or flipping `android:enabled` (F9) changes the key and fails; the accepted state of the
     AppCompat locale service is `exported=false`, `enabled=false`, and its `<meta-data>` `autoStoreLocales=true` is verified separately
     (`REQUIRED_COMPONENT_METADATA`; a missing component or a different value is a hard failure, also on the internal artifact);
   - hard failures: `allowBackup` not explicitly `false`, `debuggable="true"`, `usesCleartextTraffic="true"`, and a
     package/applicationId other than `com.muslimrecovery.protection` (D-11: unchanged before the first Play publication).
2. Every `*.dex` entry: must not contain the type-descriptor prefixes in `denied-class-patterns.txt`
   (`experimental.`, `vpn.`, `dns.`). Any `.so`, `.jar` or non-standard `.dex` entry is reported as embedded code unless it is in
   `allowed-code-entries.txt`.
3. `playReleaseRuntimeClasspath` (`gradlew dependencies`): coordinates (`group:artifact`, versions not pinned) must be in
   `allowed-dependencies.txt`. An empty or unparsable dependency file is an input error, never a pass.
4. R8 guard: if `app/build/outputs/mapping/playRelease/mapping.txt` exists the checker fails; CI also fails if
   `app/build.gradle.kts` enables minification.

Input hardening: an empty deny-list, a missing/empty input, or a manifest that is not valid XML is exit code 2.
`--mode report` is refused on GitHub Actions unless `BOUNDARY_ALLOW_REPORT_MODE=1` is set explicitly in the workflow
(visible in review). Exit codes: 0 pass, 1 violation, 2 usage/input error.

CI additionally asserts from the Gradle task graph that no `internalRelease` task exists and the play/internal tasks do.

## Self-test

`python3 -m unittest` in `release-boundary/` is a normal passing test suite. It passes by proving the checker
rejects known-bad synthetic fixtures (extra permission, unlisted service, exported-flag change, experimental/vpn/dns
classes including in secondary dex, unlisted dependency, R8 mapping, stale/unexpected baseline entries, wrong version
marker, malformed inputs) and accepts a known-good fixture. No CI job expects a failing outcome.

## Changing the lists, and who guards the guard

An addition to any allow-list, a change to the baseline, to `app/build.gradle.kts` flavors, or to the workflow is a boundary
change: it needs an Owner-approved PR. CI surfaces such changes as warnings on the PR, but **no technical control prevents a
PR from weakening the boundary** (there is no CODEOWNERS file or branch-protection ruleset visible to the implementation
agent). Requiring Owner review on `release-boundary/**`, `.github/workflows/**` and the flavor configuration (CODEOWNERS plus a
required review) is an open Owner decision.

## R8 / minification (D-10: R8 stays off during W0)

While minification is off, class and package names are intact and the dex-descriptor deny-list is valid evidence.
**Once R8, minification or repackaging is enabled, class-name scanning alone is insufficient** (names are renamed or removed).
The later hardening gate must then verify experimental exclusion through variant/source-set evidence and/or the R8
mapping and artifact evidence, and the checker's R8 guard will fail until that gate is implemented.

## Known limits of the checker

- It checks the `playRelease` artifact only (not `playDebug`, whose debug-only test manifests add noise).
- Dex scanning matches type descriptors; a reference to a denied class from allowed code is also flagged (intended).
  It cannot see code hidden inside compressed archives within the APK, or logic that is not a class reference.
- `<meta-data>`, `<uses-feature>`, `<uses-library>` and `<queries>` are not inspected.
- The checker trusts the versionName and manifest files CI passes it; they come from the same build.
- The AAB is scanned for denied classes in its dex entries only; its (protobuf) manifest is not decoded, so manifest evidence comes from the same variant's APK.

# Release boundary (Play vs Internal)

Source: M3-01 §4, §7, §17 and Amendments A1, A2, A5. Tooling lives in `android/release-boundary/`; CI in
`.github/workflows/project-04-android-ci.yml`.

## Variants

| Flavor | applicationId | May contain | May be uploaded |
|---|---|---|---|
| `play` | unchanged (`com.muslimrecovery.protection`) | release-approved features only (after W0b) | `playRelease` only, and only with Owner approval |
| `internal` | base + `.internal` | separately approved experiments, diagnostics | never; `internalRelease` is disabled |

Compile-time absence is the isolation. Runtime flags are never the boundary.

## W0a status: NON-RELEASABLE

Until W0b the historical VPN/DNS experiment still lives in `src/main`, so the play flavor still contains it.
Therefore in W0a:

- `playRelease` is assembled only as engineering evidence; no `playRelease` binary is uploaded by CI;
- the play `versionName` carries `-nonreleasable-w0a`;
- the checker runs with `w0a-known-historical.txt`, the exact set of known violations. Anything outside it
  fails, and an entry that no longer appears also fails (stale). W0b deletes the baseline file and the
  `-nonreleasable-w0a` suffix together; the checker enforces that both appear or disappear together.

## What the checker reads (final play release artifact)

1. Merged manifest (`apkanalyzer manifest print`): permissions, declared permissions and components
   (`<tag>|<class>|exported=<true|false|unset>`) must be in `allowed-permissions.txt` / `allowed-components.txt`.
2. Dex type descriptors in every `classes*.dex`: must not contain the prefixes in `denied-class-patterns.txt`
   (`experimental.`, `vpn.`, `dns.`).
3. `playReleaseRuntimeClasspath` (`gradlew dependencies`): coordinates (`group:artifact`, versions not pinned)
   must be in `allowed-dependencies.txt`. This catches an analytics, ads or networking library appearing by accident.
4. R8 guard: if `app/build/outputs/mapping/playRelease/mapping.txt` exists the checker fails.

Exit codes: 0 pass, 1 violation, 2 usage/input error. `--mode report` prints without gating and is only for discovery.

## Self-test

`python3 -m unittest` in `release-boundary/` is a normal passing test suite. It passes by proving the checker
rejects known-bad synthetic fixtures (extra permission, unlisted service, exported-flag change, experimental/vpn/dns
classes including in secondary dex, unlisted dependency, R8 mapping, stale/unexpected baseline entries, wrong version
marker, malformed inputs) and accepts a known-good fixture. No CI job expects a failing outcome.

## Changing the lists

An addition to any allow-list, or a change to the baseline, is a boundary change: it needs an Owner-approved PR.

## R8 / minification (D-10: R8 stays off during W0)

While minification is off, class and package names are intact and the dex-descriptor deny-list is valid evidence.
**Once R8, minification or repackaging is enabled, class-name scanning alone is insufficient** (names are renamed or removed).
The later hardening gate must then verify experimental exclusion through variant/source-set evidence and/or the R8
mapping and artifact evidence, and the checker's R8 guard will fail until that gate is implemented.

## Known limits of the W0a checker

- It checks the `playRelease` artifact only (not `playDebug`, whose debug-only test manifests add noise).
- Dex scanning matches type descriptors; a reference to a denied class from allowed code is also flagged (intended).
- It does not by itself prove source-set separation (`src/internal` never feeding `play`); the artifact evidence does.
- AAB inspection (`bundletool`) is not part of W0a.

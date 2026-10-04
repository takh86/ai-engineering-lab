# W0a Foundation Gate Report

> **Gate result (Tech Lead / Owner): W0a implementation ACCEPTED, pending the closure round recorded here.**
> W0a merge: not authorized by this document. W0b: not authorized. F1–F16: not authorized.
>
> Evidence classes are kept apart on purpose:
> **[CI]** objective GitHub Actions evidence, **[AI]** AI-produced review or analysis (not proof),
> **[OWNER]** Owner / Tech Lead decisions. Nothing local was run except Python tests and a scratch JVM
> project for pure-Kotlin tests; the Android SDK is unavailable in the implementation sandbox.

## 1. Identity

| Item | Value |
|---|---|
| Branch | `ccr-e2ef6a06-p8z2wo` |
| Baseline commit (pre-W0a, merge-base with `main`) | `78e1942e26ae5e9924a6df6e6d77156b5d0ece29` |
| Verified W0a head before closure | `f20c44eb2eb666ec800ded9d23ba360f29d2ee90` |
| Closure commit | the commit that adds this file; its SHA is stated in the W0a PR |
| Scope | W0a Foundation only. No W0b, no feature (F1–F16), no browser-extension change. |

## 2. Commits (78e1942..f20c44e)

| SHA | Summary |
|---|---|
| `b67e042` | Foundation: flavors, `AppContainer`, D0 `SettingsStore`, release-boundary checker, package-boundary tests, new Android CI workflow |
| `0c78d76` | Allow-lists and baseline from the real CI discovery run; CI baseline-job fix; M1-equivalence probe; canonical M3-01 document with Amendment A; package-ownership and release-boundary docs |
| `cbb2dfd` | Fixes from the independent review and the red team |
| `f20c44e` | Allow-list for AndroidX native libraries found by the embedded-code check |

## 3. Change summary (78e1942..f20c44e: 26 files, +2279)

- **Modified (2):** `android/app/build.gradle.kts` (flavors `play`/`internal`, `internalRelease` disabled,
  `datastore-preferences:1.1.1`); `android/app/src/main/AndroidManifest.xml` (one line: `android:name=".app.TabsiraApplication"`).
- **Source (6):** `app/AppContainer.kt`, `app/TabsiraApplication.kt`, `core/data/{SettingsStore,DataStoreSettingsStore,AndroidSettingsStore}.kt`,
  `src/internal/res/values/strings.xml` (internal label only).
- **Tests (4):** `AppContainerTest`, `SettingsStoreTest`, `PackageBoundaryTest`, `BoundaryRules` (test-side rules).
- **Tooling (11):** `release-boundary/` (checker, its unit tests, `allowed-{permissions,components,dependencies,code-entries}.txt`,
  `denied-class-patterns.txt`, `w0a-known-historical.txt`), `ci/test_counts.py` and its tests.
- **CI (1):** `.github/workflows/project-04-android-ci.yml`.
- **Docs (3):** `docs/android/{m3-01-umbrella-contract,package-ownership,release-boundary}.md`.
- **Not touched in the implementation commits:** `chrome-extension/**`, `vpn/**`, `dns/**`, `domain/**`, `MainActivity.kt`,
  `strings.xml`, and the M1 workflow (the latter changed only in the closure round, section 9).

## 4. CI evidence [CI]

| Run | Head | Result |
|---|---|---|
| https://github.com/takh86/ai-engineering-lab/actions/runs/37195126015 | `b67e042` | Failed in 2 jobs, both implementation mistakes: the M1-equivalence job ran the old command (task ambiguity, section 6); the baseline job ran a script `main` does not have. |
| https://github.com/takh86/ai-engineering-lab/actions/runs/37195495588 | `0c78d76` | Green (5/5 jobs). |
| https://github.com/takh86/ai-engineering-lab/actions/runs/37196087625 | `cbb2dfd` | Failed only at the new embedded-code check, which was working as designed (found 8 native libraries). |
| https://github.com/takh86/ai-engineering-lab/actions/runs/37196529870 | `f20c44e` | **Green, 5/5 jobs** (self-tests and diff guard; build/test/lint/task graph/release boundary; baseline tests; M1-equivalence; existing-tests-preserved). |

## 5. Test counts [CI]

| | Classes | Tests |
|---|---|---|
| Baseline (pinned pre-W0a commit `78e1942`) | 14 | 196 |
| Final, `internal` flavor | 17 | 221 |
| Final, `play` flavor | 17 | 221 |

No failures or skips. Every baseline class and test-case name is still present with identical counts.
New: `AppContainerTest` 3, `SettingsStoreTest` 8, `PackageBoundaryTest` 14. Python tests (JVM-free): release-boundary 34, CI helper 6.

## 6. Actual Gradle task-resolution findings after flavors (Amendment A2) [CI]

| Old M1 task | Result |
|---|---|
| `assembleDebug` | Resolves: `assembleInternalDebug` + `assemblePlayDebug` + the aggregate. |
| `testDebugUnitTest` | **Ambiguous**: candidates `testInternalDebugUnitTest`, `testPlayDebugUnitTest`. |
| `lintDebug` | **Ambiguous**: 12 candidates, including `lintInternalDebug`, `lintPlayDebug`. |

- The debug APK is now `app/build/outputs/apk/internal/debug/app-internal-debug.apk`; `apk/debug/app-debug.apk` does not exist.
- `assembleRelease` expands to `playRelease` only; no `internalRelease` task exists (asserted in CI).
- The flavor-aware commands `clean assembleInternalDebug testInternalDebugUnitTest lintInternalDebug` ran green (run `f20c44e`, M1-equivalence job).

## 7. Release-boundary evidence [CI]

- The checker ran on the real `playRelease` artifact in enforce mode with the exact baseline (8 known historical violations) and passed:
  it detected the `vpn`/`dns` classes, the 5 historical permissions and the VPN service, with no unexpected or stale entries.
- Its self-test passes by rejecting known-bad synthetic fixtures; mutation checks showed those tests can fail.
- The artifact is stamped NON-RELEASABLE (`versionName` suffix `-nonreleasable-w0a`). CI uploads no `playRelease` binary.
- The embedded-code check found 8 native libraries (`libandroidx.graphics.path.so`, `libdatastore_shared_counter.so`, four ABIs each).

## 8. AI review (not proof) [AI]

**Independent review** (a separate read-only agent; no BLOCKER): (HIGH, design) the M1 workflow would go red;
(MEDIUM) the A5 rule skipped the whole `internal` source set; (MEDIUM) `core`/`feature` could import `app`; (LOW) scan roots and
vacuous play scan, IOException ended the collector, acceptance items 4/5/10 not CI-gated, duplicate push+PR runs, partly tautological tests.

**Foundation red team** (a separate read-only agent; no BLOCKER): (HIGH) diff guard blind to renames; (HIGH) nothing detects weakening of
the boundary itself; (HIGH) the checker keyed components only on tag/name/exported and ignored `android:permission`, intent filters,
`allowBackup`, `debuggable`, package and `uses-permission-sdk-m`; (MEDIUM) comment stripping evaded by `//` or `/*` inside strings,
backticks, spacing; scan-count and baseline-main time bombs; same-class test swap undetected; (LOW) dex scan blind to `.so`/`.jar`,
prefix-granular baseline, R8 path.

## 9. Fixes applied

- `cbb2dfd`: `--no-renames` diff guard and boundary-file warnings; checker hardening (permission tags, component key with guard and
  intent filters, hard checks for `allowBackup`/`debuggable`/cleartext/package, embedded-code entries, non-empty inputs, report mode refused on
  Actions); `BoundaryRules` tokenizer, strict `internal` exemption (A5), package-vs-path, wildcard import, all source sets; DataStore retry on
  transient `IOException`; baseline pinned to `78e1942`; test-case-name comparison; `internalRelease`/R8 assertions.
- `f20c44e`: explicit allow-list for the AndroidX native libraries.
- **Closure round:** the legacy M1 workflow is made flavor-aware (`clean assembleInternalDebug testInternalDebugUnitTest lintInternalDebug
  --no-daemon`; upload path `.../apk/internal/debug/app-internal-debug.apk`). The W0a diff guard no longer freezes that file wholesale;
  it allows only those four changed lines and fails on any other edit. Guards for `chrome-extension/**`, `vpn/**`, `dns/**`, `domain/**`,
  `MainActivity.kt` and `strings.xml` are unchanged. The M1 workflow is kept, not retired.

## 10. Accepted residual risks

1. No technical control stops a PR from weakening the release boundary (see R-W0a-2).
2. 16 KB page-size alignment of bundled native libraries is unverified (see R-W0a-1).
3. The W0a baseline is package-prefix granular; until W0b the diff guard covers new classes under `vpn.`/`dns.`.
4. The checker does not inspect `meta-data`, `uses-feature`, `uses-library` or `queries`.
5. R8 is off (D-10); class-name scanning is valid only while it stays off, and CI fails if minification is enabled.
6. The Android `preferencesDataStore` wiring is compile-only (no test); the DataStore multi-process native library ships unused.

## 11. Owner / Tech Lead decisions [OWNER]

- **W0a implementation: ACCEPTED**, pending the closure round. Merge, W0b and F1–F16 are not authorized. W0b architecture is acceptable in principle.
- **C1:** keep the M1 workflow, flavor-aware, internal flavor only (as implemented above); do not retire it yet.
- **R-W0a-1:** DataStore's currently bundled AndroidX native libraries are **accepted for Foundation**. This is not Play-release approval.
  M5 must verify native-library / 16 KB page-size compatibility before a Google Play production release.
- **R-W0a-2:** no CODEOWNERS change is required in W0a. Any change to `release-boundary/**`, the Android flavor configuration or
  `.github/workflows/**` requires explicit Tech Lead / Owner review. CODEOWNERS / branch protection may be reconsidered during M5 hardening.
- **R-W0a-3:** omitting `onboardingComplete` from the D0 `SettingsStore` is **accepted**. F1/F7 must define atomic, consistent completion
  persistence so the app cannot persist onboarding complete while required D1 onboarding state is lost (Amendment A4).

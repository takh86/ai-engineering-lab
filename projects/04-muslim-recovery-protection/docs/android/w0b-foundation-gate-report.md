# W0b Foundation Gate Report

> **Status: implementation, CI, independent review, red team and fix loop complete. Awaiting Tech Lead / Owner review.**
> Merge is not authorized by this document. F1–F16 are not authorized.
>
> Evidence classes are kept apart: **[CI]** objective GitHub Actions evidence, **[AI]** AI review (not proof), **[OWNER]** decisions.
> Nothing Android was built or run locally (no SDK in the implementation sandbox). Local runs were limited to Python tests and a
> scratch JVM project that compiled and ran the pure-Kotlin boundary/manifest/notification tests.

## 1. Identity

| Item | Value |
|---|---|
| Branch | `ccr-e2ef6a06-p8z2wo` (restarted from `main` after the W0a PR merged) |
| Baseline | `main` = `19df2c844dde78e8f37201d827f3e8dde5838172` (W0a merged) |
| Implementation head verified by CI | `8208eab` (docs-only commits follow; their CI is listed in the PR) |
| Scope | W0b Foundation isolation only. No F1–F16, no new dependency, no new permission, no protection behaviour. |

## 2. Commits (19df2c8..)

| SHA | Summary | CI [CI] |
|---|---|---|
| `1804035` C1 | `git mv MainActivity.kt -> ExperimentalHarnessActivity.kt` in place (class rename), the 2-line notification edit, W0b diff guard, baseline entry | green, run 37207551390 |
| `5add86f` C2 | Product shell `MainActivity` + `ProductShell`, flavor-specific `InternalToolsEntry`, harness no longer launcher / not exported | green, run 37207985785 |
| `78c6ec9` C3 | Moves to internal source sets, manifest split, zero-baseline Play boundary, tests, CI changes, docs | green, run 37208901396 |
| `8208eab` | Fixes from the independent review and red team | green, run 37209563148 |

C3 was squashed once: its first push (`3abadcc`, run 37208428168) built, tested and linted green but **failed the boundary-check step** because my
internal-inclusion check did not tolerate the two debug-only AndroidX activities (`ComponentActivity`, `PreviewActivity`). The fix was folded into C3 so
that every commit on the branch is green (Amendment A1). The Play half of that same step already passed on `3abadcc`: 0 denied classes, 0 findings.

## 3. Exact moves (pure `git mv`, package names unchanged) — see `historical-code-map.md`

25 files R100 + `LocalProtectionVpnService.kt` R099 (the approved 2-line edit):
- `src/main/.../vpn/*` (8) and `src/main/.../dns/*` (7) → `src/internal/.../vpn|dns/*`
- `src/test/.../vpn/*` (4) and `src/test/.../dns/*` (7) → `src/testInternal/.../vpn|dns/*`
- the harness: renamed in place in C1 (`MainActivity.kt` → `ExperimentalHarnessActivity.kt`, class name only), then moved to `src/internal` in C3.

## 4. Exact actual modifications

- `LocalProtectionVpnService.kt`: the import and `Intent(this, ExperimentalHarnessActivity::class.java)` (D-W0b-1). Nothing else.
- `MainActivity.kt`: new product shell (new content, not a relocation).
- `AndroidManifest.xml` (main): the five M1 permissions, the VPN service and the harness removed; one launcher (`MainActivity`).
- `src/internal/AndroidManifest.xml`: **new** — the five permissions, `ExperimentalHarnessActivity` (not exported, not a launcher), the VPN service.
- `app/build.gradle.kts`: `-nonreleasable-w0a` suffix and its comment removed. No dependency change.
- New code: `app/ProductShell.kt`, `InternalToolsEntry` (play: empty; internal: button), internal `strings.xml` entry.
- Deleted: `release-boundary/w0a-known-historical.txt`.
- New tooling/tests: `ci/w0b_diff_guard.py`, `release-boundary/check_internal_artifact.py`, `ManifestSplitTest`, `NotificationTargetSourceTest`,
  extended `PackageBoundaryTest`/`BoundaryRules`, three compile-only instrumentation tests, Python tests; workflow and docs updated.

## 5. Final source-set tree (product code)

```
src/main      MainActivity.kt  app/{AppContainer,ProductShell,TabsiraApplication}.kt  core/data/*  domain/{protection,rules}/*   AndroidManifest.xml (no permissions)
src/play      app/InternalToolsEntry.kt (empty composable)
src/internal  ExperimentalHarnessActivity.kt  app/InternalToolsEntry.kt  vpn/* (8)  dns/* (7)  AndroidManifest.xml  res/values/strings.xml
src/test          ScaffoldingSanity, AppContainer, SettingsStore, architecture/{BoundaryRules,ManifestSplit,PackageBoundary}, domain/*
src/testInternal  vpn/* (4 moved tests + NotificationTargetSourceTest)  dns/* (6 moved tests + DnsTestPackets)
src/androidTest{,Play,Internal}  ProductShellTest, PlayHasNoHistoricalExperimentTest, InternalHarnessAvailabilityTest (compiled in CI, not run: D-17)
```

## 6. Manifest differences by flavor

| | PLAY (`main` only) | INTERNAL (`main` + `internal`) |
|---|---|---|
| Permissions | none | FOREGROUND_SERVICE, FOREGROUND_SERVICE_SYSTEM_EXEMPTED, POST_NOTIFICATIONS, INTERNET, ACCESS_NETWORK_STATE |
| Launcher | `MainActivity` (shell) | `MainActivity` (shell) |
| Harness | absent | `ExperimentalHarnessActivity`, exported=false |
| VPN service | absent | `LocalProtectionVpnService`, guard `BIND_VPN_SERVICE`, `SUPPORTS_ALWAYS_ON=false` |
| applicationId | `com.muslimrecovery.protection` (unchanged) | `com.muslimrecovery.protection.internal` |

## 7. Dependency changes

None. (Navigation Compose was **not** added: the shell has one screen and needs no navigation; see deviations.)

## 8. Test counts [CI] (run 37209563148)

| | Classes | Tests |
|---|---|---|
| Baseline (pinned pre-W0a commit `78e1942`) | 14 | 196 |
| Final INTERNAL | 19 | 231 (all 14 baseline classes present, same case names, no failures/skips) |
| Final PLAY | 8 | 76 (baseline minus exactly the moved vpn/dns classes; CI also fails if a vpn/dns test class appears in play) |

## 9. Play artifact exclusion evidence [CI]

On the built `playRelease` **APK** and **AAB** (run 37209563148, step "Release-boundary check ... zero historical exceptions"): no `vpn.`/`dns.`/`experimental.`
classes, no `ExperimentalHarnessActivity`, no `android.net.VpnService`, no permission, no service, every component/dependency/native entry in the allow-lists,
no baseline file, no `nonreleasable` marker, `allowBackup=false`, package unchanged. Assertions also fail the build if a baseline file/flag/suffix returns,
if an `internalRelease` task exists, or if R8 is enabled. The AAB is scanned for dex classes only (its protobuf manifest is not decoded; manifest evidence is from the same variant's APK).

## 10. Internal artifact inclusion evidence [CI]

`check_internal_artifact.py` on `internalDebug` (same run, same step): the five permissions, the guarded VPN service (exact intent-filter), the non-exported
harness, the `.internal` applicationId and `-internal` versionName, the required classes (`LocalProtectionVpnService`, `DnsFilteringEngine`,
`ExperimentalHarnessActivity`), and **no exported component of any kind** beyond the shell, the service, the DUMP-guarded profileinstaller receiver and the two
debug-tooling activities. The moved historical tests run in `testInternalDebugUnitTest` (231 tests).

## 11. AI review (not proof) [AI]

**Independent review** (separate read-only agent; no BLOCKER/HIGH): MEDIUM — the contract referenced this report before it existed; LOW — wrong rename counts in
the code map, guard did not pin the harness or block new files under internal vpn/dns; INFO — AAB manifest not decoded, dormant baseline code path in the checker.

**Red team** (separate read-only agent; no BLOCKER): MEDIUM — the release-boundary warning step was dead after the guard rewrite; internal-artifact check only
inspected activities (alias/receiver/provider exports, VPN filter actions unchecked); MEDIUM-LOW — deny-list missed the Android VPN API; LOW-MEDIUM — component key ignored
intent-filter content; LOW — nested apk/zip payloads, service diff compared as a set, M1-guard masked failures, relative sub-package references, comment-blind notification
test, baseline could return under another name. The red team also noted the then-unexplained `3abadcc` failure (explained in section 2).

## 12. Fixes and regressions (commit `8208eab`) [CI: green]

Warning step repaired and failures no longer masked; every exported component kind checked in the internal artifact and the VPN filter pinned; component key carries a
normalized intent-filter signature; `android.net.VpnService` denied; nested apk/zip reported as embedded code; guard: ordered service diff, harness byte-pinned to the old
`MainActivity` (class name only), nothing new under internal vpn/dns, `domain/` frozen in every source set; assertions against any return of a baseline/marker;
relative sub-package detection and a comment-stripping notification test; exact rename counts. Each fix has a unit test; the checker/guard/rules tests were mutation-checked
during W0a and extended here (47 + 22 Python tests; 19 boundary + 3 manifest + 2 notification JVM tests).

## 13. Deviations from the proposed W0b plan

1. **No `ExperimentalFeatures` seam and no `AppNavHost`/Navigation Compose**: a same-FQN top-level `InternalToolsEntry` composable per flavor is the simplest compile-time wiring (Owner: "do not create a generic abstraction"); the single-screen shell needs no navigation, so no dependency was added.
2. **C2 merged the manifest split and the baseline/suffix removal into C3** so that no commit has a stale baseline or an unbuildable manifest (A1); the harness rename (C1) and the shell (C2) precede it.
3. **The W0b diff guard is stage-tolerant and content-based** (byte-identity of moves, pinned service/harness edits) instead of relying on git's rename-similarity heuristics.
4. Extra beyond the plan: AAB scan, internal-artifact inclusion check, deny of `android.net.VpnService`, intent-filter signatures in component keys, compile-only instrumentation tests.
5. `ProductShell`/shell tests are instrumentation tests that CI compiles but does not run (D-17); the JVM `ManifestSplitTest` and the CI artifact checks are the executed evidence.

## 14. Residual risks

1. The instrumentation tests (shell launch, internal harness reachable and not exported, play has no harness) are **not executed** until the emulator job exists (D-17).
2. `NotificationTargetSourceTest` checks the service source (comments stripped), not a real PendingIntent; the instrumentation test only checks that the component resolves.
3. Boundary rules are text-based: reflection built from concatenated strings is undetectable; `test*`/`androidTest*` source sets are not scanned; `src/play`/`src/release` manifests are covered by the built-artifact check, not by `ManifestSplitTest`.
4. The AAB's manifest is not decoded; `meta-data`, `uses-feature`, `queries` are not inspected; `android:process`/`enabled` are not part of the component key.
5. Stale statements remain outside this scope: `docs/architecture.md:59` and `docs/decisions.md:104` (historical M1 records) say the VPN code lives in `src/main`; the project `CLAUDE.md` and `AGENTS.md` still give `assembleDebug testDebugUnitTest` as the build command (ambiguous after flavors since W0a). **Owner decision:** update those instruction files and add a pointer to `historical-code-map.md`.
6. Release gates from W0a stay open (R8 hardening, native-library / 16 KB alignment, Play declarations). Play artifacts are **not authorized for upload**.

## 15. Closure after Tech Lead review (documentation and instructions only)

The Tech Lead accepted the W0b implementation (PASS) and held the PR merge for a bounded documentation/instruction closure:

- **Instruction files corrected:** the root `AGENTS.md` (structure, build and testing guidance) and the project `CLAUDE.md` now give explicit flavor-aware
  verification commands and state that `testDebugUnitTest` / `lintDebug` are ambiguous and must not be used as generic commands.
- **Architecture paths synchronized with W0b:** `docs/architecture.md` has a current-locations note and qualifies the stale M1 paths as historical.
- **Historical decisions preserved, not rewritten:** `docs/decisions.md` (D10, D11) only gained a one-line relocation note; the substance of D1–D15 is unchanged.
- **No product-code change in this closure:** no Android production or test logic, manifest, dependency, workflow or browser-extension change. This resolves
  the "stale instruction files" decision in section 14, item 5.

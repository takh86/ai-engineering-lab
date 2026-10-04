# M3-01 — Android umbrella implementation contract (canonical)

> **Status: APPROVED by the Tech Lead / Owner (2026-10-04), v2 plus the binding Execution Amendment
> at the end of this document.** Where the amendment conflicts with v2 wording, **the amendment wins**.
>
> Scope of approval: this contract freezes the Android foundation, package boundaries, feature map,
> build/release isolation strategy, ownership rules, lifecycle, verification, security/privacy return
> points and integration process. **It does not authorize implementation of any feature.** Every
> feature needs its own Feature Contract and Tech Lead / Owner gate first.
>
> Only **W0a** is authorized now. W0b, F1–F16, merge to main, release/upload and any new sensitive
> permission are **not** authorized.
>
> The browser extension (`chrome-extension/**`) is frozen and out of scope. It is never modified.
> F9 may read its brand assets read-only. No extension logic is copied into Android.

Labels: **[F]** fact, **[A]** assumption, **[R]** recommendation, **[OD]** Owner decision.

## 1. Product / MVP objective

**L0 Recovery Core** is useful on its own and depends on no protection layer, sensitive permission or
network (H12). Protection layers (L1, L2, L2b) join only through their own gates, with separate truthful
statuses and no combined "Protected" (D8, AB4). Market: Germany, DE and AR (OD11). No telemetry exists.

**Included in L0/MVP:** F1 Onboarding, F2 Home, F3 Help Now, F4 Recovery, F5 My Plan, F6 Notes,
F7 Security, F8 Faith Mode (optional), F9 Design / Localization, F14 Trusted Person.

**Not required to complete L0 (gates unchanged):** F10 App Blocking (#61 contract), F11 Screen/Web Guard
(H9 amendment + bounded contract), F12 Website/Keyword Guard (architecture contract), F13 DNS (final L2
decision), F15 Prayer (post-MVP optional), F16 API (experimental, needs an API contract).

## 2. Foundation architecture and packages

- One `:app` Gradle module. Feature boundaries are packages.
- `feature → core`. `core` never imports a feature. Features never import each other's business code.
- Manual DI (`AppContainer`, constructor injection). No Hilt unless concrete evidence shows manual DI is inadequate.
- `app/` is the composition root and may import everything allowed by the rules in §17 and Amendment A5.
- Historical `vpn/**`, `dns/**`, `domain/**` are not moved, renamed, deleted or rewritten during Foundation work.

```
com.muslimrecovery.protection
  app/            composition root
  core/{data,security,design,navigation,model}
  feature/{onboarding,home,helpnow,recovery,plan,notes,faith,settings,trustedperson,prayer}
  protection/appblocking
  experimental/{webguard,dns,api}   # exists only in src/internal
  vpn/ dns/ domain/                 # historical
```

Ownership is recorded in `package-ownership.md`; packages are created by their owning agents.

## 3. Wave 0

### W0a (authorized) — additive, no moves

Scope: composition root, manual `AppContainer`, D0 `SettingsStore`, internal/play build isolation,
release-boundary tooling, CI, package-ownership documentation.

Acceptance criteria (proven by CI; run URL and head SHA recorded in the W0a Foundation Gate Report):

1. Both flavors build, unit-test and lint in CI.
2. Existing tests are preserved: the same test classes and counts as the baseline CI run on `main`, none skipped or weakened.
3. Frozen/historical paths are unchanged (`chrome-extension/**`, `vpn/**`, `dns/**`, `domain/**`, `MainActivity.kt`).
4. The play `applicationId` is unchanged; internal is the base id plus `.internal`; no `internalRelease` variant exists.
5. The manifest diff adds only the Application name: no permissions, no components.
6. `PackageBoundaryTest` encodes the dependency rules (Amendment A5).
7. The release-boundary checker is exercised: its self-test passes by rejecting known-bad fixtures and accepting a known-good one; on the real play artifact it runs with the exact known-historical baseline and stamps the output NON-RELEASABLE.
8. `AppContainer` tests: lazy construction, singleton, fake injection.
9. `SettingsStore` verification: round trip, missing/default behavior, defined corruption behavior, no D1 persistence (Amendment A3).
10. The dependency change is exactly DataStore. No analytics or networking library.
11. No D1 data is persisted anywhere.
12. No `playRelease` binary is uploaded or tagged as a release candidate (Amendment W0a-NR).

### W0b (NOT authorized yet) — isolation of the historical experiment

Pure `git mv` of the historical `vpn/**` and `dns/**` main and test sources into the internal source sets,
package names unchanged; the harness `MainActivity` content is extracted into `ExperimentalHarnessActivity`
(an actual code modification, recorded as its own integration change with its own diff and tests, not a
relocation); the VPN service/permissions move into the internal manifest; the play flavor then carries no
experimental code and the checker runs without a baseline. **Every reviewed W0b commit must build** (Amendment A1).
Exact W0b proposal is produced from the implemented W0a tree and needs separate approval.

## 4. Build-variant isolation

One flavor dimension `distribution`: `play` and `internal`. Compile-time absence is the isolation; runtime
flags are never the boundary. `internalRelease` is disabled. Only `playRelease` artifacts may ever be uploaded.
Until W0b the play flavor is **NON-RELEASABLE** (versionName suffix `-nonreleasable-w0a`).

## 5. Dependencies

W0a: `androidx.datastore:datastore-preferences` only. W0b: `androidx.navigation:navigation-compose` only.
Room, AndroidX Biometric and others wait for their owning Feature Contract. No Hilt, no Robolectric, no
analytics/ads/crash/networking library on the play classpath. Encryption uses platform/established
primitives only; no custom algorithm; the F7 Feature Contract freezes the exact approach.

## 6. Data handling classification (policy, not a runtime enum)

- **D0 — public / non-sensitive local:** theme, UI language.
- **D1 — private persisted:** reasons, plans, notes, Faith preference, trusted-person data, selected apps (and onboarding completion, see A4).
- **D2 — sensitive ephemeral:** future locally inspected screen/app context when explicitly authorized; never persisted, logged, exported or uploaded.
- **D3 — prohibited:** browsing-history database, retained raw screenshots, raw screen-content history, third-party surveillance, hidden analytics of sensitive activity.

D0 uses DataStore. D1 is persisted only through the F7-approved secure mechanism. F6 Wave 1 never persists notes unencrypted. `allowBackup=false` stays.

## 7. Navigation, 8. AppContainer

Navigation Compose with a single root `NavHost` owned by Integration (introduced in W0b). Help Now is never inside an authentication gate.
`AppContainer` is a manual composition root holding lazy singletons; features receive narrow interfaces, never the container.

## 9. Feature inventory, 10. Dependency graph, 11. Waves

`W0a → W0b → F9 tokens → {F1, F3, F5, F8, F6-interfaces}`; `F5 → F4`; `{F1, F3} → F2`; `F7 → all D1 persistence`.
W1: F9 tokens first, then F1, F3, F5, F8, F6 (interfaces) — max 3 concurrent implementation agents. W2: F7, then F2, F4, F14.
Then the L0 integration gate. Protection (individually gated, no gate bypassed): F11 → F10 → F12 → F13. F15 post-MVP. F16 experimental.

## 12. Feature Contract template, 13. Lifecycle

Every feature: Feature Contract (problem, scope, non-goals, constraining decisions, architecture, data owned with D-class, dependencies,
permissions, security/privacy, failure states, acceptance, automated and device tests, integration requests, content status, trade-offs,
open decisions; each item tagged F/OD/A/R/Q) → Tech Lead review → Owner approval → Implementation Agent → CI verification →
Independent Reviewer → Red Team (Extended for F6, F7, F10–F13, F16) → fix loop → regression CI → Tech Lead Feature Gate →
Owner ACCEPT/CHANGE/REJECT → Integration. Implementation, review and red team are different agents.
After integration: Independent Verification, System Red Team, regression, Tech Lead system review, Owner approval.

## 14. Testing, 15. CI

JVM tests first; existing Android/Compose instrumentation dependencies; no Robolectric; emulator execution is introduced with the
first integrated UI acceptance criteria that need it. L0 device matrix: CI emulator plus the Owner's Samsung device.
GitHub CI is the only objective build gate; local verification is never claimed. Every gate report cites CI run URL, head SHA and test counts.
The M1 workflow stays untouched until the new workflow shows equivalent green evidence and the Tech Lead approves retirement.

## 16. Privacy / security boundaries

Local only; no account, backend, analytics or telemetry; no third-party reporting; no Device Owner/Admin, root, Settings blocking or
AccessibilityService without a separate decision; no sensitive logging; Help Now exposes no stored private data while locked;
any new sensitive permission, data flow or API needs another Owner gate; Help Now, Recovery and My Plan keep working if API,
security or any protection layer fails.

## 17. Release-build experimental-exclusion rules

See `release-boundary.md`. The checker reads the final play artifact: manifest allow-lists, class deny-list, dependency allow-list,
R8 guard. Documented limit: class-name scanning is valid only while R8/minification/repackaging is off (D-10 defers R8); once enabled the
hardening gate must verify exclusion through variant/source-set evidence and/or R8 mapping or artifact evidence.

## 18. Shared-file ownership

Integration Agent only: `MainActivity.kt`, manifests, `app/build.gradle.kts`, root navigation, `AppContainer`/application wiring, build
variants, database/bootstrap wiring, `release-boundary/**`, `.github/workflows/**`, `proguard-rules.pro`, `res/xml`. Feature agents edit only
their own package, their own `strings_<feature>.xml` (`values/`, `values-ar/`, `values-de/`) and their own tests; anything else is an
INTEGRATION REQUEST (file, change, reason, dependency). `core/model`, `core/navigation`, `core/data`: Foundation then Integration.

## 19. Owner decisions recorded

D-1 APPROVED: Help Now stays accessible without biometric authentication and exposes no private stored content while locked.
D-2 APPROVED: isolate the historical VPN/DNS implementation into the internal source set during W0b, preserving history and package names.
D-3 APPROVED: `app/` is the composition root. D-4 APPROVED: internal `applicationIdSuffix=".internal"`; base id unchanged.
D-5 APPROVED: English fallback plus complete Arabic and German; missing required translations are a release error.
D-6 APPROVED: the Recovery/Faith preference is D1. D-7 CHANGED: no Robolectric in W0; emulator coverage when integrated UI requires it.
D-8 APPROVED WITH LIMIT: W0 may add Navigation Compose and DataStore only. D-9 APPROVED WITH MIGRATION: new CI workflow; M1 workflow not retired until equivalence is demonstrated.
D-10 DEFERRED: R8 off during W0. D-11 DEFERRED: final production `applicationId` is decided before first Play publication.
D-12 APPROVED: minSdk 24. D-13 APPROVED: max 3 concurrent implementation agents. D-14 APPROVED: CI emulator + Owner Samsung for L0.
D-15 DEFERRED: reviewed-content storage and named clinical/religious reviewers are defined in the F3/F8 contracts and remain release gates.
D-16 APPROVED: L0/MVP = F1–F9 + F14. D-17 APPROVED: no emulator job in W0 solely for the shell.
D-W0b-1 APPROVED: the internal VPN notification may target `ExperimentalHarnessActivity`. D-W0b-2 APPROVED WITH A1. D-W0b-3 APPROVED: keep "Recovery Protection" temporarily.

---

# Execution Amendment A (binding over any conflicting wording above)

Recorded 2026-10-04 from the Tech Lead's FINAL M3-01 RECORD.

## A1 — Buildable W0b history
No intentionally broken intermediate commit is permitted. The v2 statement that a relocation commit may be non-buildable is superseded.
Reorder or combine W0b commits so every reviewed commit preserves the required build/CI invariant. R100 rename history is desirable but
secondary to bisectability and build integrity.

## A2 — M1 workflow migration
Do not assume the old Gradle tasks keep their names/semantics after flavors. After W0a introduces flavors, inspect the actual Gradle task
graph in CI and verify the real availability/semantics of `assembleDebug`, `testDebugUnitTest`, `lintDebug` before changing the old M1
workflow. Do not modify that workflow from the current assumption. Do not retire it until the new Android workflow demonstrates
equivalent green build/test/lint evidence and the Tech Lead later approves retirement.

## A3 — SettingsStore verification
Objective verification of: round trip, missing/default behavior, defined corruption behavior, no D1 persistence. Prefer JVM tests when the
implementation supports them cleanly; use instrumentation where Android runtime behavior is required; do not add Robolectric solely to force
tests into the JVM suite.

## A4 — D1 feature completion
For any feature containing required D1 state distinguish: (1) DOMAIN/UI IMPLEMENTATION COMPLETE, (2) SECURE PERSISTENCE INTEGRATED,
(3) FEATURE RELEASE-COMPLETE. F1, F5, F6 and F8 cannot reach state 3 until their required D1 state is integrated through the F7-approved
secure persistence mechanism. Do not persist partial contradictory state (e.g. `onboardingComplete=true` while the Recovery/Faith
preference disappears after process death).

## A5 — Experimental import rule
`src/main` `app/**` MUST NOT import `experimental/**`. `src/play/**` MUST NOT import `experimental/**`. `core/**` and `feature/**` MUST NEVER
import `experimental/**`. Explicitly approved composition wiring under `src/internal` may import experimental implementations.
Package-boundary verification must encode this distinction.

## W0b decisions and final status
D-W0b-1 APPROVED, D-W0b-2 APPROVED WITH A1, D-W0b-3 APPROVED, D-17 APPROVED (see §19).
**M3-01 = APPROVED. AUTHORIZED NOW: W0a FOUNDATION ONLY.** NOT AUTHORIZED: W0b automatic execution, F1–F16 implementation, merge to main,
release/upload, new sensitive permissions.
W0a lifecycle: Implementation → CI → Independent Review → Foundation Red Team → Fix Loop → Regression CI → Tech Lead Gate → Owner Review,
ending in a W0a FOUNDATION GATE REPORT. Do not merge.

## W0a closure decisions (2026-10-04)

- W0a implementation accepted pending closure; see `w0a-foundation-gate-report.md`. W0a merge, W0b and F1–F16 are not authorized.
- The legacy M1 workflow is kept and made flavor-aware (internal flavor only); it is not retired.
- R-W0a-1: bundled AndroidX native libraries accepted for Foundation only; M5 verifies native-library / 16 KB page-size compatibility before Play production release.
- R-W0a-2: no CODEOWNERS change in W0a; changes to `release-boundary/**`, flavor configuration and `.github/workflows/**` need explicit Tech Lead / Owner review; reconsider CODEOWNERS / branch protection in M5.
- R-W0a-3: `onboardingComplete` omitted from the D0 `SettingsStore` is accepted; F1/F7 define atomic completion persistence with the required D1 onboarding state.

## W0b status (2026-10-04)

W0b (Foundation isolation) executed under the Owner's authorization after W0a was merged (`main` = `19df2c8`): the historical M1
DNS/VPN experiment lives only in the internal source sets, the play flavor is structurally free of it, and the W0a non-releasable
baseline is removed. Details: `historical-code-map.md`, `release-boundary.md`, `w0b-foundation-gate-report.md`. Deviations from the
proposed W0b plan are recorded in the gate report. F1–F16 remain unauthorized.

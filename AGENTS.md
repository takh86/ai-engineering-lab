# Repository Guidelines

## Project Structure & Module Organization

This repository is a portfolio of independent projects. Root files (`README.md`, `PROJECTS.md`, `CONTRIBUTING.md`) explain the lab; `docs/` holds shared workflow and quality guidance, `templates/` holds reusable document outlines, and `assets/` holds branding. The active implementation is `projects/04-muslim-recovery-protection/`: its `docs/` records the problem, requirements, architecture, and decisions. Android code is split by source set under `android/app/src/`: shared product code and resources in `main/` (shared unit tests in `test/`); the Play-only entry point in `play/`; and, **internal flavor only**, the preserved historical M1 DNS/VPN experiment (`vpn/`, `dns/`, `ExperimentalHarnessActivity`) with its manifest in `internal/` and its unit tests in `testInternal/`. Instrumentation tests are in `androidTest/`, `androidTestPlay/` and `androidTestInternal/`. Release-boundary tooling is in `android/release-boundary/` and CI helpers in `android/ci/`. Follow a project's own README when its layout differs from the generic lab template.

## Build, Test, and Development Commands

The Android app has two product flavors (since M3-01 W0): **`internal`** is the historical/experimental engineering build (it contains the M1 DNS/VPN experiment; its application id ends in `.internal`) and **`play`** is the product build. There is no `internalRelease` variant, and uploading `playRelease` anywhere still requires explicit Owner approval.

Because of the flavors, the generic task names `testDebugUnitTest` and `lintDebug` are **ambiguous** and fail; always name the variant. From `projects/04-muslim-recovery-protection/android/`, the full development verification command is:

```powershell
.\gradlew clean assembleInternalDebug assemblePlayDebug testInternalDebugUnitTest testPlayDebugUnitTest lintInternalDebug lintPlayDebug --no-daemon
```

Per flavor: `assemble<Internal|Play>Debug`, `test<Internal|Play>DebugUnitTest`, `lint<Internal|Play>Debug`; the Play release build used by the boundary checks is `assemblePlayRelease`. These build the APKs, run local JUnit tests (the `internal` run also includes the moved historical vpn/dns tests) and run Android lint. GitHub CI (`Project 04 Android CI`, plus the historical `Project 04 M1-07 Verification Gate` for the internal flavor) is the objective gate. No repository-wide build command exists.

## Coding Style & Naming Conventions

Use four-space indentation in Kotlin and Gradle Kotlin DSL. Keep Kotlin types in `PascalCase`, functions and properties in `camelCase`, and packages lowercase (for example, `com.muslimrecovery.protection.domain.rules`). Keep domain logic in its matching `domain/` package and Android resources in `res/`. Match existing Markdown headings and keep decisions and requirements in the project's `docs/`. No dedicated Kotlin formatter or third-party lint configuration is present; use the existing style and Android lint.

## Testing Guidelines

Use JUnit 4 for local unit tests. Name test classes after the subject with a `Test` suffix (for example, `RuleSetTest.kt`), place them in the matching package under `src/test/` (or `src/testInternal/` for the internal-only historical vpn/dns code), and use descriptive behavior names for test methods. Cover normal decisions, malformed input, and privacy-sensitive error paths. Run `testInternalDebugUnitTest` and `testPlayDebugUnitTest` for code changes; apply the relevant checks in `docs/QUALITY_GATES.md`. No numeric coverage target is defined.

## Commit & Pull Request Guidelines

Recent commits commonly use `docs:`, `chore:`, `feat(04):`, or `fix(04):` followed by a concise action; follow that pattern. Keep changes scoped to the current task. Use `.github/PULL_REQUEST_TEMPLATE.md`: state the goal, changes, acceptance criteria, verification, AI contribution, human review focus, and risks or limitations. Link the relevant issue when one exists, and include screenshots for visible UI changes. Do not claim a check passed unless you ran it.

## Security & Agent Workflow

Do not commit credentials or personal data; see `SECURITY.md`. Before implementation, read the relevant project docs and current task scope. Treat AI output as untrusted until verified, and seek human review for major architecture, security, privacy, or dependency decisions.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A public portfolio of small, independent engineering projects, each demonstrating both hand-written software engineering fundamentals and AI-directed engineering under human ownership. AI output here is treated as **untrusted until verified** — this is not a vibe-coding repo. Every project records what was decided by the human, what was delegated to AI, and how AI output was verified.

The repo root has no shared build/lint/test tooling of its own — each `projects/NN-*/` directory is a self-contained project with its own stack, its own build system, and its own docs. There is currently one active project: `projects/04-muslim-recovery-protection/`.

## Working inside a project

Before writing code in any project, read that project's `docs/` folder (`problem.md`, `requirements.md`, `architecture.md`, `decisions.md`) — architectural and scope decisions are recorded there, not in this file, and change per milestone. Do not assume a later milestone's scope is authorized; check `decisions.md` for what's explicitly approved vs. explicitly out of scope.

### Engineering workflow (applies to all projects)

The lab's process, in order: problem → human understanding → requirements + acceptance criteria → architecture/plan → AI task assignment (bounded, not "build the whole thing") → implementation → automated verification → independent review → human approval → ship/measure/retrospective. Full detail in `docs/WORKFLOW.md`.

Quality gates before considering work complete (see `docs/QUALITY_GATES.md` for the full checklist, which varies by project type — backend/API, production-oriented, AI-powered): type check passes, lint passes, unit tests pass, critical error paths are tested, no secrets committed, human review completed. Never declare a task done from visual inspection alone.

### Decision records

Non-trivial architecture or scope decisions in a project are recorded in that project's `docs/decisions.md`, following `templates/DECISION_RECORD_TEMPLATE.md`. When you make or are asked to make an architectural choice, deviation from the lab's default template, or scope call, add a decision record rather than only writing code — this repo's whole premise is a traceable paper trail of what was decided and why. Deviations from the generic lab layout (see below) must be justified there, as project 04 does (`D4`, `D6`, `D7`).

### Generic lab template vs. actual layout

The lab's nominal per-project template is `README.md`, `src/`, `tests/`, `docs/{problem,requirements,architecture,ai-workflow,decisions,testing-strategy,postmortem}.md`, `.github/workflows/`. Individual projects may deviate (e.g. project 04 uses `android/` instead of `src/` because it's a mobile app, and keeps CI at the repo root because GitHub Actions ignores non-root `.github/workflows/`) — check each project's own `docs/decisions.md` before assuming the generic layout applies.

## Project 04 — Muslim Recovery Protection (current active project)

`projects/04-muslim-recovery-protection/` — a privacy-first, local-first Android app (no backend yet). Kotlin 2.1.20, Jetpack Compose, AGP 8.11.2, Gradle 8.13, minSdk 24, compileSdk/targetSdk 36 (Android 16 — never regress to API 35, see `decisions.md` D2).

### Build and test

Run from `projects/04-muslim-recovery-protection/android/`:

```bash
./gradlew assembleDebug          # build debug APK
./gradlew testDebugUnitTest      # run JVM unit tests
./gradlew test --tests "*.RuleSetTest"   # run a single test class
./gradlew clean assembleDebug testDebugUnitTest   # full clean verify, as used for milestone sign-off
```

On Windows use `gradlew.bat`. There is no root-level CI yet for this project (per `decisions.md` D7); when added it will live at the repo root with path filters scoped to `projects/04-muslim-recovery-protection/**`, not in a project-local `.github/workflows/`.

### Architecture

Pure-Kotlin domain logic lives under `android/app/src/main/java/com/muslimrecovery/protection/domain/` with **no Android framework dependency**, so it's tested as plain JVM unit tests (`android/app/src/test/...`). Two domain areas exist so far:

- `domain/protection/` — `ProtectionSignals` (verifiable runtime facts: VPN permission, service lifecycle, tunnel established, filtering operational, fatal error — deliberately has no saved user-intent field) → `ProtectionStateEvaluator` (pure function) → `ProtectionState` (`PermissionRequired`, `Starting`, `Protected`, `Degraded`, `Stopped`, `Error`). **`Protected` must only ever be produced by the evaluator from real runtime signals — never set directly from a saved preference/toggle** (decision D8). User intent/setup progress is intentionally a separate concern, not merged into this model.
- `domain/rules/` — a block-rules-only DNS matching engine: `NormalizedHostname` (strict validation — malformed input, including any leading/trailing whitespace, is rejected, never trimmed into validity) → `DomainRule` (matches by DNS label suffix/boundary, never substring) → `RuleSet` (defensively-copied, immutable, pure `evaluate(hostname): RuleDecision`) → `RuleDecision` (`Allowed` / `Blocked(matchedRule)` / `InvalidInput(reason)`, where `InvalidReason` is a typed enum that never carries the raw submitted hostname). Malformed input must produce `InvalidInput`, never fail open as `Allowed` (decision D9).

Neither domain package knows about `VpnService`, DNS packets, or networking — that integration (`DNS/VPN runtime → Rules Engine → Protection runtime integration`) is deferred to a future milestone. When extending these packages, preserve the "framework-free, pure-function, no fail-open" properties above; they're load-bearing project decisions, not incidental style.

### Explicit non-goals (do not implement without a new decision record + explicit human approval)

No VPN service/blocking runtime, no backend, no AI/ML components, no analytics/telemetry, no payments, no accountability/reporting-to-others features, no Islamic content library, no privilege escalation (root, Device Owner, AccessibilityService), no `QUERY_ALL_PACKAGES`, no allow-rules/wildcards/regex in the rules engine, no packet-level inspection or TLS interception/MITM. All testing must use synthetic/controlled test domains only — real pornographic content is never browsed, bundled, or referenced (decision D3).

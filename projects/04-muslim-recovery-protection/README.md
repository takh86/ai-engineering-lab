# 04 — Muslim Recovery Protection

> A privacy-first self-protection and recovery application for consenting adult Muslims who voluntarily want to avoid pornographic content.

## Status

**M1-01 — Project Scaffolding.** No protection functionality exists yet. This milestone only establishes the repository layout and an empty, buildable Android app shell.

## Why this project exists

See [`docs/problem.md`](docs/problem.md).

## Tech stack (current)

- Android: Kotlin, Jetpack Compose
- minSdk 24, compileSdk/targetSdk 35 (see [`docs/decisions.md`](docs/decisions.md) for the API-level rationale)
- No backend for M1 (local-first)

## Repository layout

```text
projects/04-muslim-recovery-protection/
  android/     # Kotlin/Jetpack Compose app
  backend/     # not created for M1; added only if a later requirement demonstrably needs it
  docs/
    problem.md
    requirements.md
    architecture.md
    decisions.md
```

This deviates from the generic Lab template (`src/`, `tests/`, `.github/workflows/` at project root). See [`docs/decisions.md`](docs/decisions.md) for why.

## My role

- Problem framing, scope gating per milestone, architecture approval, final review.

## AI role

- Scaffolding implementation under the constraints specified for M1-01.

## Verification

| Gate | Result |
|---|---|
| Android build (`assembleDebug`) | See PR description |
| Unit tests | See PR description |

## Milestones

- **M1-01 (this PR):** project scaffolding only.
- **M1 (in progress):** prove/disprove DNS-based VPN filtering against controlled test domains only. See [`docs/requirements.md`](docs/requirements.md).

## Limitations / next steps

No VPN service, blocking logic, rules engine, backend, AI, analytics, payments, accountability features, Islamic content library, Device Owner, AccessibilityService, or `QUERY_ALL_PACKAGES` usage exists yet. These are explicitly out of scope for M1-01 and require separate, reviewed milestones.

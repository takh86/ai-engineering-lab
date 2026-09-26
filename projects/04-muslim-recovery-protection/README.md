# 04 — Muslim Recovery Protection

> A privacy-first self-protection and recovery application for consenting adult Muslims who voluntarily want to avoid pornographic content.

## Status

Snapshot: 2026-09-26. GitHub milestones and issues are the live tracker; [`docs/roadmap.md`](docs/roadmap.md) §2 records the same state in more detail.

- **M1 — DNS Feasibility & Coverage Evidence: CLOSED.** The app contains an experimental, DNS-only split-tunnel VPN (M1-05, D11). It intercepts standard plaintext DNS, blocks one controlled harmless test domain (`example.com` and its subdomains) and forwards everything else. M1-06 characterized its coverage and bypasses on a physical Samsung device (human-reported). The M-1 fix (PR #32, D12) makes the experiment stop truthfully when its underlying network becomes unusable or is superseded; there is **no automatic network handover**, so the user restarts it manually. Evidence, evidence classes (CI vs. human-reported device results) and the retained historical build-provenance limitation: [`docs/m1-07-evidence-synthesis.md`](docs/m1-07-evidence-synthesis.md).
- **M2 — Architecture & Truthful Product Claim: ACTIVE.** M2-01 ([threat model](docs/m2-01-approved-threat-model.md), PR #33) and M2-02 ([architecture baseline](docs/m2-02-architecture-options.md), PR #34) are complete. M2-03 is pending human-gate and verification work: #39 (M2-03A human gate / G0) → #40 (M2-03B A8 verification V0–V13) → #41 (M2-03C T2 friction validation) → #42 (M2-03D evidence synthesis + final ADR); see [`docs/m2-03-architecture-adr.md`](docs/m2-03-architecture-adr.md). G0 decisions are not recorded and no A8 verification has run. A8 is a **verification candidate only**; no production architecture is selected.
- **M3 onward: BLOCKED** until the Tech Lead records the final M2 ADR (#42).

The Owner also approved a **bounded, voluntary app-blocking direction** after the DNS baseline:
selected-app interruption and private recovery help. The mechanism, permission choice and coverage
claim still require a [separate device and Play-policy gate](docs/app-blocking-architecture-decision.md).
No app blocker exists in the current Android build; this decision does not approve A8 for production.

`ProtectionState.Protected` remains unreachable at runtime by construction: `filteringOperational` is hardcoded `false` (D8, D11). Nothing in the app is verified protection.

## Why this project exists

See [`docs/problem.md`](docs/problem.md).

## Tech stack (current)

- Android: Kotlin 2.1.20, Jetpack Compose, AGP 8.11.2, Gradle 8.13
- minSdk 24, compileSdk/targetSdk 36 (Android 16) — the approved project requirement (see [`docs/decisions.md`](docs/decisions.md) D2; API 35 was used briefly during initial local scaffolding and was corrected before merge, not an accepted target)
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

- Problem framing, scope gating per milestone, architecture approval, physical-device testing, final review.

## AI role

- Scaffolding implementation under the constraints specified for M1-01; domain model and rules engine implementation for M1-02/M1-03; VPN lifecycle foundation implementation for M1-04; the M1-05 DNS experiment and the M-1 fix; research, review and drafting of the M1/M2 evidence and decision documents — all under an explicit, human-authorized task contract per task. AI records decisions; it does not make them.

## Verification

| Gate | Where the evidence is |
|---|---|
| Android build, unit tests and lint (`./gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon`) | GitHub Actions ([workflow](../../.github/workflows/project-04-m1-07-verification.yml)) on every PR that changes this project; see each PR's checks |
| Physical-device (Samsung) tests | Run by the Tech Lead and recorded as **HUMAN-REPORTED**: [M1-06 results](docs/m1-06-execution-results.md); M-1 close-out in [M1-07](docs/m1-07-evidence-synthesis.md) §5 |

## Milestones

- **M1 (closed 2026-09-26):** prove/disprove DNS-based VPN filtering against controlled test domains only. See [`docs/requirements.md`](docs/requirements.md).
  - **M1-01:** project scaffolding only.
  - **M1-02:** truthful protection-state domain model (`domain/protection/`).
  - **M1-03:** deterministic, block-rules-only domain matching engine (`domain/rules/`).
  - **M1-04:** Android VPN lifecycle foundation (`vpn/`) — consent, start/stop/revoke, minimal TUN establishment. No filtering.
  - **M1-05:** standard-DNS-only filtering experiment (`dns/`, `vpn/`; D11).
  - **M1-06:** DNS coverage and bypass validation on a physical Samsung device (human-reported; [runbook](docs/m1-06-coverage-gate.md), [results](docs/m1-06-execution-results.md)).
  - **M1-07:** evidence synthesis and M1 gate close, including the M-1 stale-underlying-network fix (PR #32, D12; [report](docs/m1-07-evidence-synthesis.md)).
- **M2 (active):** threat model, truthful product claim and architecture decision. See Status above and [`docs/roadmap.md`](docs/roadmap.md).
- **M3–M6 (conditional):** not authorized. M3 is blocked until the final M2 ADR.

## Limitations / next steps

The only filtering code is the M1 standard-DNS experiment, and it is not a protection claim. Its known limits include: browser encrypted DNS (DoH / Secure DNS) bypassed it in M1-06 (human-reported); it refuses to run, rather than downgrade, while Private DNS is active; it handles plaintext IPv4/UDP DNS only (no TCP DNS, IPv6 DNS transport or CNAME filtering); it has no Always-on or reboot support; and it has no automatic network handover — when the underlying network changes or becomes unusable it stops truthfully and must be restarted manually. See [`docs/m1-07-evidence-synthesis.md`](docs/m1-07-evidence-synthesis.md) §8.

No general packet inspection, TLS interception, backend, AI, analytics, payments, accountability features, Islamic content library, Device Owner, AccessibilityService, or `QUERY_ALL_PACKAGES` usage exists. Each of these, and any production protection architecture, needs a separate human-approved decision. The next step is the M2-03 human gate and verification (#39 → #42).

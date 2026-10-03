# 04 — Muslim Recovery Protection

> A private, recovery-first companion for consenting adult Muslims who voluntarily want to stop or reduce pornography use, with optional protection layers whose limits are stated truthfully.

## Status

Snapshot: 2026-09-27. GitHub milestones and issues are the live tracker; [`docs/roadmap.md`](docs/roadmap.md) §2 records the same state in more detail.

- **M1 — DNS Feasibility & Coverage Evidence: CLOSED.** The app contains an experimental, DNS-only split-tunnel VPN (M1-05, D11). It intercepts standard plaintext DNS, blocks one controlled harmless test domain (`example.com` and its subdomains) and forwards everything else. M1-06 characterized its coverage and bypasses on a physical Samsung device (human-reported). The M-1 fix (PR #32, D12) makes the experiment stop truthfully when its underlying network becomes unusable or is superseded; there is **no automatic network handover**, so the user restarts it manually. Evidence, evidence classes (CI vs. human-reported device results) and the retained historical build-provenance limitation: [`docs/m1-07-evidence-synthesis.md`](docs/m1-07-evidence-synthesis.md).
- **M2 — Architecture & Truthful Product Claim: ACTIVE.** M2-01 ([threat model](docs/m2-01-approved-threat-model.md), PR #33) and M2-02 ([architecture baseline](docs/m2-02-architecture-options.md), PR #34) are complete. M2-03A and G0 are recorded in [#39](https://github.com/takh86/ai-engineering-lab/issues/39), which is closed. The [V0–V13 runbook (PR #59)](https://github.com/takh86/ai-engineering-lab/pull/59) is merged; [#40](https://github.com/takh86/ai-engineering-lab/issues/40) started on 2026-09-27 and is paused at V1-CELL: V0 is VALID, V1-WIFI is NOT MET under the frozen rule, and no row is PASS. #41 is the T2 friction work; #42 is the evidence synthesis and final ADR for the DNS layer. A8 is a **verification candidate only**; no production architecture is selected.
- **Product direction (2026-09-27, D14 APPROVED):** the [recovery-first product baseline](docs/recovery-first-product-baseline.md). The urge moment, not the filter, is the product. A no-code product discovery gate (M2-04: interviews and survey, landing pages, a four-week concierge test) runs before any build.
- **Tabsira browser extension (`chrome-extension/`):** a local-only Chrome/Edge/Firefox extension (Manifest V3) that blocks sites and search phrases the user chooses. It was built outside the M1–M6 plan and is part of this project; PR #74 is merged into `main`, and it is **not published** to any store. The Owner is working on it now and will return to the Android app later. It does not change the Android app or its claims. Details, evidence and limits: [`chrome-extension/README.md`](chrome-extension/README.md), [`chrome-extension/TESTING.md`](chrome-extension/TESTING.md).
- **M3 onward: BLOCKED.** Under D14, M3 becomes Recovery Core V1 and starts only after the M2-04 GO decision and an approved M3-01 contract. App interruption and DNS guidance join only after their own gates (PR #60 with AB-01 #61, and #40–#42).

The Owner approved **D13 / AB1–AB7** for voluntary app interruption after the DNS baseline:
selected-app interruption and private recovery help. The
[approved architecture boundary](docs/app-blocking-architecture-decision.md) is now canonical.
The mechanism, permission choice and coverage claim still require AB-01 evidence, a bounded task
contract, and later device/Play-policy gates.
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
  chrome-extension/  # Tabsira browser extension (Node, no runtime dependencies)
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
| Extension unit/static/build tests and reproducible packages (`npm test`, `npm run verify-reproducible` in `chrome-extension/`) | GitHub Actions ([workflow](../../.github/workflows/project-04-extension-tests.yml)) on PRs and pushes to `main` that change the extension. Real-browser (e2e) evidence is run locally and committed under `chrome-extension/test-evidence/` |
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
- **M2 (active):** threat model, truthful product claim, per-layer architecture decisions and the M2-04 product discovery gate. See Status above and [`docs/roadmap.md`](docs/roadmap.md).
- **M3–M6 (conditional):** not authorized. M3 (Recovery Core V1) is blocked until the M2-04 GO decision and an approved M3-01 contract (D14).

## Limitations / next steps

The only filtering code is the M1 standard-DNS experiment, and it is not a protection claim. Its known limits include: browser encrypted DNS (DoH / Secure DNS) bypassed it in M1-06 (human-reported); it refuses to run, rather than downgrade, while Private DNS is active; it handles plaintext IPv4/UDP DNS only (no TCP DNS, IPv6 DNS transport or CNAME filtering); it has no Always-on or reboot support; and it has no automatic network handover — when the underlying network changes or becomes unusable it stops truthfully and must be restarted manually. See [`docs/m1-07-evidence-synthesis.md`](docs/m1-07-evidence-synthesis.md) §8.

No general packet inspection, TLS interception, backend, AI, analytics, payments, accountability features, Islamic content library, Device Owner, AccessibilityService, or `QUERY_ALL_PACKAGES` usage exists. Each of these, and any production protection architecture, needs a separate human-approved decision. Next steps: the M2-04 discovery gate (E1–E3), the AB-01 validation (#61), and the paused #40 verification, then #41 and #42.

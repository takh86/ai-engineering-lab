# 04 — Muslim Recovery Protection

> A privacy-first self-protection and recovery application for consenting adult Muslims who voluntarily want to avoid pornographic content.

## Status

**M1-04 — Android VPN Lifecycle Foundation.** The app can now request VPN consent, run a real `VpnService`-backed foreground service, establish a minimal TUN interface, and stop/revoke cleanly. It configures no route and no DNS server, so it has no effect on real device traffic, and it implements no filtering — `ProtectionState.Protected` remains unreachable at runtime by construction. See [`docs/decisions.md`](docs/decisions.md) D10.

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

- Problem framing, scope gating per milestone, architecture approval, final review.

## AI role

- Scaffolding implementation under the constraints specified for M1-01; domain model and rules engine implementation for M1-02/M1-03; VPN lifecycle foundation implementation for M1-04 — all under an explicit, human-authorized task contract per milestone.

## Verification

| Gate | Result |
|---|---|
| Android build (`assembleDebug`) | See PR description |
| Unit tests | See PR description |

## Milestones

- **M1-01:** project scaffolding only.
- **M1-02:** truthful protection-state domain model (`domain/protection/`).
- **M1-03:** deterministic, block-rules-only domain matching engine (`domain/rules/`).
- **M1-04 (this PR):** Android VPN lifecycle foundation (`vpn/`) — consent, start/stop/revoke, minimal TUN establishment. No filtering.
- **M1 (in progress):** prove/disprove DNS-based VPN filtering against controlled test domains only. See [`docs/requirements.md`](docs/requirements.md).

## Limitations / next steps

No DNS filtering, packet inspection, traffic routing, backend, AI, analytics, payments, accountability features, Islamic content library, Device Owner, AccessibilityService, or `QUERY_ALL_PACKAGES` usage exists yet. The rules engine (M1-03) is not yet wired to real network traffic. These are explicitly out of scope for M1-04 and require separate, reviewed milestones.

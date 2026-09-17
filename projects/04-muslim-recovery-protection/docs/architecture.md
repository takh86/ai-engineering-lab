# Architecture (initial placeholder)

## Status

This is a placeholder for M1-01. No protection architecture is implemented yet. It records the current shape of the project and the constraints the next milestones must respect.

## Current state (M1-02)

- A single Android module (`android/app`) containing an empty Jetpack Compose app.
- No services, no networking, no persistence, no backend.
- A pure-Kotlin protection-state domain model under
  `android/app/src/main/java/com/muslimrecovery/protection/domain/protection/`:
  - `ProtectionSignals` — deterministic runtime facts (VPN permission granted, service
    lifecycle state, tunnel established, filtering operational, fatal error, and saved
    user/config intent).
  - `ProtectionState` — the truthful, user-visible state (`NotConfigured`,
    `PermissionRequired`, `Starting`, `Protected`, `Degraded`, `Stopped`, `Error`).
  - `ProtectionStateEvaluator` — a pure function from `ProtectionSignals` to `ProtectionState`.
  - This code has no Android framework dependency and does not implement `VpnService`,
    permission requests, or any runtime detection. It only defines the shape of truthful
    state and how it is computed from facts, so that no future call site can set
    `Protected` directly from a saved preference or toggle.

## Planned technical direction for M1 (not yet implemented)

- A local Android `VpnService` that runs a DNS-only filter against a configurable list of controlled test domains.
- No packet-level inspection, no TLS interception, no MITM, no elevated OS privileges (Device Owner / root / AccessibilityService).
- Entirely local-first: no backend calls required for the DNS filtering hypothesis itself.

This direction is a hypothesis to validate, not a committed final design. See [`decisions.md`](decisions.md) and [`requirements.md`](requirements.md) for the stop/escalation criteria if DNS filtering proves trivially bypassable.

## Explicit non-goals for M1

- Backend services
- AI/ML components
- Analytics or telemetry
- Payments
- Accountability/reporting-to-others features
- Islamic content library
- Any privilege escalation (root, Device Owner, AccessibilityService)
- `QUERY_ALL_PACKAGES`

## Open questions carried into later milestones

- Whether DoH/Private DNS bypass in mainstream browsers can be meaningfully mitigated without packet-level filtering, and if not, whether that limitation is acceptable for this product's threat model (human decision, not an engineering default).

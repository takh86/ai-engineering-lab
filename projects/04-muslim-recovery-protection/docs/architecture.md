# Architecture (initial placeholder)

## Status

This is a placeholder for M1-01. No protection architecture is implemented yet. It records the current shape of the project and the constraints the next milestones must respect.

## Current state (M1-03)

- A single Android module (`android/app`) containing an empty Jetpack Compose app.
- No services, no networking, no persistence, no backend.
- A pure-Kotlin protection-state domain model under
  `android/app/src/main/java/com/muslimrecovery/protection/domain/protection/`:
  - `ProtectionSignals` — verifiable runtime facts only (VPN permission granted, service
    lifecycle state, tunnel established, filtering operational, fatal error). It deliberately
    contains no saved user/config intent field.
  - `ProtectionState` — the domain protection state consumed by UI (`PermissionRequired`,
    `Starting`, `Protected`, `Degraded`, `Stopped`, `Error`). It represents actual runtime
    protection state only. `Error.reason` is a diagnostic string, not user-facing copy.
  - `ProtectionStateEvaluator` — a pure function from `ProtectionSignals` to `ProtectionState`.
  - This code has no Android framework dependency and does not implement `VpnService`,
    permission requests, or any runtime detection. It only defines the shape of truthful
    state and how it is computed from facts, so that no future call site can set
    `Protected` directly from a saved preference or toggle.
  - User intent/configuration (e.g. "the user turned protection on", onboarding/setup
    progress) is intentionally outside this model. If a separate setup/onboarding state is
    needed later, it must be modeled as its own type, not merged into `ProtectionState`.
- A pure-Kotlin, block-rules-only domain matching engine under
  `android/app/src/main/java/com/muslimrecovery/protection/domain/rules/`:
  - `NormalizedHostname` — deterministic hostname normalization/validation (lowercase, single
    trailing root-dot stripped, DNS label rules enforced). Malformed input — including any
    leading/trailing whitespace — is rejected outright, never trimmed into validity.
  - `DomainRule` — one block rule; matches the exact domain and any subdomain beneath it on
    DNS label boundaries (never substring matching).
  - `RuleDecision` — `Allowed`, `Blocked(matchedRule)`, `InvalidInput(reason: InvalidReason)`.
    `InvalidReason` is a typed enum and never carries the raw submitted hostname.
  - `RuleSet` — a defensively-copied, immutable list of `DomainRule`s with a pure
    `evaluate(hostname): RuleDecision`. Mutating a `MutableList` passed to its constructor after
    construction has no effect.
  - This engine operates on bare hostnames only, never full URLs, and has no Android framework
    dependency, no knowledge of `VpnService`, DNS packets, or networking. The intended
    integration shape for a future milestone is:

    ```
    DNS/VPN runtime (future)
            ↓ hostname
        Rules Engine
            ↓ decision
    Protection runtime integration (future)
    ```

## Current state (M1-04) — VPN lifecycle foundation, no filtering

M1-04 adds the Android `VpnService` lifecycle itself, and nothing else. It exists to prove the
consent → start → establish → stop/revoke flow works safely under Android's real contracts,
without claiming filtering is operational (filtering does not exist yet). New code lives under
`android/app/src/main/java/com/muslimrecovery/protection/vpn/`:

- `VpnLifecycleController` — a pure Kotlin state machine (no Android dependency) that decides
  start/stop/establish-success/establish-failure/revoke transitions. It is unit tested off-device
  and hardcodes `filteringOperational = false` in every `ProtectionSignals` it emits — this is
  what keeps a fully-established tunnel from ever evaluating to `ProtectionState.Protected`
  through `ProtectionStateEvaluator` (D8, unchanged by this milestone).
- `LocalProtectionVpnService` — extends `android.net.VpnService`. Delegates every lifecycle
  decision to `VpnLifecycleController` and only performs the Android-framework side effects: a
  low-importance foreground notification (`systemExempted` foreground-service type — VPN apps
  configured via `Settings > Network & Internet > VPN` are a documented exemption for this type),
  `Builder().addAddress(...).establish()`, and closing the returned `ParcelFileDescriptor` on
  stop/revoke/destroy. It configures **no route and no DNS server** — `addRoute()` and
  `addDnsServer()` are never called — so the established TUN interface carries none of the
  device's real traffic. There is no packet read/write loop of any kind.
- `VpnRuntimeStatus` — an in-process (single-process, no AIDL/Messenger) bridge publishing the
  service's real lifecycle/tunnel/fatal-error facts as Compose `State` for the UI to read.
  Deliberately excludes VPN permission and `filteringOperational` — permission is a UI-observable
  fact via `VpnService.prepare()`, not something the service tracks, and filtering has no runtime
  fact to report yet.
- `MainActivity` gained a minimal M1-04 dev/test harness (Start/Stop buttons, the real
  `VpnService.prepare()` consent flow, and a status line driven by `ProtectionStateEvaluator`).
  This is explicitly not product UI/onboarding/design system — see D10.

## Planned technical direction for M1 (not yet implemented)

- Feeding the rules engine (`domain/rules/`) real resolved hostnames from the established tunnel
  and acting on its `RuleDecision` — this is what would first make `filteringOperational` capable
  of being true, and is out of scope until a future milestone.
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

# Architecture (initial placeholder)

## Status

This is a placeholder for M1-01. No protection architecture is implemented yet. It records the current shape of the project and the constraints the next milestones must respect.

## Current state (M1-03)

- A single Android module (`android/app`) containing an empty Jetpack Compose app.
- No services, no networking, no persistence, no backend. (M1-03 snapshot; M1-04 and M1-05 below
  add the VPN service and the DNS experiment.)
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
  configured via `Settings > Network & Internet > VPN` are a documented exemption for this type;
  eligibility must still be verified on device), `Builder().addAddress(...).establish()`, and
  closing the returned `ParcelFileDescriptor` on stop/revoke/destroy. `onDestroy()` also
  truthfully transitions the controller to stopped and republishes state, so an unexpected
  teardown (no preceding explicit stop or revoke) can never leave the UI reading a stale
  RUNNING/tunnelEstablished=true. If `startForeground()` itself throws, the service never calls
  `establish()` — it reports a truthful startup failure and stops instead. It declares
  `android.net.VpnService.SUPPORTS_ALWAYS_ON = false` service metadata, opting out of Android's
  Always-on VPN feature: M1-04 does not implement or verify that lifecycle (see D10). It
  configures **no route and no DNS server** — `addRoute()` and `addDnsServer()` are never called —
  so the established TUN interface carries none of the device's real traffic. There is no packet
  read/write loop of any kind.
- `VpnRuntimeStatus` — an in-process (single-process, no AIDL/Messenger) bridge publishing the
  service's real lifecycle/tunnel/fatal-error facts as Compose `State` for the UI to read.
  Deliberately excludes VPN permission and `filteringOperational` — permission is a UI-observable
  fact via `VpnService.prepare()`, not something the service tracks, and filtering has no runtime
  fact to report yet.
- `MainActivity` gained a minimal M1-04 dev/test harness (Start/Stop buttons, the real
  `VpnService.prepare()` consent flow, and a status line driven by `ProtectionStateEvaluator`).
  This is explicitly not product UI/onboarding/design system — see D10.

(The M1-04 "no route and no DNS server" configuration above is historical; M1-05 below replaces it
with a DNS-only split tunnel.)

## Current state (M1-05) — standard-DNS filtering experiment (D11)

M1-05 tests whether the VPN foundation can intercept standard system DNS, evaluate the queried
hostname with the existing RuleSet, block a controlled harmless domain, and forward everything else —
without touching any other traffic. It is an experiment, **not** protection: `ProtectionState.Protected`
remains unreachable (see D11).

Packet flow:

```
Android system resolver (apps covered by the VPN, including this app's own harness)
        ↓ DNS server = 10.111.222.1 (addDnsServer)
DNS-only route 10.111.222.1/32 (addRoute) — no default route
        ↓
TUN (10.111.222.2/32)
        ↓ one worker thread, Os.poll + read (non-blocking fd)
dns/Ipv4UdpDnsPacketAdapter   — IPv4/UDP to 10.111.222.1:53 only; everything else dropped
        ↓ DNS payload
dns/DnsMessageCodec           — strict one-question query parse
        ↓ QNAME (as sent)
domain/rules/RuleSet          — EXISTING, unchanged (D9 normalization + label-suffix matching)
   ↙ Blocked      ↓ InvalidInput      ↘ Allowed
NXDOMAIN        REFUSED              vpn/ProtectedUpstreamDnsExchange
(synthetic)     (synthetic)            Private DNS re-check → protect() → bindSocket(underlying)
                                       → connect(underlying DNS:53) → send original bytes
                                       → accept only the matching response (≤ 2 s)
        ↓
dns/Ipv4UdpDnsPacketAdapter.buildResponse — swapped addresses/ports, IPv4 + UDP checksums
        ↓
TUN → system resolver
```

Components:

- `dns/` — pure Kotlin, no Android dependency, unit tested and fuzz-tested on the JVM:
  `Ipv4UdpDnsPacketAdapter` (+ `InternetChecksum`), `DnsMessageCodec`, `DnsFilteringEngine`
  (codec + RuleSet → Forward / Respond / Drop), `DnsPacketProcessor` (the whole per-packet pipeline
  against an `UpstreamDnsExchange` interface), `UpstreamDnsSelector` (underlying-network facts →
  chosen DNS server or a typed refusal; Private DNS checked first), `DnsProxyStatus` (the internal
  experimental status), and `ExperimentalDnsTestRules` (temporary controlled rules: block
  `example.com`).
- `vpn/` — Android side effects only:
  - `LocalProtectionVpnService` runs the upstream preflight (refuses to start if Private DNS is active
    or no usable underlying DNS server exists), establishes the DNS-only tunnel, starts/stops the DNS
    runtime, and publishes facts. Its M1-04 locking discipline is unchanged and now also covers the
    DNS runtime and its status.
  - `DnsProxyRuntime` — the single worker thread; owns a duplicate TUN descriptor that only it uses
    and closes, so stop/revoke never races a read on a reused fd; stops within ~250 ms; re-checks the
    upstream precondition every 2 s; reports self-stops (never external stops) to the service, which
    tears the VPN down with a truthful `FatalError` rather than leaving DNS black-holed.
  - `UnderlyingNetworkInspector` / `ProtectedUpstreamDnsExchange` — ConnectivityManager facts and the
    protected, network-bound, per-query upstream socket.
  - `VpnLifecycleController` gained `onStartupRefused` and `onRuntimeFailed`; `filteringOperational`
    is still hardcoded false.
  - `VpnRuntimeFacts` (now its own file) carries the experimental `dnsProxyStatus` and builds the
    public `ProtectionSignals` with `filteringOperational = false`, whatever that status is.
    `VpnRuntimeStatus` additionally publishes in-memory aggregate DNS counters (counts only).
- `MainActivity` harness: adds the experimental DNS proxy status, counters, and buttons that resolve
  the fixed test domains through the system resolver off the main thread. Still not product UI.

Known limitations of M1-05A (deliberately deferred, see D11): standard plaintext DNS only, IPv4
UDP only, one query at a time (a slow upstream delays others by up to 2 s, which a local app could
exploit to degrade DNS for all apps), only the question name is filtered (a CNAME into a blocked
domain is not caught), no TCP DNS (truncated responses fail), no IPv6 DNS transport on the TUN,
DoH/DoT/Private DNS/browser Secure DNS not handled, and an underlying-network change stops the
experiment instead of handing over (addressed by the M1-07 M-1 fix below, pending device
verification; automatic handover is not implemented).

## Current state (M1-07) — M-1: stale underlying network stops the experiment

The experiment forwards allowed queries through the underlying `Network` captured before the VPN is
established. M-1 was the risk that this captured network goes stale mid-session while the proxy
still reports `running`. Examples: it is lost, loses INTERNET or VALIDATED, is kept only in the
background after another network becomes default, or loses its DNS server. Allowed DNS would then
fail while the experiment looked active.

Policy: **underlying-network invalidation stops the experimental VPN session. Automatic network
handover is not implemented.** After conditions stabilise, the user starts again manually.

- `vpn/UnderlyingNetworkMonitor` (Android side) registers one session-scoped `NetworkCallback` for
  physical Internet networks (`INTERNET` + `NOT_VPN`) when the DNS runtime starts, and unregisters
  it on every teardown. On API 31+ it uses `registerBestMatchingNetworkCallback`, so another network
  becoming the best match is also reported. On API 24–30 it uses `registerNetworkCallback` and
  reacts only to the captured network's own events. On every API level, `onLosing` for the captured
  network (e.g. mobile data moved to the background after Wi-Fi became default, per the "Read
  network state" guide) also stops the session. It never uses `getActiveNetwork()` or the
  default-network callback after the VPN is up: the app's default network "may be a physical
  network or a virtual network, such as a VPN that applies to the application"
  (`registerDefaultNetworkCallback` docs). It never calls synchronous
  ConnectivityManager getters inside callbacks, which the NetworkCallback docs forbid; decisions come
  only from callback payloads.
- `vpn/CapturedNetworkWatch` (pure Kotlin, unit tested) turns those payloads into at most one
  invalidation per session, using the same `UpstreamDnsSelector` policy as startup. The captured
  network must still exist, have INTERNET and VALIDATED, and be usable by this app (FOREGROUND and
  NOT_SUSPENDED on API 28+, not blocked on API 29+). It must also have a usable DNS server and no
  Private DNS. Within one snapshot, Private DNS is reported ahead of the validation, usability and
  DNS-server checks. Across separate events, the first failing report decides the stop message.
  Private DNS is never downgraded. Events for other networks, and any event after the session
  stopped, are ignored.
- The monitor only reports. `LocalProtectionVpnService` ignores reports from any monitor that is not
  its current one, then uses the existing runtime-failure path (`VpnLifecycleController.onRuntimeFailed`),
  shared with the DNS worker's self-stop. Result: the tunnel is closed, the DNS runtime stopped, the
  proxy status is no longer `running`, and a truthful fatal error is published (`ProtectionState.Error`).
  `filteringOperational` stays false, so `Protected` stays unreachable.
- The worker's 2 s synchronous re-check and the per-forward re-check remain as a backstop and apply
  the same (now stricter) policy. The startup preflight also uses it, so Start is refused on a
  network that is not validated or not usable.

Limitations:

- There is no automatic handover and no debounce. A transient loss of VALIDATED, or a suspended
  cellular network (e.g. during a non-VoLTE call), stops the session.
- Start is now refused on a network that is not validated or not usable.
- Below API 31 a change of preferred network is noticed through `onLosing` / `onLost`, or through
  the loss of FOREGROUND (API 28+), VALIDATED or INTERNET. There is no best-match signal there.
- On API 24–27 FOREGROUND / NOT_SUSPENDED are not observable. A captured network moved to the
  background is caught only through `onLosing`, as the guide documents; suspension is not
  observable at all.
- On API 31+ the best match for the request and the pre-VPN `getActiveNetwork()` are not
  documented to be identical. A per-app network preference (work profile, OEM or "mobile data only"
  apps) could therefore make every Start stop at once with "another network became preferred".
  That is fail-closed and needs device checking.
- A network lost before the callback is registered produces no callback on any API level. The
  worker's 2 s re-check stops the session instead.
- Two detectors, the callback and the worker's re-check, can race. Either may set the stop
  message; the resulting state is equally truthful.
- Repeated upstream timeouts on a network the platform still reports healthy are not treated as
  invalidation.
- Pre-existing and unchanged: a check-then-send window of about a millisecond remains between the
  per-forward Private DNS check and the send.
- Pre-existing and unchanged: a stop that lands just after a new Start can undo that Start (the
  result is still stopped and truthful).
- The Android glue (monitor registration, the service's identity guard and teardown order) is not
  unit tested (no Robolectric or mocking dependency). On-device behaviour needs human verification.

## Planned technical direction for M1 (not yet implemented)

- M1-05 feeds the rules engine real hostnames from standard DNS (see above), but
  `filteringOperational` stays false until a future, human-approved milestone establishes what
  "operational filtering" must cover (at minimum the Private DNS / DoH / browser Secure DNS gate).
- No general packet-level inspection (D11 permits only DNS framing), no TLS interception, no MITM, no elevated OS privileges (Device Owner / root / AccessibilityService).
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

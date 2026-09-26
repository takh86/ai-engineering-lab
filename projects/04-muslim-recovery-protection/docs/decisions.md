# Decisions

Decisions recorded here follow the Lab's [Decision Record Template](../../../templates/DECISION_RECORD_TEMPLATE.md) format, condensed for this project's early stage.

## D1 — DNS-based VPN filtering is a hypothesis, not a final architecture

**Status:** Accepted (M1)

**Decision:** M1 will implement and test a local DNS-based VPN filter against controlled test domains only, to empirically learn what it can and cannot block.

**Why:** Cheaper and lower-privilege than packet-level filtering or MITM; but its real-world effectiveness against DoH/Private DNS is unknown and must be measured, not assumed.

**Consequences:** If mainstream browsers trivially bypass it, that result must be documented and escalated to an architecture review rather than hidden or worked around. Packet-level filtering, TLS interception, MITM, AccessibilityService, Device Owner, or root are out of scope without a new review and explicit human approval.

## D2 — minSdk 24, compileSdk/targetSdk 36 (Android 16)

**Status:** Accepted (M1). Corrected during human review of M1-01.

**Decision:** `minSdk = 24`. `compileSdk`/`targetSdk = 36` (Android 16), matching the approved project requirement.

**History (kept for honesty, not current state):** During initial local scaffolding, `compileSdk`/`targetSdk` were temporarily set to 35 because Android SDK platform 36 was not yet installed in the local environment and no `sdkmanager`/`cmdline-tools` was available to install it without additional setup. Human review rejected API 35 as an accepted project target. The correction installed Android SDK Platform 36 (`platform-36_r02.zip`, matching the published checksum from Google's SDK repository manifest) directly into the local SDK, and upgraded the build toolchain to a version that officially supports it:

- Android Gradle Plugin: `8.7.3` → `8.11.2`, which supports API 36 and is compatible with Gradle 8.13, per [AGP 8.11.0 release notes](https://developer.android.com/build/releases/past-releases/agp-8-11-0-release-notes)
- Gradle: `8.11.1` → `8.13` (AGP 8.11.2's minimum/default required Gradle version)
- Kotlin: `1.9.24` → `2.1.20` (the Kotlin version AGP 8.11 is built/tested against)
- Added the `org.jetbrains.kotlin.plugin.compose` Gradle plugin (Kotlin 2.0+ requires the Compose compiler as a separate plugin; the old `composeOptions.kotlinCompilerExtensionVersion` setting was removed)
- Compose BOM: `2024.10.01` → `2025.06.01`

This is the toolchain selected for this project; it is not claimed to be the earliest AGP release to add API 36 support, only a stable, verified-compatible combination.

**Why:** The Tech Lead's approved project requirement is Android 16 / API 36+; API 35 must not be recorded as an accepted target under any circumstance.

**Consequences:** Verified with a clean build (`./gradlew clean assembleDebug testDebugUnitTest`) after the upgrade — see PR for exact output. No further SDK-level work is needed for M1-01.

## D3 — Controlled test domains only

**Status:** Accepted (M1)

**Decision:** All M1 testing (unit, manual, integration) uses synthetic domain names or a harmless, controlled test endpoint. Real pornographic content is never browsed, bundled, committed, scraped, referenced, or used in automation.

**Why:** Safety, legality, and reproducibility of engineering evidence.

## D4 — Multi-runtime project layout

**Status:** Accepted (M1-01)

**Decision:** This project uses `android/`, `backend/` (created only when needed), and `docs/` instead of the generic Lab template's `src/`, `tests/`, `docs/`.

**Why:** The Lab's default template assumes a single-runtime backend project. This project's primary artifact is a mobile app, with a backend only as a possible future addition — a single flat `src/` would not represent that structure honestly.

**Consequences:** This is a documented, approved deviation from the generic template for this project only.

## D5 — No backend for M1

**Status:** Accepted (M1)

**Decision:** No backend is scaffolded for M1. `backend/` is not created until a specific M1 requirement demonstrably cannot be implemented correctly without one.

**Why:** M1 must remain local-first; the DNS filtering hypothesis does not require server-side components.

## D6 — Nested Android `.gitignore`, root untouched

**Status:** Accepted (M1-01)

**Decision:** Android build artifacts are ignored via `projects/04-muslim-recovery-protection/android/.gitignore`. The repository root `.gitignore` is not modified during M1-01.

**Why:** Keeps Android-specific ignore rules scoped to the project that needs them.

## D7 — GitHub Actions stay at repository root (correction applied)

**Status:** Accepted (M1-01)

**Decision:** No project-local `.github/workflows/` is created. When CI is introduced for this project, it will be added as a root-level workflow (`.github/workflows/`) using path filters scoped to `projects/04-muslim-recovery-protection/**`.

**Why:** GitHub Actions only executes workflows defined at the repository root. A project-local workflows directory would silently do nothing.

**Consequences:** No CI is added in M1-01. Root workflows are not modified during M1-01 unless explicitly authorized.

## D8 — Protection state is computed, never stored as a boolean flag

**Status:** Accepted (M1-02)

**Decision:** `ProtectionState.Protected` is only ever produced by `ProtectionStateEvaluator.evaluate()` from runtime `ProtectionSignals` (permission, service lifecycle, tunnel, filtering, fatal error). `ProtectionSignals` contains no user/config intent field at all — the evaluator has no way to read saved intent, let alone use it to produce `Protected`. `ProtectionState` represents actual runtime protection state only; user intent/configuration is intentionally outside this model. There is no code path that sets a "protected" flag directly from a preference or toggle.

**Why:** A UI or service that reports "Protected" based on user intent rather than verified runtime health would misrepresent actual protection to someone relying on it — the core failure mode this milestone exists to prevent. Mixing saved intent into the runtime-facts type also risks the evaluator (now or in a future edit) silently depending on it.

**Consequences:** Any future caller (UI, service, notification) must go through the evaluator with real signals. Fatal runtime error takes precedence over every other signal, including missing permission, because a fatal error means the runtime state can no longer be trusted; this ordering is an evaluator implementation detail, not a separate architectural decision, and can be revisited without a new review if a future milestone finds a better ordering. Future setup/onboarding state (e.g. "has the user ever configured protection") may be introduced separately if a later milestone needs it, backed by its own historical signal (e.g. `hasEverRun`) — it must not be merged into `ProtectionState` or `ProtectionSignals`.

## D9 — Rules engine matches by DNS label suffix, block-rules only

**Status:** Accepted (M1-03)

**Decision:** `DomainRule.matches()` compares normalized hostnames by DNS label suffix (the candidate's trailing labels must equal the rule's labels exactly), never by substring or prefix comparison. A rule for `blocked.example` blocks that domain and any subdomain beneath it, and nothing else — `blocked.example.other` and `fakeblocked.example` are not matches. M1-03 supports block rules only; there is no allow-rule type, regex, or wildcard syntax. Malformed hostname input produces `RuleDecision.InvalidInput` rather than being treated as `Allowed`.

**Why:** Substring or prefix matching would create both false blocks (e.g. `fakeblocked.example`) and false allows (e.g. treating `blocked.example.other` as unrelated when a naive suffix-string check might still trip on it) — label-boundary comparison is the only way to satisfy the approved matching policy exactly. Treating invalid input as `Allowed` would silently fail open on malformed data, which is unacceptable for a blocking engine.

**Consequences:** Any future milestone that adds allowlists, wildcards, or regex rules needs its own review and explicit approval — none of that is introduced here. The engine has no knowledge of `VpnService`, DNS packets, or networking; runtime integration (feeding it real resolved hostnames and acting on `RuleDecision`) is deferred to a future milestone.

## D10 — M1-04 VPN lifecycle foundation: no route, no DNS server, systemExempted FGS type

**Status:** Accepted (M1-04). Implementation consequence of the M1-04 Task Contract the Tech
Lead authorized, not a new architecture decision made unilaterally by AI.

**Decision:** `LocalProtectionVpnService` (`android/app/src/main/java/com/muslimrecovery/protection/vpn/`)
establishes a minimal TUN interface (`Builder().addAddress(...).establish()`) with no
`addRoute()` and no `addDnsServer()` call, so the tunnel carries none of the device's real
traffic — there is no packet read/write loop. It declares `android:foregroundServiceType="systemExempted"`
with the `FOREGROUND_SERVICE_SYSTEM_EXEMPTED` permission — the documented type selected for this
VPN implementation; its eligibility must still be independently verified on device, and this
record does not claim it is the only foreground-service type a VPN app could ever use. The
service also declares `android.net.VpnService.SUPPORTS_ALWAYS_ON` = `false` service metadata:
`VpnService` supports Android's Always-on VPN feature by default unless a service explicitly
opts out, and M1-04 does not implement or verify Always-on/system-start/reboot lifecycle
behavior — that opt-out is deliberate until a future, human-approved milestone implements and
verifies it. Lifecycle decisions (idempotent start/stop, foreground-start-failure and
establish-failure handling, revoke, and truthful cleanup on unexpected teardown) are delegated to
`VpnLifecycleController`, a pure Kotlin class extracted specifically so this policy is
unit-testable without Android instrumentation — `filteringOperational` is hardcoded false in
every signal it produces.

**Why:** M1-04's purpose is to prove the VPN consent/lifecycle plumbing works safely before any
filtering exists; routing real traffic into a tunnel with no packet processing would silently
break the device's normal connectivity. Always-on is a distinct lifecycle (system-initiated start,
no user-driven consent flow in the moment) that this milestone has not implemented or tested, so
leaving it enabled by default would let Android exercise a code path this contract never verified.

**Consequences:** A future milestone that feeds the rules engine real resolved hostnames and adds
a packet-processing loop is a separate, reviewed change — none of that exists yet. Until then,
`ProtectionState.Protected` is unreachable at runtime in this app, by construction: the evaluator
(D8) requires `filteringOperational == true` to report `Protected`, and this milestone never sets
it. A future milestone that implements and verifies Always-on lifecycle must revisit the
`SUPPORTS_ALWAYS_ON` metadata explicitly; it must not be flipped to `true` incidentally.

## D11 — DNS-only split-tunnel packet processing (M1-05 standard-DNS experiment)

**Status:** Accepted (M1-05). Approved by the human Tech Lead in the M1-05 Task Contract; this
record documents that approval and its implementation consequences, it is not an AI-originated
architecture decision.

**Decision:** The VPN may carry — and the app may minimally parse — exactly the traffic needed to
run DNS through it, and nothing else.

ALLOWED:

- Minimal IPv4 + UDP framing exclusively for DNS transport: packets read from the TUN are accepted
  only if they are unfragmented IPv4/UDP datagrams addressed to the virtual DNS server on port 53;
  everything else is dropped without further inspection. Replies are built as IPv4/UDP packets with
  swapped addresses/ports and computed IPv4 header and UDP checksums.
- A strict, local, dependency-free DNS codec (`dns/DnsMessageCodec`) limited to: one-question
  standard queries, at most one structurally validated EDNS OPT record (never interpreted), QNAME
  extraction with no compression-pointer following, and header+question synthetic responses.

NOT ALLOWED (unchanged from D1 — requires a new review and explicit human approval):

- General-purpose packet inspection or filtering; any parsing of TCP, HTTP, TLS, or other
  application content; TLS interception/MITM/certificate installation; browser/page inspection.
- Any default route (`0.0.0.0/0` or `::/0`) or any route other than the virtual DNS server's `/32`.

Implementation consequences (M1-05):

- **Routing:** TUN address `10.111.222.2/32`, virtual DNS server `10.111.222.1`, configured with
  `addDnsServer(10.111.222.1)` and the single route `addRoute(10.111.222.1, 32)`. No default route,
  so ordinary HTTP/HTTPS and all other traffic never enters the TUN. `allowFamily(AF_INET6)` is
  called because, per the `VpnService.Builder.allowFamily` documentation, a VPN with only IPv4
  addresses/routes otherwise **blocks all IPv6 traffic** of the apps it covers; it adds no route, so
  IPv6 traffic falls through to the underlying network untouched. (M1-04's lifecycle-only tunnel had
  this IPv6-blocking side effect; M1-05 removes it.) The 10.111.222.x pair deliberately avoids
  10.0.0.x, which common home routers use for their own gateway/DNS.
- **Upstream DNS:** allowed queries are forwarded unchanged over plaintext UDP to the underlying
  (non-VPN) network's own DNS server, discovered via `ConnectivityManager` before the VPN is
  established (IPv4 preferred). No public resolver is hardcoded. Each query uses a fresh socket that
  is `VpnService.protect()`ed (nothing is sent if protect fails) and bound to that network with
  `Network.bindSocket()`, then connected to the server; the virtual DNS/TUN addresses can never be
  selected as upstream, so no forwarding loop is possible. Responses are accepted only if they match
  the query's transaction ID, QR, OPCODE and exact question, within a 2 s bounded timeout.
- **Private DNS — plaintext downgrade prohibited:** `LinkProperties.isPrivateDnsActive()` (API 28+;
  Private DNS does not exist below API 28) is checked on the underlying network before establishing,
  again before every forward, and every 2 s by the worker. If it is active the experiment refuses to
  start (or stops, tearing the VPN down) with a truthful error, and never forwards plaintext. It
  never attempts to disable or bypass Private DNS. Note this includes Android's default "Automatic"
  (opportunistic) mode whenever the network's resolver supports DNS-over-TLS.
- **Rule decisions:** the existing RuleSet (D9, unchanged) evaluates the QNAME for every QTYPE.
  `Blocked` → synthetic NXDOMAIN (same ID and question; QR=1, RA=1, RD/CD copied; no SOA, so it is
  not negatively cached and stopping the VPN restores resolution immediately). `InvalidInput` →
  synthetic REFUSED, never forwarded (e.g. `_x.blocked.example` cannot be used to get around a
  block rule). `Allowed` → forward. Malformed messages are dropped; well-formed but unsupported
  shapes get NOTIMP/FORMERR/REFUSED; none is ever forwarded.
- **Runtime:** one dedicated worker thread (`vpn/DnsProxyRuntime`) owns its own duplicate of the TUN
  descriptor, polls it (non-blocking, 250 ms timeout), processes one packet at a time, and has no
  app-level queue. If the DNS runtime cannot start or stops itself, the VPN is torn down with a
  truthful fatal error, so the system's DNS is never left pointing at a virtual server nobody
  answers.
- **Permissions:** `INTERNET` and `ACCESS_NETWORK_STATE` (both normal permissions), in addition to
  M1-04's.
- **Controlled rules:** `dns/ExperimentalDnsTestRules` blocks only the IANA documentation domain
  `example.com` (and subdomains); `example.org` is the allowed comparison. Temporary M1 experiment
  configuration, not a production ruleset (D3).
- **Privacy:** no query history, hostname logging, packet capture, persistence, analytics, or upload.
  Diagnostics carry typed reasons only; in-memory aggregate counters (blocked/forwarded/...) exist
  for the dev harness.

**Why:** M1-05 must empirically test whether a local VpnService can intercept and filter standard
system DNS at all (D1's hypothesis), with the smallest possible packet surface: only DNS packets
enter the TUN, so everything else is untouched by construction.

**Consequences:**

- **`ProtectionState.Protected` remains intentionally unreachable.** A working standard-DNS proxy is
  not verified protection: Private DNS, DoH, browser Secure DNS (Chrome/Firefox), Incognito, TCP DNS,
  IPv6 DNS transport, and reboot/Always-on are all untested. The public `filteringOperational`
  signal stays hardcoded `false` (D8); the experiment's state is exposed only as an internal,
  experimental `DnsProxyStatus` for the development harness.
- Deferred (each needs its own review/approval): TCP DNS (truncated responses and clients' TCP
  retries are dropped), IPv6 DNS transport on the TUN, DNS-over-TLS/Private DNS compatibility,
  DNS-over-HTTPS and browser Secure DNS, EDNS processing, DNSSEC, caching, concurrency beyond one
  worker, answer-section/CNAME filtering, underlying-network handover (a network change stops the
  experiment; see D12), and production rule distribution.
- Known limitation of the single worker: allowed queries are forwarded one at a time, so one slow or
  unanswered upstream query delays every other query on the device by up to the 2 s timeout. Any
  local app could deliberately keep that worker busy (e.g. querying names whose authoritative
  servers never answer), degrading DNS for all apps for as long as it does so. It cannot crash the
  app or stop the VPN. Bounded concurrency is deferred.
- Only the question name is filtered: an allowed name whose upstream answer is a CNAME into a
  blocked domain still resolves, because upstream answers are relayed unchanged. The experiment's
  evidence covers direct lookups of blocked names only.
- The DoH/Private DNS bypass question from D1 is untouched and remains the next architecture gate.

## D12 — M-1: underlying-network invalidation stops the experiment; no automatic handover

**Status:** Accepted (M1-07). The Tech Lead set this policy in the M1-07 M-1 task contract and
merged its implementation in PR #32 (2026-09-26). The Gradle gate passed in GitHub Actions, and the
Samsung close-out was human-reported PASS (see `m1-07-evidence-synthesis.md` §5).

**Decision:** While a DNS-experiment session runs, the underlying network captured at startup is
watched through one session-scoped `ConnectivityManager` network callback. It is re-checked with
the same policy used at startup: present; `INTERNET`; `VALIDATED`; usable by this app
(`FOREGROUND` / `NOT_SUSPENDED` on API 28+, not blocked on API 29+); a usable DNS server; Private
DNS not active; and, on API 31+, still the best network for a physical-Internet request. Once any
of these fails, the session is stopped through the existing runtime-failure path, with a truthful
fatal error, the tunnel closed and the proxy no longer `running`. It never switches to another
network and never downgrades Private DNS. After conditions stabilise the user can Start again.

**Why:** Fail closed / stop truthfully is preferred over automatic handover in M1. A stale network
would otherwise leave allowed DNS failing while the experiment still looked active.
`getActiveNetwork()` and the default-network callback are not used after the VPN is established:
the `registerDefaultNetworkCallback` docs say the app's default network may be "a VPN that applies
to the application".

**Consequences:** Automatic handover remains out of scope. There is no debounce, so a transient
loss of `VALIDATED`, or a suspended cellular network (e.g. during a non-VoLTE call), stops the
session. Start is also refused on a network that is not validated or not usable. `onLosing` for the
captured network also stops the session on every API level. Below API 31 a change of preferred
network is otherwise noticed only when the old network is lost or loses
`FOREGROUND`/`VALIDATED`/`INTERNET`. On API 31+ a per-app network preference could make the best
match differ from the captured network, which would stop every session right after Start
(fail-closed, to be checked on device). `filteringOperational` stays false and
`ProtectionState.Protected` stays unreachable. No new permission or route is introduced. The
monitor is a session-scoped reporter under the existing lifecycle authority (`VpnLifecycleController`).

## D13 — Voluntary app blocking is an approved, bounded product direction

**Status:** Accepted as a product/architecture boundary (2026-09-26); enforcement method and
production claim pending a device and Play-policy gate.

**Decision:** The Owner approved an opt-in local blocker for user-selected apps with a rapid
interruption and direct access to recovery help. The [app-blocking decision](app-blocking-architecture-decision.md)
records AB1–AB7, its data and permission boundaries, and its rejection tests. Usage Access plus
overlay and narrow package-only Accessibility are candidates to compare, not implemented features.

**Why:** The M2-02 DNS candidate cannot interrupt use of an entire selected app. This is a new,
complementary product requirement, explicitly approved after the M2-02 baseline. It satisfies D1's
requirement for new review and human approval before considering AccessibilityService outside M1.

**Consequences:** H5 and H8 still exclude OS locks; H9 still excludes browsing/hostname histories
and backend surveillance. A7b/H16 excluded Accessibility **URL detection**, not this narrower
package-level experiment. A8 remains verification-only; M3 implementation and Play distribution
need their own evidence and gate. No M1 non-goal or historical evidence is retroactively changed.

## AI contribution

This document, the surrounding scaffolding, and the initial project structure were AI-implemented under explicit Tech Lead constraints (see the M1-01 authorization). The Tech Lead owns the decisions themselves; AI recorded them as directed and did not originate the architecture direction. D11's implementation details (address pair, `allowFamily(AF_INET6)`, REFUSED for `InvalidInput`, the periodic Private DNS re-check, tearing the VPN down on runtime failure) were chosen by AI within the approved contract and are flagged for human review in the M1-05 PR.

# Requirements

## Milestone M1 — DNS-based VPN filtering hypothesis

M1 exists to empirically test one hypothesis: **can a local, on-device DNS-based VPN filter effectively block access to a set of controlled test domains, and where does it fail?**

This is a hypothesis under test, not an approved final architecture. M1 must document real limits as well as what works.

### In scope for M1

- An Android `VpnService`-based local DNS filter (implemented in a later M1 sub-milestone, not M1-01).
- Testing against harmless, controlled/synthetic test domains only (see below).
- Documenting where mainstream browsers bypass DNS filtering via DoH, Private DNS, or other default behavior.

### Explicitly out of scope for M1 (requires a new architecture review + explicit human approval)

- Packet-level filtering
- TLS interception / certificate installation / MITM
- AccessibilityService
- Device Owner privileges
- Root access
- Backend services (unless a later M1 requirement demonstrably cannot be implemented without one)
- AI, analytics, payments, accountability features, Islamic content library
- `QUERY_ALL_PACKAGES`

### Test domains

- Unit tests: synthetic domain names only.
- Manual/integration tests: a harmless test endpoint under our control, or an explicitly designated harmless test domain.
- Never: browsing, bundling, committing, scraping, referencing, or automating tests against real pornographic content.

### Success / stop criteria

M1 is **not** successful if normal mainstream browser configurations trivially bypass the claimed protection (e.g., via DoH/Private DNS). If that happens, work stops at the architecture gate and the following is presented for human review before any architecture change:

1. Exact bypass
2. Affected browser/version
3. Reproduction steps
4. Why DNS filtering failed
5. Technically viable alternatives
6. Permission/policy implications
7. Complexity/security trade-offs

## Platform requirements

- minSdk 24 for M1.
- compileSdk/targetSdk 36 (Android 16), the approved project requirement. See `docs/decisions.md` D2 for the toolchain versions this required and the corrected history (API 35 was used briefly during initial local scaffolding before platform 36 was installed; it was never an accepted target).
- Compatibility risk for legacy Android versions (minSdk 24 through targetSdk 36) is documented, not optimized for, during scaffolding.

## Milestone M1-01 — Project Scaffolding (this PR)

### Requirements

- Repository layout under `projects/04-muslim-recovery-protection/` (android/, docs/; backend/ omitted until needed).
- Project README and docs (problem, requirements, architecture, decisions).
- A buildable, empty Android Kotlin/Jetpack Compose app with no protection logic.
- Nested Android `.gitignore` under `android/`.

### Acceptance criteria

- [ ] `projects/04-muslim-recovery-protection/` exists with the approved layout.
- [ ] Android project builds successfully from a clean state (`./gradlew assembleDebug` or equivalent).
- [ ] No VPN, blocking, rules engine, backend, AI, analytics, payments, accountability, content library, Device Owner, AccessibilityService, or `QUERY_ALL_PACKAGES` code exists.
- [ ] Root `.gitignore` and root `.github/workflows/` are untouched.

## Milestone M1-05 — Standard DNS filtering experiment (D11)

M1-05 tests one bounded hypothesis: can the M1-04 `VpnService` foundation intercept **standard**
system DNS, extract the hostname safely, evaluate it with the existing M1-03 RuleSet, block a
controlled harmless domain, forward allowed queries upstream, return valid responses, and leave
unrelated traffic unaffected? It is an experiment; **a working DNS experiment does not mean the user
is protected**, and `ProtectionState.Protected` must remain unreachable.

### Requirements

- DNS-only split tunnel per D11: a virtual DNS server address distinct from the TUN address, one
  `/32` route to it, `addDnsServer()` pointing at it; no default route; no interception of ordinary
  HTTP/HTTPS or any other traffic.
- Minimal IPv4/UDP framing and a strict local DNS codec (no third-party DNS dependency): one
  question, IN class, bounds-checked, compression pointers rejected, never crash on malformed input,
  no raw payload/hostname logging.
- Hostnames evaluated only by the existing RuleSet (D9 unchanged). `Blocked` → synthetic NXDOMAIN
  preserving transaction ID and question; `InvalidInput` → explicit REFUSED, never forwarded;
  `Allowed` → original query forwarded.
- Allowed queries forwarded to the underlying network's own DNS server (no hardcoded public
  resolver) over a `VpnService.protect()`ed socket bound to that network, with a bounded timeout and
  response validation (transaction ID, flow, question). No forwarding loop.
- Private DNS: if active on the underlying network, never forward plaintext; report a truthful
  refused/error state; never disable or bypass Private DNS.
- One bounded worker; no unbounded queues or threads; stop/revoke/destroy/startup failure release
  the TUN descriptor, worker, and upstream socket idempotently; M1-04 race-safety preserved.
- `filteringOperational` stays false in the public `ProtectionSignals`; the experiment's state is an
  internal, experimental fact only.
- Controlled harmless test domains only: `example.com` blocked (and its subdomains), `example.org`
  allowed; clearly marked as temporary experiment rules.
- Permissions added: only `INTERNET` and `ACCESS_NETWORK_STATE`.

### Explicitly deferred

TCP DNS, IPv6 DNS transport, DNS-over-TLS / Private DNS compatibility, DNS-over-HTTPS, browser
Secure DNS, EDNS processing beyond tolerating one OPT record, DNSSEC validation, caching, production
rule distribution, network handover, and Always-on/reboot behavior.

### Acceptance criteria

- [ ] `.\gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon` passes from `android/`.
- [ ] JVM tests cover the DNS codec, IPv4/UDP adapter (including checksums), filtering integration,
      upstream selection/Private DNS refusal, the Protected invariant, and a deterministic parser
      robustness (fuzz) check.
- [ ] No default route, TLS inspection, HTTP parsing, browser inspection, real adult-content
      domains, sensitive logging, backend, AccessibilityService, `QUERY_ALL_PACKAGES`, or
      Device Owner/root.
- [ ] Human real-device test plan (see the M1-05 PR) executed on a physical Samsung device with
      Private DNS **Off**: VPN start/stop/restart, allowed/blocked/subdomain resolution, block
      disappears when the VPN stops, ordinary browsing unaffected, and Private DNS **On** is refused
      without plaintext downgrade — with `Protected` never shown.

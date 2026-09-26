# Project 04 — Current Android Test & Quality Gap Audit

> **Project:** Muslim Recovery Protection\
> **Nature:** REPORT ONLY. Independent audit prepared by AI for the Tech Lead. It changes no code,
> test, workflow or existing document. It makes no decision: it does not approve A8, does not
> authorize M3, and does not close M1.\
> **Date:** 2026-09-26\
> **Audited commit:** `main` at `6e3349b`. Its `android/` tree and `.github/workflows/` are
> byte-identical to `4137653` (the PR #32 merge) and to `5382a6c` (the PR #32 head that passed CI).
> This was checked with `git diff --quiet` (§12.1).\
> **Scope:** `projects/04-muslim-recovery-protection/android/` (all production and test sources,
> Gradle and lint configuration, manifest) and `.github/workflows/project-04-m1-07-verification.yml`.

## How to read this report

**Evidence labels.** Every statement rests on one of these:

| Label | Meaning |
|---|---|
| **RUN** | A command executed during this audit (§12.1) |
| **CI** | A GitHub Actions result read through the GitHub API during this audit. The job logs were not re-read. |
| **SOURCE** | Read directly from the repository source during this audit |
| **DOC** | Stated in an existing Project 04 document. It is cited, not re-verified. |
| **HUMAN-REPORTED** | Device behaviour reported by the Tech Lead (M1-05 / M1-06), mostly without preserved artifacts |
| **ASSUMPTION** | Not verified in this audit |

**Classification** (task vocabulary): **VERIFIED**, **PARTIALLY VERIFIED**, **HUMAN-VERIFIED ONLY**,
**UNVERIFIED**, **OBSOLETE IF A8 SELECTED**, **KEEP AS HISTORICAL EVIDENCE**. A finding may carry
two labels, for example "UNVERIFIED · OBSOLETE IF A8 SELECTED".

In this report, **VERIFIED** means two things hold. First, an automated test exercises the behaviour
directly and passed in CI on this exact `android/` tree. Second, the test was re-executed during this
audit in the scratch JVM harness (§12.1). It does **not** mean device-verified.

**Severity** (for gaps). Two columns are given, because the answer depends on whether the current
code survives:

- **Now** is severity at the current stage: M2-03 pending, with no runtime work authorized.
- **If kept** is severity if the current `vpn/` / `dns/` code survives into M3 (for example, A2 is
  reopened).

| Severity | Meaning |
|---|---|
| **BLOCKER** | The next stage (the M2-03 decision / gate G0) cannot proceed honestly until this is resolved. |
| **HIGH** | Must be closed before any claim about, or production use of, the affected behaviour. |
| **MEDIUM** | Should be closed by the milestone that next changes the affected code. |
| **LOW** | Hygiene: fix when convenient. |

### Question index

| # | Question | Answered in |
|---|---|---|
| 1 | Which production classes/modules exist? | §2 |
| 2 | Which have direct automated tests? | §3, §4 |
| 3 | Which are tested only indirectly? | §4 |
| 4 | Which Android glue has no objective coverage? | §6 |
| 5 | Which lifecycle/network races are hard to automate? | §6.2 |
| 6 | Which security/privacy properties rely only on code review? | §7 |
| 7 | Which behaviour relies only on HUMAN-REPORTED device testing? | §5.2 |
| 8 | Which regression tests are high-value if the code survives into M3? | §10.1 |
| 9 | Which tests become obsolete if A8 is selected? | §9.1 |
| 10 | Which tests should be kept as historical M1 evidence? | §9.2 |
| 11 | Flaky / time-based / concurrency test risks? | §5.3 |
| 12 | Lint / static-analysis gaps? | §8.3 |
| 13 | Are CI gates sufficient for the current stage? | §8.4 |

---

## 1. Executive summary

**The pure-Kotlin half of the app is well tested. The Android half has no automated test at all.
None of the exact code now on `main` has recorded device evidence.**

**Measured facts:**

- The 23 production Kotlin files contain 2,786 physical lines (SOURCE).
  - 17 files (1,454 lines) have no Android framework dependency.
  - 6 files (1,332 lines, 47.8%) are Android framework glue.
- 196 JVM unit tests exist in 14 test classes, plus 1 test helper (SOURCE). There are **no**
  instrumentation tests: there is no `src/androidTest/`, although `androidTest` dependencies and a
  test runner are declared (SOURCE).
- CI ran `clean assembleDebug testDebugUnitTest lintDebug` successfully on `5382a6c`, whose
  `android/` tree is identical to `main` (CI, RUN).
  - The workflow has 12 runs in total. Run 1 failed; runs 2–12 succeeded.
- In this environment, `./gradlew testDebugUnitTest` and `./gradlew lintDebug` **could not run**.
  - AGP 8.11.2 is served only from Google Maven (`dl.google.com`), which the network policy blocks
    (HTTP 403 on CONNECT).
  - No Android SDK is installed.
  - Both builds failed at plugin resolution. No test or lint check executed (RUN).
- A scratch JVM harness outside the repository compiled the 17 Android-free files unchanged, with
  all 15 test files (RUN).
  - Results: **196 tests, 0 failures, 0 errors, 0 skipped**. The test task was green in all 5
    executions.
  - JaCoCo coverage of those 17 files: **519/538 lines (96.5%)** and **294/306 branches (96.1%)**.
  - The Android glue cannot be loaded on a plain JVM, so its automated coverage is **0%**.
- M1 device evidence belongs to build `1492c108` (DOC: M1-06, M1-07).
  - That build contains `setUnderlyingNetworks(...)` / `setMetered(false)`, which `main` does not
    (SOURCE + DOC).
  - It predates the M-1 network monitor.
  - The M-1 fix on `main` has "CI PASS on `5382a6c`; device run not recorded" (DOC: M2-02 §C).

**Top 5 verification gaps:**

| # | Gap | Classification | Now / If kept |
|---|---|---|---|
| TG-01 | No recorded device evidence for the exact code on `main`. The M1 evidence is on a different build (`1492c108`), and the M-1 fix was never run on a device. | HUMAN-VERIFIED ONLY (`1492c108`) · UNVERIFIED (`main`) | HIGH / HIGH |
| TG-02 | Android glue (6 files, 1,332 lines) has zero automated execution: service orchestration, DNS worker, upstream socket, network monitor, status bridge, harness UI | UNVERIFIED | MEDIUM / HIGH |
| TG-03 | DNS-only tunnel configuration: no test asserts "single /32 route, no default route" | HUMAN-VERIFIED ONLY | MEDIUM / HIGH |
| TG-04 | Upstream socket safety depends on untested glue: `protect()` before send, `bindSocket`, per-forward Private DNS re-check, cancel | PARTIALLY VERIFIED | MEDIUM / HIGH |
| TG-05 | DNS worker concurrency and timing: self-stop vs external stop, 2 s health check, ~250 ms stop bound, fd ownership, errno handling | UNVERIFIED | MEDIUM / HIGH |

**Does anything block the next stage?** **No BLOCKER was found.**

- The next stage is the M2-03 decision and gate G0. It does not depend on the runtime behaviour of
  this code.
- M2-02 §C already records the provenance and device-evidence gap.
- A8 verification runs without this app in the DNS path.

TG-01 does, however, block two things:

1. honestly calling M-1 "done";
2. making any statement that the code on `main` behaves on a device as `1492c108` did.

If the current code is carried into M3, TG-01 through TG-05 become entry work for M3's verification
strategy.

---

## 2. Production surface inventory

Line counts are physical lines, including comments (SOURCE, `wc -l`). The Android column states
whether the file imports `android.*` or `androidx.*`.

| Package | File | Lines | Android | Role | Origin |
|---|---|---:|---|---|---|
| root | `MainActivity.kt` | 247 | Yes | Development harness: consent flow, Start/Stop, status text, fixed test-domain lookups. Not product UI. | M1-04/05 |
| `domain/protection` | `ProtectionSignals.kt` | 32 | No | Runtime facts (`ServiceLifecycleState`, `FatalError`, `ProtectionSignals`) | M1-02 |
| `domain/protection` | `ProtectionState.kt` | 42 | No | Truthful state model and `DegradedReason` | M1-02 |
| `domain/protection` | `ProtectionStateEvaluator.kt` | 43 | No | Pure evaluator (D8) | M1-02 |
| `domain/rules` | `NormalizedHostname.kt` | 48 | No | Hostname normalization and validation (D9) | M1-03 |
| `domain/rules` | `DomainRule.kt` | 29 | No | Label-suffix block rule | M1-03 |
| `domain/rules` | `RuleDecision.kt` | 26 | No | `Allowed` / `Blocked` / `InvalidInput`, `InvalidReason` | M1-03 |
| `domain/rules` | `RuleSet.kt` | 25 | No | Immutable rule set and evaluation | M1-03 |
| `dns` | `DnsMessageCodec.kt` | 265 | No | Strict one-question codec, synthetic responses, upstream response matching | M1-05 |
| `dns` | `Ipv4UdpDnsPacketAdapter.kt` | 246 | No | IPv4/UDP framing, `Ipv4Address`, `InternetChecksum` | M1-05 |
| `dns` | `DnsFilteringEngine.kt` | 78 | No | Codec + RuleSet → Forward / Respond / Drop | M1-05 |
| `dns` | `DnsPacketProcessor.kt` | 166 | No | Per-packet pipeline, `UpstreamDnsExchange` interface, failure and stop mapping, counters | M1-05 |
| `dns` | `UpstreamDnsSelector.kt` | 111 | No (`java.net` only) | Upstream selection and refusal policy (Private DNS first) | M1-05, M1-07 |
| `dns` | `DnsProxyStatus.kt` | 44 | No | Internal experimental status | M1-05 |
| `dns` | `ExperimentalDnsTestRules.kt` | 26 | No | Temporary controlled rules (`example.com`) | M1-05 |
| `vpn` | `VpnLifecycleController.kt` | 135 | No | Pure lifecycle state machine; `filteringOperational = false` | M1-04/05 |
| `vpn` | `VpnRuntimeFacts.kt` | 35 | No | Facts → public `ProtectionSignals` (`filteringOperational = false`) | M1-05 |
| `vpn` | `CapturedNetworkWatch.kt` | 103 | No | Pure M-1 invalidation policy | M1-07 |
| `vpn` | `LocalProtectionVpnService.kt` | 516 | Yes | `VpnService`: foreground start, preflight, `Builder` / `establish()`, lock discipline, runtime and monitor ownership, teardown, state publication | M1-04/05/07 |
| `vpn` | `DnsProxyRuntime.kt` | 194 | Yes | Single worker thread: `Os.poll` / `read` / `write` on a duplicated TUN fd, health check, self-stop reporting | M1-05 |
| `vpn` | `UnderlyingNetworkDns.kt` | 225 | Yes | `UnderlyingNetworkInspector` (ConnectivityManager facts) and `ProtectedUpstreamDnsExchange` (protected, network-bound UDP socket) | M1-05/07 |
| `vpn` | `UnderlyingNetworkMonitor.kt` | 119 | Yes | Session-scoped `NetworkCallback` registration by API level | M1-07 |
| `vpn` | `VpnRuntimeStatus.kt` | 31 | Yes (Compose runtime) | In-process state bridge to the UI | M1-04/05 |

Non-Kotlin surface (SOURCE):

- **Manifest.** It declares these permissions: `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`, `POST_NOTIFICATIONS`, `INTERNET` and `ACCESS_NETWORK_STATE`.
  - The `VpnService` is `exported="true"`, guarded by `BIND_VPN_SERVICE`, with
    `foregroundServiceType="systemExempted"`.
  - It carries `tools:ignore="ForegroundServicePermission"` and
    `SUPPORTS_ALWAYS_ON = false`.
  - The application sets `allowBackup="false"`.
- **Resources:** `strings.xml` and `themes.xml`.
- **Build:** one module (`:app`) on AGP 8.11.2, Kotlin 2.1.20 and Gradle 8.13.
  - The Gradle wrapper pins a `distributionSha256Sum`.
  - minSdk is 24; compileSdk and targetSdk are 36.
  - The release build type sets `isMinifyEnabled = false`.
  - There is no `lint {}` block and no `lint.xml`.

---

## 3. Test inventory

All tests are local JUnit 4 tests under `app/src/test/`. Counts are `@Test` methods (SOURCE),
matched by the JUnit XML of the harness run (RUN). Times are from the harness (RUN) and are
indicative only.

| Test class | Tests | Subject(s) | Style | Harness time |
|---|---:|---|---|---:|
| `ScaffoldingSanityTest` | 1 | None (`2 + 2`) | Build smoke test only | 0.004 s |
| `domain/protection/ProtectionStateEvaluatorTest` | 12 | `ProtectionStateEvaluator`, `ProtectionSignals` | Truth-table cases, precedence, determinism, and a reflective guard that `ProtectionSignals` has no intent/config field | 0.015 s |
| `domain/rules/NormalizedHostnameTest` | 11 | `NormalizedHostname` | Normalization and rejection cases | 0.003 s |
| `domain/rules/RuleSetTest` | 19 | `RuleSet`, `DomainRule`, `RuleDecision` | Label-boundary matching, defensive copy, diagnostics do not echo input | 0.009 s |
| `dns/DnsMessageCodecTest` | 34 | `DnsMessageCodec`, `DnsQuery` | Parse / unsupported / malformed, synthetic response bits, upstream matching, `toString` redaction | 0.013 s |
| `dns/Ipv4UdpDnsPacketAdapterTest` | 23 | `Ipv4UdpDnsPacketAdapter`, `Ipv4Address`, `InternetChecksum` | Rejection reasons, response construction, IPv4/UDP checksums against an independent reference | 0.017 s |
| `dns/DnsFilteringEngineTest` | 11 | `DnsFilteringEngine`, `ExperimentalDnsTestRules` | Blocked → NXDOMAIN, InvalidInput → REFUSED (never forwarded), Allowed → forward, redaction | 0.066 s |
| `dns/DnsPacketProcessorTest` | 10 | `DnsPacketProcessor`, counters, failure → stop mapping | Fake `UpstreamDnsExchange` | 0.017 s |
| `dns/DnsParserRobustnessTest` | 4 | Codec, adapter, engine | Deterministic fuzzing: 3 × 20,000 seeded inputs plus adversarial name shapes; each test has `timeout = 10_000` | 0.152 s |
| `dns/UpstreamDnsSelectorTest` | 13 | `UpstreamDnsSelector`, `DnsRuntimeStopReason.forRefusal`, `DnsProxyStatus` mappings | Policy table: Private DNS first, validation, usability, loop exclusion, IPv4 preference | 0.016 s |
| `vpn/VpnLifecycleControllerTest` | 31 | `VpnLifecycleController`, plus the evaluator | Transitions, idempotence, sequential models of races, Protected never produced | 0.015 s |
| `vpn/VpnRuntimeFactsTest` | 4 | `VpnRuntimeFacts`, `DnsProxyStatus` | Exhaustive enumeration (lifecycle × tunnel × proxy status × permission): never Protected | 0.001 s |
| `vpn/CapturedNetworkWatchTest` | 18 | `CapturedNetworkWatch` (with `String` as the network identity) | Both callback modes, exactly one stop across all 5,040 orderings of 7 events, stale-session isolation | 0.170 s |
| `vpn/UnderlyingNetworkInvalidationLifecycleTest` | 5 | Controller + `VpnRuntimeFacts` + `DnsProxyStatus.fromRefusal` | Every refusal reason → truthful stop; revoke/stop/self-stop orderings | 0.001 s |
| **Total** | **196** | | | ≈0.5 s |

The helper `dns/DnsTestPackets.kt` builds DNS and IPv4 fixtures and an RFC 1071 reference checksum
independently of the production code. This means the tests do not simply check the code against
itself (SOURCE).

**Instrumentation / Android tests:** none. `app/src/` contains only `main/` and `test/` (SOURCE).
`build.gradle.kts` declares `testInstrumentationRunner`, `androidx.test.ext:junit`, `espresso-core`
and `compose ui-test-junit4`, but nothing uses them (SOURCE).

**Robolectric / mocking:** none. The only test dependency is `junit:junit:4.13.2` (SOURCE).
`architecture.md` (M1-07 Limitations) already records that the Android glue is not unit tested for
this reason (DOC).

---

## 4. Coverage map

"Direct" means a test class exists for the unit. "Indirect" means the unit is exercised only through
another unit's tests. JaCoCo figures come from the harness run with the repository tests only
(RUN, §12.1). A value of 0% means the class could not be loaded on a plain JVM and no
instrumentation test exists.

### 4.1 Android-free code (17 files)

| Unit | Direct tests | Indirect via | Lines | Branches | Classification |
|---|---|---|---|---|---|
| `ProtectionStateEvaluator` | `ProtectionStateEvaluatorTest` | Controller, facts, invalidation tests | 12/12 | 13/13 | **VERIFIED** |
| `ProtectionSignals`, `ProtectionState`, `FatalError`, enums | — (data) | Evaluator tests | ~100%* | n/a | **VERIFIED** (indirect) |
| `NormalizedHostname` | `NormalizedHostnameTest` | `RuleSetTest`, DNS engine tests | 10/12 | 12/16 | **PARTIALLY VERIFIED**: `hashCode` / `toString` are never called, and the bare `"."` input branch and the `equals` non-hostname branch are not exercised (§5, TG-14) |
| `DomainRule` | — | `RuleSetTest`, engine tests | 7/7 | 3/4 | **VERIFIED** (indirect) |
| `RuleSet`, `RuleDecision`, `InvalidReason` | `RuleSetTest` | Engine tests | 100%* | 4/4 | **VERIFIED** |
| `DnsMessageCodec`, `DnsQuery` | `DnsMessageCodecTest`, `DnsParserRobustnessTest` | Engine and processor tests | 97/97 | 102/106 | **VERIFIED**. Untested: the `require(rcode in 0..15)` failure path and one `isResponseTo` length-bound branch |
| `Ipv4UdpDnsPacketAdapter`, `Ipv4Address`, `InternetChecksum` | `Ipv4UdpDnsPacketAdapterTest`, robustness | Processor tests | 100/101 | 64/64 | **VERIFIED** |
| `DnsFilteringEngine` | `DnsFilteringEngineTest` | Processor, robustness | 17/17 | 8/8 | **VERIFIED** |
| `DnsPacketProcessor`, `UpstreamDnsExchange`, result types, counters | `DnsPacketProcessorTest` | — | 37/37 (+ result types) | 16/16 | **VERIFIED** against a fake upstream. The real upstream is not covered (§6). |
| `UpstreamDnsSelector` + fact data classes | `UpstreamDnsSelectorTest` | `CapturedNetworkWatchTest` | 16/16 | 28/28 | **VERIFIED** |
| `DnsProxyStatus`, `DnsRuntimeStopReason` | — | Selector, processor, facts, invalidation tests | 100%* | 9/9 | **VERIFIED** (indirect) |
| `ExperimentalDnsTestRules` | — | `DnsFilteringEngineTest` (last test) | 1/1 | 1/2 | **VERIFIED** (indirect) |
| `VpnLifecycleController` | `VpnLifecycleControllerTest` | Facts, watch, invalidation tests | 41/43 | 13/14 | **VERIFIED** for the decision logic. The "STOPPED but `tunnelEstablished`" branch is unreachable by construction. |
| `VpnRuntimeFacts` | `VpnRuntimeFactsTest` | Invalidation tests | 12/13 | n/a | **VERIFIED** |
| `CapturedNetworkWatch` | `CapturedNetworkWatchTest` | — | 24/24 | 20/20 | **VERIFIED** |
| **Subtotal (harness)** | | | **519/538 (96.5%)** | **294/306 (96.1%)** | |

\* The missed lines in enum and data classes are compiler-generated (`entries` / `valueOf`
accessors). They are not behaviour.

### 4.2 Android framework glue (6 files)

| Unit | Direct tests | Indirect | Automated coverage | Classification |
|---|---|---|---|---|
| `LocalProtectionVpnService` | None | Its **decisions** are delegated to the controller, which is tested. The service's **use** of those decisions is not. | 0% | **UNVERIFIED** (automated) · **HUMAN-VERIFIED ONLY** on `1492c108`, for pre-M-1 behaviour |
| `DnsProxyRuntime` | None | `DnsPacketProcessor`, which it drives, is tested | 0% | **UNVERIFIED** (automated) · HUMAN-VERIFIED ONLY (`1492c108`) |
| `UnderlyingNetworkInspector` / `ProtectedUpstreamDnsExchange` | None | The selector policy it calls is tested | 0% | **UNVERIFIED** (automated) · HUMAN-VERIFIED ONLY (`1492c108`, pre-M-1 selector) |
| `UnderlyingNetworkMonitor` | None | `CapturedNetworkWatch`, which it feeds, is tested | 0% | **UNVERIFIED**. Code added after `1492c108`, with no device run recorded. |
| `VpnRuntimeStatus` | None | — | 0% | **UNVERIFIED** (trivial holder) |
| `MainActivity` | None | — | 0% | **UNVERIFIED** (automated) · HUMAN-VERIFIED ONLY (`1492c108`) · **OBSOLETE IF A8 SELECTED** (replaced by product UI per M2-02 §H.1) |

---

## 5. Verification gaps

### 5.1 Gap register

| ID | Gap | Classification | Now | If kept | Evidence |
|---|---|---|---|---|---|
| **TG-01** | **No device evidence for the code on `main`.** All M1-05 / M1-06 device results are for `1492c108`, which differs at runtime from `main`. `1492c108` has `setUnderlyingNetworks` / `setMetered(false)`; `main` does not. `main` has the M-1 monitor, the stricter selector, and startup refusal on unvalidated or unusable networks; `1492c108` does not. The M-1 fix's device run (rows L5, L6, L8, a basic Start/block/allow check, and the Private DNS stop path, per M1-07 §11) is not recorded. | HUMAN-VERIFIED ONLY (`1492c108`) · UNVERIFIED (`main`) | HIGH | HIGH | SOURCE (`grep`: `setUnderlyingNetworks` / `setMetered` absent); DOC M1-07 §3.3, §11; DOC M2-02 §C ("device run not recorded") |
| **TG-02** | **Android glue has zero automated execution.** 6 files, 1,332 of 2,786 lines (47.8%). No `androidTest/`, no Robolectric. Details in §6. | UNVERIFIED | MEDIUM | HIGH | SOURCE; RUN (harness could not compile these files) |
| **TG-03** | **Tunnel configuration is asserted by no test.** The `Builder` chain (`addAddress(10.111.222.2/32)`, the single `addRoute(10.111.222.1/32)`, `addDnsServer`, `allowFamily(AF_INET6)`, `setBlocking(false)`) is inline in the service. A regression that adds a default route would capture all device traffic and violate D11. No automated check would notice it. | HUMAN-VERIFIED ONLY ("ordinary Internet traffic continued to work"; N1 IPv6 PASS, both on `1492c108`) | MEDIUM | HIGH | SOURCE `LocalProtectionVpnService.kt:164-178`; DOC M1-07 §4.2, M1-06 §8 |
| **TG-04** | **Upstream socket safety is untested.** `ProtectedUpstreamDnsExchange` is untested: nothing is sent if `protect()` returns false; `bindSocket`; `connect()` (kernel-side source filtering); the per-forward Private DNS re-check; the 2 s deadline loop; `cancel()` classification (CANCELLED / IO_ERROR / SOCKET_SETUP_FAILED). Only the selector policy it calls is tested. | PARTIALLY VERIFIED | MEDIUM | HIGH | SOURCE `UnderlyingNetworkDns.kt:136-214` |
| **TG-05** | **DNS worker concurrency and timing are untested.** Untested behaviour: `compareAndSet` so that only self-stops are reported; ownership of the duplicated fd; POLLERR / POLLHUP / POLLNVAL handling; EAGAIN / EINTR retry; the per-packet write-errno allowlist; the catch-all `RuntimeException`; the 2 s health check; the ~250 ms stop bound; counter publication. `SystemClock` is not injectable, so timing is untestable as written. | UNVERIFIED | MEDIUM | HIGH | SOURCE `DnsProxyRuntime.kt` |
| **TG-06** | **Service orchestration is untested.** The controller's decisions are VERIFIED, but the service code applying them is not. Untested: the `synchronized(lifecycle)` discipline; closing the raced `establish()` descriptor; identity guards (`runtime !== dnsRuntime`, `monitor !== networkMonitor`); teardown order (monitor → runtime → fd); the `onDestroy` safety net; the `startForeground` failure path; failing closed when the runtime or monitor fails to start; the refusal / invalidation / stop message mapping. | PARTIALLY VERIFIED | MEDIUM | HIGH | SOURCE `LocalProtectionVpnService.kt` |
| **TG-07** | **Network monitor registration is untested.** Untested: the API ≥ 31 `registerBestMatchingNetworkCallback` path (main-looper handler) vs the `registerNetworkCallback` path; the `capabilityFacts` / `linkFacts` defaults below API 28; unregister idempotence. The source itself flags the initial best-match delivery on API 31+ as "observed behaviour, not stated in the docs". This could stop every session at Start under a per-app network preference (fail-closed). | UNVERIFIED (monitor) · VERIFIED (pure watch) | MEDIUM | HIGH | SOURCE `UnderlyingNetworkMonitor.kt:23-28`; DOC D12 |
| **TG-08** | **"Protected unreachable" is guarded only at today's two construction sites.** Both sites hardcode `filteringOperational = false` and are exhaustively tested. However, `ProtectionSignals` has a public constructor, and no structural test prevents a new call site. `MainActivity`'s use of `toProtectionSignals` is code review only. | PARTIALLY VERIFIED | LOW | MEDIUM (M3 is where `filteringOperational` semantics change) | SOURCE (`grep`: exactly 2 `ProtectionSignals(` constructions; no `filteringOperational = true`); RUN tests |
| **TG-09** | **Log privacy is guarded by code review only.** `toString` redaction is VERIFIED for `DnsQuery`, parse results, filter decisions, processing results and `InvalidInput`. No test or lint rule guards the 15 `Log.*` call sites. This audit reviewed all 15 (§7). | PARTIALLY VERIFIED | LOW | MEDIUM | SOURCE; RUN tests |
| **TG-10** | **Manifest-level properties have no targeted assertion.** Nothing beyond default lint checks: the permission allowlist, `BIND_VPN_SERVICE` on the exported service, `SUPPORTS_ALWAYS_ON = false`, `allowBackup = false`, the absence of `QUERY_ALL_PACKAGES`, and eligibility for the `systemExempted` FGS type (lint suppressed). | PARTIALLY VERIFIED (lint) · HUMAN-VERIFIED ONLY (L4 reboot → not running, `1492c108`) | LOW | MEDIUM | SOURCE manifest; DOC M1-06 §7 |
| **TG-11** | **CI scope limits.** CI runs only on `pull_request` (path-filtered) and `workflow_dispatch`, never on `push` to `main`. It has no instrumentation job and no Kotlin static analysis. The lint gate uses AGP defaults (§8). | Gate facts: VERIFIED (CI) | LOW | MEDIUM | SOURCE workflow; CI run list |
| **TG-12** | **Wall-clock test timeouts and seed stability.** 4 fuzz tests use `timeout = 10_000`; they measured 0.03–0.08 s each (§5.3). The seeded `kotlin.random.Random` sequences may change with a Kotlin upgrade (ASSUMPTION). | VERIFIED (deterministic today) | LOW | LOW | SOURCE; RUN |
| **TG-13** | **Race tests are sequential models.** They prove the controller and watch decide correctly for every modeled ordering. They cannot detect lock-ordering, deadlock or visibility bugs in the real multi-threaded glue. | PARTIALLY VERIFIED | LOW | MEDIUM | SOURCE tests |
| **TG-14** | **`NormalizedHostname` edge cases on the direct API.** Kotlin `lowercase()` folds some non-ASCII characters to ASCII. A probe (RUN) showed `"Kexample.test"` (KELVIN SIGN) normalizes to `kexample.test` and is **Blocked** by a `kexample.test` rule. There is no total-length bound: a 383-character name was accepted (RUN). The bare `"."` input is untested. **None of these is reachable from the DNS path**: the codec accepts only printable ASCII 0x21–0x7E and at most 255 wire octets, which is VERIFIED. | UNVERIFIED (direct API) · OBSOLETE IF A8 SELECTED | LOW | LOW | RUN probe; SOURCE `DnsMessageCodec.kt:143-157` |
| **TG-15** | **Tooling hygiene.** `gradlew` is committed as mode `100644`, so `./gradlew` fails with "Permission denied" on Linux or macOS (RUN); CI works around this with `chmod +x`. The `androidTest` dependencies are declared but unused. `MainActivity` imports `kotlinx.coroutines` without declaring it directly (it arrives transitively). | — | LOW | LOW | RUN; SOURCE |
| **TG-16** | **Evidence preservation.** There is no git tag on `origin` (RUN: `git ls-remote --tags` is empty); M2-02 §H.1 plans a tag before any removal. CI APK artifacts are retained for 7 days. The `m1-07-evidence-synthesis.md` status text still says the M-1 fix is "implemented on a branch", although PR #32 is merged. M2-02 §H.3 already lists that doc update as a separate task, and it is not changed here. | KEEP AS HISTORICAL EVIDENCE | LOW | LOW (MEDIUM once any removal is authorized: tag first) | RUN; SOURCE workflow; DOC |

### 5.2 Behaviour that relies only on HUMAN-REPORTED device testing (Q7)

Unless marked otherwise, every row below was executed on build **`1492c108`**, not on the code on
`main` (DOC: M1-06 §2, M1-07 §3). Only G7 has preserved detail (counter values and a retest
narrative). Every other row rests on the Tech Lead's attestation.

| Behaviour | Source rows | Recorded result | Classification |
|---|---|---|---|
| Consent flow, VPN start/stop/restart, system disconnect | M1-05 acceptance; L1 | PASS | HUMAN-VERIFIED ONLY |
| Blocked domain and subdomain → not resolved; allowed domain resolved; block disappears after Stop | M1-05 acceptance; G1–G4, G7 (detailed), G8; D1, D3 | PASS | HUMAN-VERIFIED ONLY (G7: partly preserved) |
| Ordinary Internet traffic unaffected (DNS-only route) | M1-05 acceptance | PASS | HUMAN-VERIFIED ONLY (see TG-03) |
| State never showed `Protected`; notification never claimed full protection | M1-05; M1-06 §10 | No false claim reported | HUMAN-VERIFIED ONLY (the code-side invariant is VERIFIED, TG-08) |
| Private DNS strict host → truthful refusal, no plaintext downgrade | P1–P4 | UNSUPPORTED (as designed) | HUMAN-VERIFIED ONLY |
| Private DNS Automatic behaviour | G5-W, G5-M, G6, G10, G11 | INCONCLUSIVE (branch not preserved) | UNVERIFIED |
| Private DNS enabled mid-session | P5 | INCONCLUSIVE | UNVERIFIED |
| Browser DoH / Secure DNS bypass | D2, D4, D5 | BYPASS (characterization) | HUMAN-VERIFIED ONLY |
| Swipe from Recents keeps the VPN; force-stop and reboot end it | L3a / L3b / L4 | PASS / UNSUPPORTED / UNSUPPORTED | HUMAN-VERIFIED ONLY |
| Network change stops the session truthfully | L5, L6 (UNSUPPORTED), L8 (INCONCLUSIVE) | Pre-M-1 code | HUMAN-VERIFIED ONLY (pre-M-1) · **UNVERIFIED for the M-1 code on `main`** |
| 30-minute idle soak | L7 | PASS | HUMAN-VERIFIED ONLY |
| IPv6-capable network usable | N1 | PASS | HUMAN-VERIFIED ONLY |
| Browsers already running / pre-existing tabs | G9-C, G9-F, L2 | INCONCLUSIVE | UNVERIFIED |
| Eligibility of the `systemExempted` FGS type for this VPN | Implicit in every run (the service started) | Worked | HUMAN-VERIFIED ONLY (lint suppressed, TG-10) |
| M-1 monitor (API 24–30 and API 31+ paths), stricter startup refusal | — | **Not recorded** | **UNVERIFIED** |

### 5.3 Flaky, time-based and concurrency test risks (Q11)

| Risk | Where | Assessment |
|---|---|---|
| Wall-clock JUnit timeouts | 4 tests in `DnsParserRobustnessTest` (`timeout = 10_000`) | **LOW.** Each measured ≤ 0.08 s (RUN), roughly 125× headroom. JUnit 4 runs a timed test on a separate thread; these tests share no state, so this is harmless. |
| Randomized inputs | Fuzz tests use fixed seeds (`20260924`, `1035`, `791`) | **LOW.** Deterministic by construction: the test task passed in all 5 harness executions. The seeded sequences may differ after a Kotlin stdlib upgrade (ASSUMPTION: the stdlib documents reproducibility per runtime version). Coverage of the inputs would shift, but the test would not flake. |
| Combinatorial loops | `CapturedNetworkWatchTest` (5,040 permutations × 2 modes); `VpnRuntimeFactsTest` (exhaustive enumeration) | **None.** 0.15 s. Deterministic. |
| Real threads, sleeps, clocks | No `Thread`, `sleep`, `currentTimeMillis`, `nanoTime`, `Executor` or latch in any test (RUN `grep`) | **None in the tests.** The production timing (`SystemClock`, `Os.poll` timeouts, 2 s socket deadline) is **untested** rather than flaky (TG-05). |
| Concurrency | Races are modeled as sequential call orderings on `@Synchronized` classes | **Not flaky, but blind** to real interleavings in the glue (TG-13). |
| External network, DNS, Android | None: `InetAddress.getByAddress` is used, which never resolves (SOURCE comments + code) | **None.** |

---

## 6. Android-framework / glue gaps

### 6.1 Per component: what has no objective (automated) coverage (Q4)

| Component | Behaviour with no automated coverage | Best available evidence |
|---|---|---|
| `LocalProtectionVpnService` | `onStartCommand` action routing and the unexpected-action → `stopSelf` path. `startForeground` before `establish()`, and the failure path. The preflight (`activeNetwork` → facts → selector → refusal). The `Builder` configuration (TG-03). The raced-establish descriptor close. Assigning the runtime and monitor under the lock. Failing closed when the runtime or monitor cannot start. Identity guards. `failRunningSession`. Teardown order in `closeTunnel`. `onRevoke` / `onDestroy`. `publishState` content. Notification channel, text and `FLAG_IMMUTABLE` PendingIntent. Diagnostic message mapping. | Code review (this audit and earlier reviews); HUMAN-REPORTED lifecycle rows on `1492c108` |
| `DnsProxyRuntime` | See TG-05. Also: behaviour when the processor throws (the catch-all). The listener callback thread. Worker thread name and start failure. | Code review; HUMAN-REPORTED L7 soak and counters on `1492c108` |
| `UnderlyingNetworkInspector` | The capability mapping, including `isVpn = TRANSPORT_VPN or !NOT_VPN`. The FOREGROUND / NOT_SUSPENDED defaults below API 28. `isPrivateDnsActive` below API 28. Null and `RuntimeException` handling. | Code review |
| `ProtectedUpstreamDnsExchange` | See TG-04. Also: a receive buffer of 65,535 bytes, so responses are never truncated. Response-matching integration (the codec side is VERIFIED). | Code review; HUMAN-REPORTED "upstream failures=0" on `1492c108` |
| `UnderlyingNetworkMonitor` | See TG-07. | Code review only |
| `VpnRuntimeStatus` | Writes to Compose `MutableState` from the worker and binder threads. Counter publication per packet. | Code review only |
| `MainActivity` (harness) | The notification-permission → consent sequencing. Re-checking permission in `onResume`. The system-resolver lookups. The UI renders `ProtectionState.Error.reason` directly, although `ProtectionState`'s KDoc says that reason "must not be rendered to users"; this is acceptable only because this is a harness. | HUMAN-REPORTED (`1492c108`) |

### 6.2 Lifecycle and network races that remain difficult to automate (Q5)

| # | Race / condition | Current evidence | Why it is hard to automate | Feasible approach, only if the code survives |
|---|---|---|---|---|
| R1 | `onRevoke()` on a non-main thread (per the source comment's reading of the platform docs) while `establish()` is in flight | Controller ordering VERIFIED; the service's close of the raced fd is code review only | Needs a real `VpnService` and a controllable binder-thread revoke | Instrumentation with a test hook (a latch between `establish()` and lock acquisition). Needs a seam, so it is an M3 refactor. |
| R2 | A Stop arriving just after a new Start undoes that Start (documented as pre-existing) | DOC (`architecture.md`, M1-07 Limitations) | Intent-delivery timing | Controller-level ordering test (feasible now at the pure level); device soak |
| R3 | DNS worker self-stop vs external `stop()` vs TUN torn down underneath (POLLHUP / POLLNVAL / EBADF) | Code review | Real fd and poll semantics | JVM test with a socketpair/pipe fd abstraction and an injectable clock (M3 refactor) |
| R4 | Network callback thread vs service lock; a stale monitor's report after a new session | Watch VERIFIED (`close()`, per-session isolation); service guard code review only | `ConnectivityManager` callbacks | Robolectric (new dependency → approval) or instrumentation with network toggling |
| R5 | Two detectors (callback vs 2 s worker re-check) racing to set the stop message | Controller: exactly one CloseTunnel, VERIFIED | Real timing | Accept as documented; controller-level test exists |
| R6 | Network lost before callback registration → only the 2 s re-check stops the session | DOC D12; code review | Requires losing the network in a sub-second window | Device test with scripted Wi-Fi toggles (adb) |
| R7 | API 31+ initial best-match delivery differs from the pre-VPN `activeNetwork` (per-app network preference) → immediate stop | Source comment: "observed behaviour, not stated in the docs" | Device, OEM and work-profile dependent | Device matrix row; not automatable in CI |
| R8 | ~1 ms check-then-send window between the per-forward Private DNS check and `send` | DOC (`architecture.md`: pre-existing, unchanged) | Sub-millisecond platform race | Accept as documented; the 2 s re-check and callback are the backstop |
| R9 | `cancel()` closing the socket during `protect` / `bind` / `receive` → failure classification | Code review | Needs real socket and VpnService APIs | Seams for `protect` / `bindSocket` + loopback UDP (M3 refactor) |
| R10 | Process death / force-stop: `VpnRuntimeStatus` resets in memory; `onDestroy` may not run | HUMAN-REPORTED L3b | Process-level | Instrumentation (`am force-stop`) or device |
| R11 | Single worker: a slow upstream delays all DNS by up to 2 s; a local app can exploit this | DOC D11 (known limitation) | Needs a controllable slow upstream | JVM test with a fake slow upstream at the runtime level (after R3's seam) |

---

## 7. Security / privacy verification gaps (Q6)

| Property | How it is verified today | Classification | Now / If kept |
|---|---|---|---|
| Only DNS enters the TUN: a single /32 route and no default route (D11) | Code review of the `Builder` chain; human-reported "ordinary traffic unaffected" | HUMAN-VERIFIED ONLY | MEDIUM / HIGH (TG-03) |
| Only IPv4/UDP to 10.111.222.1:53 is parsed; everything else is dropped without inspection | Unit tests of every rejection reason, plus fuzz | **VERIFIED** | — |
| The parser never crashes or hangs on hostile input; malformed input is never forwarded | Deterministic fuzz (60,000 seeded inputs + adversarial shapes) with a no-forward assertion | **VERIFIED** | — |
| `InvalidInput` names (for example `_x.blocked.example`) are answered REFUSED and never forwarded | Unit test | **VERIFIED** | — |
| Private DNS is never downgraded, at the policy level: Private DNS is checked first | Selector and watch unit tests | **VERIFIED** | — |
| Private DNS is never downgraded, at the wiring level: preflight, per-forward re-check, 2 s re-check, callback | Code review; P1–P4 human-reported on `1492c108` | PARTIALLY VERIFIED | MEDIUM / HIGH (TG-04) |
| No forwarding loop (own addresses excluded) | Selector unit test | **VERIFIED** (policy) | — |
| Upstream socket is `protect()`ed before any send and bound to the captured network | Code review only | UNVERIFIED | MEDIUM / HIGH (TG-04) |
| Upstream responses are accepted only on matching ID, QR, OPCODE and question | Codec unit tests (**VERIFIED**); the connected-socket source filtering is code review | PARTIALLY VERIFIED | LOW / MEDIUM |
| No hostname or payload in logs or diagnostics | `toString` redaction tests (**VERIFIED**); the 15 `Log.*` sites were reviewed by hand in this audit. None interpolates a hostname, payload or address. One logs `intent?.action`. Six pass an exception (stack trace). `DnsProxyRuntime` deliberately omits the exception for packet errors. | PARTIALLY VERIFIED | LOW / MEDIUM (TG-09) |
| No persistence, history, analytics or upload | Code review: no storage APIs, no analytics dependency, `allowBackup = false`. Counters are in memory only. | UNVERIFIED (no automated guard) | LOW / MEDIUM |
| Exported `VpnService` can only be bound or started by the system (`BIND_VPN_SERVICE`) | Manifest review; lint | PARTIALLY VERIFIED | LOW / MEDIUM (TG-10) |
| Always-on / boot start disabled (`SUPPORTS_ALWAYS_ON = false`) | Manifest review; L4 human-reported | HUMAN-VERIFIED ONLY | LOW / MEDIUM |
| Permission set limited to the D11 list; no `QUERY_ALL_PACKAGES` | Manifest review | UNVERIFIED (no automated allowlist) | LOW / MEDIUM |
| `ProtectionState.Protected` unreachable | Tests at both construction sites (**VERIFIED**); UI wiring code review; human-reported | PARTIALLY VERIFIED | LOW / MEDIUM (TG-08) |
| Truthful stop on invalidation (tunnel closed, proxy not RUNNING, `Error` state) | Controller, facts and invalidation tests (**VERIFIED**); service application code review only | PARTIALLY VERIFIED | MEDIUM / HIGH (TG-06) |
| Local DoS through the single worker (a slow upstream delays all DNS by up to 2 s) | Documented limitation (D11) | UNVERIFIED (characterization only) | LOW / MEDIUM |

---

## 8. CI assessment

### 8.1 What CI does (SOURCE: workflow; CI: run list)

- **Workflow:** `.github/workflows/project-04-m1-07-verification.yml`, job
  "Verify M1-07 and build debug APK".
- **Triggers:** `pull_request` with paths `projects/04-muslim-recovery-protection/**` and the
  workflow file itself, plus `workflow_dispatch`. There is **no `push` trigger**.
- **Runtime:** `ubuntu-latest`, Temurin JDK 17, `gradle/actions/setup-gradle@v4`,
  `android-actions/setup-android@v4`, then `sdkmanager "platforms;android-36"` and `chmod +x gradlew`.
- **Command:** `./gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon`.
- **Artifact:** the debug APK, `if-no-files-found: error`, retained for 7 days.
- **Permissions:** `contents: read` only.
- **Run history:** 12 runs, all `pull_request` events.
  - Run #1 (`06b9a9c`) **failed**. The next commit on that branch is titled "fix(04): suppress VPN
    systemExempted lint false positive", which points to the FGS lint false positive. The job log
    was not re-read.
  - Run #2 (`5382a6c`, the PR #32 head) **passed**.
  - Runs #3–#12 passed on PRs titled as documentation changes. Their `android/` trees were not
    checked run by run.

### 8.2 Strengths

- The full real-toolchain gate (assemble + JVM tests + lint) runs on every PR that touches Project 04,
  including documentation PRs. This gives continuous evidence that `android/` still builds against the
  pinned toolchain.
- The Gradle distribution checksum is pinned. Workflow permissions are minimal.
- The build-under-test APK is published from CI, which supports provenance by commit SHA.

### 8.3 Lint and static-analysis gaps (Q12)

| Gap | Fact | Severity (now / if kept) |
|---|---|---|
| No lint configuration | No `lint {}` block and no `lint.xml` (SOURCE). AGP defaults therefore apply: lint **errors** fail `lintDebug`, **warnings do not** (ASSUMPTION: AGP defaults, not re-read). There is no baseline and no `warningsAsErrors`. | LOW / MEDIUM |
| Lint results not archived | Reports are not uploaded, so current warnings cannot be reviewed without a local SDK build. This audit could not run lint (§12). | LOW / LOW |
| One lint suppression | `tools:ignore="ForegroundServicePermission"` on the service. It is justified in a comment, but the property it hides (FGS type eligibility) is then verified only on a device. | LOW / MEDIUM |
| No Kotlin static analysis | No detekt or ktlint (SOURCE; AGENTS.md acknowledges this). No `allWarningsAsErrors`. | LOW / MEDIUM |
| No dependency or security scanning | No Dependabot config, no CodeQL workflow, no dependency-review or vulnerability scan (SOURCE: `.github/`). Repository-level GitHub security settings are not visible from the checkout (UNKNOWN). | LOW / MEDIUM |
| No custom lint for project invariants | For example "no hostname in `Log`" or "`ProtectionSignals` only constructed at approved sites" (TG-08, TG-09). | LOW / MEDIUM |

### 8.4 Are the CI gates sufficient for the current stage? (Q13)

**For the current stage (M2-03 pending, no runtime changes authorized): yes, for what CI claims.**

- It proves that the `android/` tree compiles, the 196 JVM tests pass and lint reports no errors, on
  every PR that touches the project. Nothing in the current stage depends on more than that.

**CI is not sufficient to support any runtime or device claim, and would not be sufficient as an M3
gate if the current code survives.** The specific limits:

| Limit | Consequence | Severity (now / if kept) |
|---|---|---|
| No `push` trigger on `main` | The state after a merge (for example, merge skew between two PRs) is never built on `main` itself. This is mitigated today by the low PR rate and the single maintainer. | LOW / MEDIUM |
| No instrumentation or emulator job | The Android glue (TG-02) never executes in CI | MEDIUM / HIGH (same gap as TG-02) |
| Whether the check is a *required* status check | UNKNOWN: branch protection is not visible from the repository | — (for the Tech Lead to confirm) |
| No test or lint reports uploaded on failure | Diagnosing a failure needs the logs, and rerunning it needs a local SDK | LOW / LOW |
| Actions pinned by major tag, not SHA (including the third-party `android-actions/setup-android`) | Supply-chain hardening | LOW / LOW |
| Workflow and job named "M1-07" | Naming drift; no functional effect | LOW / LOW |
| APK retention of 7 days | The CI artifact for a device run expires. Provenance must rely on the SHA plus a rebuild. | LOW / LOW |

---

## 9. Conditional impact if A8 later wins

This section only restates M2-02 §H.1 dispositions at test level. **Nothing here is authorized.**
Under M2-02, removal would be an M3 task under its own contract, "after tagging the last experiment
commit".

### 9.1 Tests that would become obsolete (Q9)

| Test class | Tests | M2-02 §H.1 disposition of its subject | Classification |
|---|---:|---|---|
| `dns/DnsMessageCodecTest` | 34 | `dns/` removed with `vpn/` | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `dns/Ipv4UdpDnsPacketAdapterTest` | 23 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `dns/DnsFilteringEngineTest` | 11 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `dns/DnsPacketProcessorTest` | 10 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `dns/DnsParserRobustnessTest` | 4 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `dns/UpstreamDnsSelectorTest` | 13 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `dns/DnsTestPackets` (helper) | — | Removed | OBSOLETE IF A8 SELECTED |
| `vpn/VpnLifecycleControllerTest` | 31 | `vpn/` removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `vpn/VpnRuntimeFactsTest` | 4 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `vpn/CapturedNetworkWatchTest` | 18 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `vpn/UnderlyingNetworkInvalidationLifecycleTest` | 5 | Removed | OBSOLETE IF A8 SELECTED · KEEP AS HISTORICAL EVIDENCE |
| `domain/rules/RuleSetTest` | 19 | `RuleSet` "unused … removed unless the gate keeps local lists" | OBSOLETE IF A8 SELECTED (conditional) · KEEP AS HISTORICAL EVIDENCE |
| `domain/rules/NormalizedHostnameTest` | 11 | Same | OBSOLETE IF A8 SELECTED (conditional) · KEEP AS HISTORICAL EVIDENCE |
| `domain/protection/ProtectionStateEvaluatorTest` | 12 | D8 principle kept; signals replaced by Private-DNS facts (M2-02 §F.7) | **Partially** obsolete: the VPN-shaped cases go, and the precedence, determinism and "no intent field" reflective-guard patterns carry over to the §F evaluator's tests |
| `ScaffoldingSanityTest` | 1 | — | No evidence value either way |

In total, 183 of 196 tests (93%) are tied to code M2-02 §H.1 would remove under A8, or to `RuleSet`,
which is removed unless kept. Under A8:

- The CI workflow is "unchanged" per M2-02 §H.1. Its M1-07 naming and APK artifact name would then
  be stale.
- The manifest lint suppression disappears with the service.
- The `androidTest` dependencies stay unused unless the §F prototype adds instrumentation.

### 9.2 Tests to keep as historical M1 evidence, even if code is removed (Q10)

Recommendation only. Keep them **in place at a tag**, not by porting them.

| Test | M1 claim it encodes | Evidence commit |
|---|---|---|
| `VpnRuntimeFactsTest`, `VpnLifecycleControllerTest` (Protected cases) | The experiment could never report `Protected` (D8/D10/D11) | `1492c108` (M1-06 build) and `5382a6c` / `main` |
| `DnsParserRobustnessTest` | The local parser is crash-free and never forwards malformed input (M1-05 acceptance) | Same |
| `DnsFilteringEngineTest` (InvalidInput → REFUSED) | Invalid names are not a way around a block rule | Same |
| `UpstreamDnsSelectorTest` (Private DNS first) | The experiment refused rather than downgraded Private DNS (H11 precursor) | Same |
| `Ipv4UdpDnsPacketAdapterTest` | Only DNS framing was parsed (D11 surface limit) | Same |
| `CapturedNetworkWatchTest`, `UnderlyingNetworkInvalidationLifecycleTest` | The M-1 policy: a stale network stops the session truthfully, exactly once | `5382a6c` / `main` only (not in `1492c108`) |
| `RuleSetTest`, `NormalizedHostnameTest` | D9 label-boundary semantics used in M1 | Both |

Preservation facts:

- There is **no tag on `origin` today** (RUN).
- Two distinct commits carry evidence:
  - **`1492c108`**: the M1-06 device build under test, with its own CI run per DOC. This audit did
    not re-read that run.
  - **Any `main` commit from `4137653` to `6e3349b`**: the `android/` tree is identical to
    `5382a6c`, which passed CI run #2.
- A tag on one does not preserve the other.

---

## 10. Recommended future tests

These are **recommendations for future task contracts**. None is authorized by this report. Several
need a refactor (a seam) or a new test dependency, which requires approval.

### 10.1 If the current `vpn/` / `dns/` code survives into M3 (Q8), in priority order

| P | Test | Closes | Needs |
|---|---|---|---|
| 1 | **Device re-run on the exact `main` build**: M-1 rows L5, L6, L8, Start/block/allow, and the Private DNS stop path, as M1-07 §11 already defines. Artifacts must be preserved (screenshots, counters, logcat without hostnames). | TG-01 | Tech Lead device time; nothing else |
| 2 | **Tunnel-spec test**: extract the `Builder` inputs into a pure value (addresses, routes, DNS servers, families). Assert exactly one `/32` route to the virtual DNS server, no `0.0.0.0/0` or `::/0`, and `AF_INET6` allowed. A thin adapter applies the value. | TG-03 | Small refactor under an M3 contract |
| 3 | **Upstream exchange tests** with seams for `protect` / `bindSocket` and a loopback UDP fake server. `protect` = false → zero datagrams sent. Mismatched responses discarded until the deadline. `cancel` → CANCELLED. Private DNS active → no socket created. | TG-04 | Seam refactor |
| 4 | **DNS worker tests** with an injectable clock and an fd/poll abstraction (socketpair or pipe). An external stop is never reported. A self-stop is reported exactly once. Health-check cadence. Stop latency bound. Errno classification. | TG-05, R3, R11 | Seam refactor |
| 5 | **Service lifecycle tests** (instrumentation or Robolectric). start → establish → stop / revoke / destroy. Raced-establish descriptor closed. Monitor or runtime start failure fails closed. Stale runtime or monitor reports ignored. | TG-06, R1, R4 | Robolectric is a **new dependency (approval)**; instrumentation needs an emulator job and VPN consent (likely `appops ACTIVATE_VPN` on an emulator: ASSUMPTION) |
| 6 | **Monitor API-level tests**: `capabilityFacts` / `linkFacts` at API 24 / 28 / 29 / 31; registration path by SDK. | TG-07 | Robolectric (approval) or a multi-API emulator matrix |
| 7 | **Structural `Protected` guard**: until M3 approves `filteringOperational` semantics, a test fails if `ProtectionSignals` is constructed outside the approved sites or with `true`. When M3 defines semantics, a truth-table test covers every path that can set it `true`. | TG-08 | Source-scan test or custom lint |
| 8 | **Merged-manifest assertion**: permission allowlist, `BIND_VPN_SERVICE`, `SUPPORTS_ALWAYS_ON = false`, `allowBackup = false`, no `QUERY_ALL_PACKAGES`. | TG-10 | Unit test over the merged manifest, or a Gradle check |
| 9 | **Log-privacy guard**: forbid `questionName`, payload or address interpolation in `Log.*`. | TG-09 | Custom lint or source scan |
| 10 | **Message mapping**: refusal, invalidation and stop messages are exhaustive and hostname-free. | TG-06 | Make the mappings testable (they are private today) |
| 11 | **`NormalizedHostname` hardening cases**: non-ASCII input, total length ≤ 253, `"."`. The decision on intended behaviour comes first. | TG-14 | Behaviour decision (D9 owner) |

### 10.2 If A8 is selected

- Write pure JVM tests for the new §F state evaluator (mechanism + coverage + freshness,
  `CHECK_TTL`), as M2-02 §F.7 already requires. Port the D8-style guards: precedence, determinism,
  and the reflective "no intent field" test.
- Add a structural guard so that "Filter Active" can never be produced from saved intent (the TG-08
  pattern).
- Device evidence is defined by M2-02 §E (V0–V17). It is out of scope for this report.

### 10.3 Either way (CI hygiene; each change to the workflow needs approval)

- Add a `push` trigger on `main` for Project 04 paths.
- Upload JUnit and lint reports as artifacts, including on failure.
- Decide on a lint policy: a baseline plus `warningsAsErrors`, or an explicit accepted list.
- Commit `gradlew` with mode `100755`.
- Pin actions by SHA.
- Rename the workflow away from "M1-07".

---

## 11. What should NOT be done yet

- **Do not add Robolectric, mocking or other test dependencies**, and do not add an emulator CI job.
  These are dependency and CI decisions that need approval, and they have low value before M2-03
  decides whether this code survives.
- **Do not refactor the service, worker or upstream classes to add test seams** before an M3 contract
  exists. If A8 wins, that work is thrown away (§9).
- **Do not modify, delete or quarantine any existing test.** Do not remove experiment code before a
  tag exists and a contract authorizes the removal.
- **Do not treat the scratch JVM harness result as a substitute for AGP `testDebugUnitTest` or
  `lintDebug`.** The authoritative real-toolchain evidence remains the CI runs (§8.1).
- **Do not mark M-1 as done, and do not close M1,** on the strength of CI alone (TG-01).
- **Do not re-run M1-06 device rows mechanically.** Re-run only what M1-07 §11 lists as invalidated
  by the M-1 change.
- **Do not change `filteringOperational`, `ProtectionState.Protected` or the evaluator** to
  "improve testability". D8 and H7 govern them.
- **Do not "fix" the `NormalizedHostname` quirks (TG-14) now.** They are unreachable from the DNS
  path, and the code may be removed under A8.
- **Do not update `m1-07-evidence-synthesis.md`, the roadmap or the README from this audit.** Those
  are separate docs tasks (M2-02 §H.3), and the task that produced this report prohibits touching
  them.

---

## 12. Evidence / commands run

### 12.1 Commands actually executed in this audit

The working directory is `projects/04-muslim-recovery-protection/android/` unless noted otherwise.
The environment was a cloud container: Linux, OpenJDK 21.0.10, no Android SDK, outbound traffic
through a policy proxy.

| # | Command | Result |
|---|---|---|
| 1 | `git status`, `git branch -a`, `git log --oneline -15` (repo root) | Clean tree at `6e3349b` |
| 2 | `./gradlew --version` | **`Permission denied`**: `gradlew` is committed as `100644` (`git ls-files -s`) |
| 3 | `sh ./gradlew --version --no-daemon` | Gradle 8.13 downloaded and started (launcher JVM 21.0.10) |
| 4 | `curl -I https://dl.google.com/...` | **CONNECT rejected (403)** by the environment's network policy. Maven Central and `plugins.gradle.org` returned 200. |
| 5 | `sh ./gradlew testDebugUnitTest --no-daemon --console=plain` | **BUILD FAILED in 27 s**: `Plugin [id: 'com.android.application', version: '8.11.2'] was not found` (Google Maven unreachable). **No test executed.** |
| 6 | `sh ./gradlew lintDebug --no-daemon --console=plain` | **BUILD FAILED in 6 s**, same cause. **Lint did not execute.** |
| 7 | `assembleDebug` | **Not attempted.** It would fail at the same plugin-resolution step, and no Android SDK is installed (`ANDROID_HOME` / `ANDROID_SDK_ROOT` unset, no `sdkmanager`). |
| 8 | Scratch JVM harness (see the definition below), `gradle test` | **196 tests, 0 failures, 0 errors, 0 skipped.** The test task was green in 5 executions. Run 2's build then failed only because a JaCoCo dependency download got HTTP 429 from Maven Central; run 3 retried it successfully. |
| 9 | Same harness + JaCoCo 0.8.12 (`jacocoTestReport`, repository tests only) | Lines 519/538 (96.5%), branches 294/306 (96.1%). Per-class figures are in §4.1. |
| 10 | Scratch probe test in the harness (not in the repository; excluded from the coverage in #9) | `NormalizedHostname.of("Kexample.test")` → `kexample.test`, Blocked by a `kexample.test` rule. `"İexample.test"` → null. A 383-character, 6-label name was accepted. A 64-character label was rejected. `xn--` and numeric labels were accepted. |
| 11 | `git fetch origin 5382a6c…`; `git diff --quiet 5382a6c HEAD -- projects/04-…/android .github/workflows`; same for `4137653` | **Identical** trees |
| 12 | GitHub API: list workflow runs for `project-04-m1-07-verification.yml`; list open PRs | 12 runs, all `pull_request`. #1 failure (`06b9a9c`); #2–#12 success (#2 = `5382a6c`). Open PRs: #55, #56 (docs, draft). |
| 13 | `git ls-remote --tags origin` | No tags |
| 14 | `grep` checks over `app/src` | `setUnderlyingNetworks` / `setMetered` absent on `main`. No `filteringOperational = true`. `ProtectionSignals(` constructed in exactly 2 production places. 15 `Log.*` call sites (all reviewed). No `Thread` / `sleep` / clock / executor use in tests. 4 `timeout = 10_000`. No lint, detekt, ktlint, Dependabot or CodeQL config. No `lint` in Gradle files. |

**Harness definition (for reproducibility).**

- The Gradle project lived in the session scratchpad, outside the repository.
- It used Gradle 8.13, the Kotlin JVM plugin 2.1.20 (`jvmTarget` 17) and `junit:junit:4.13.2`, and
  ran on JDK 21.
- `main` sources were the repository's unchanged `domain/**` and `dns/**`, plus
  `vpn/CapturedNetworkWatch.kt`, `vpn/VpnLifecycleController.kt` and `vpn/VpnRuntimeFacts.kt`:
  17 of 23 production files.
- `test` sources were the repository's entire `src/test/java`.

**Differences from the real gate (why this is not AGP evidence).**

- There is no AGP, no `android.jar` and no Android unit-test configuration.
- The Android glue is excluded.
- The runtime was JDK 21, while CI uses 17.
- Lint was not run.

The harness proves that the repository's JVM tests pass against the repository's pure-Kotlin
sources. For the full gate on this exact tree, the authoritative evidence is CI run #2 on `5382a6c`.

### 12.2 Source inspection (read in full during this audit)

- **Production:** all 23 Kotlin files, `AndroidManifest.xml`, `strings.xml` and `themes.xml`.
- **Tests:** all 15 test files.
- **Build:** `build.gradle.kts` (root and app), `settings.gradle.kts`, `gradle.properties`,
  `gradle-wrapper.properties`, `proguard-rules.pro` and `.gitignore`.
- **CI:** the workflow file.
- **Documents** (for context only; not modified):
  - `problem.md`, `requirements.md`, `architecture.md`, `decisions.md`, `roadmap.md`;
  - `m1-06-execution-results.md`, `m1-07-evidence-synthesis.md`;
  - `m2-02-architecture-options.md` (§A, §C, §F.7, §H), `m2-03-architecture-adr.md` (§1–§3);
  - root `AGENTS.md`, `CLAUDE.md` and `docs/QUALITY_GATES.md`.

### 12.3 Assumptions and limitations

- **Lint defaults.** AGP's default lint behaviour (errors fail, warnings do not) is stated from
  general knowledge of AGP; it was not re-read for 8.11.2. This audit could not observe any current
  lint warnings.
- **CI job logs.** CI conclusions were read from the API; the job logs were not re-read. The reason
  run #1 failed is inferred from the title of the next commit on that branch, not from its log.
- **Platform threading.** The claims that `onRevoke()` may arrive off the main thread, and that
  API 31+ best-match callbacks are delivered at registration, come from the production source
  comments. They were not re-verified against platform documentation here.
- **Seeded `Random`.** Stability of seeded `kotlin.random.Random` sequences across Kotlin versions is
  an ASSUMPTION.
- **Branch protection.** Branch protection and required-check settings, and repository-level GitHub
  security features, are not visible from the checkout. They are UNKNOWN.
- **Device evidence.** No device was available. Every device statement is quoted from repository
  documents.
- **Line counts** are physical lines, including comments and KDoc.

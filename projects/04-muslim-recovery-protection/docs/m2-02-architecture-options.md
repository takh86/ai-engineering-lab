# M2-02 — Protection Architecture Options

> **Project:** Muslim Recovery Protection  
> **Milestone:** M2 — Architecture & Truthful Product Claim  
> **Task:** M2-02 — Architecture options assessment ([issue #21](https://github.com/takh86/ai-engineering-lab/issues/21))  
> **Status:** **DRAFT FOR TECH LEAD REVIEW — NO OPTION SELECTED**  
> **Date:** 2026-09-26  
> **Purpose:** Compare, one by one, the protection architectures that M1 evidence justifies, and give
> the Tech Lead a decision matrix for the M2-03 ADR. This document does not rank, choose, approve or
> implement any option.

## 1. Summary for the decision

M1 showed that a DNS-only `VpnService` filter blocks controlled test domains on the standard
plaintext-DNS path (E1). The same filter is bypassed by browser encrypted DNS that the user switches
on (E3), and it cannot run at all while the user has set a Private DNS hostname (E4). Whether it runs
under Android's **default** Private DNS mode is still unresolved (E2).

Comparing the options against that evidence gives three structural findings. They describe the
options; they are not a recommendation.

1. **Of the three DNS-path gaps M1 found (E2, E3, E4), only E2 can be closed inside the DNS layer
   without changing the product's scope.** O2 (encrypted upstream) targets E2. User-configured
   encrypted DNS takes lookups off the path an on-device DNS filter sees (E3 observed; E4 follows
   from D11's refusal rule and R10). Inside the DNS layer it can only be turned from a silent bypass
   into a visible failure (O3). Otherwise the decision has to move off the device's DNS path (O4
   proxy, O5 full tunnel, O6 Accessibility, O9 browser), or the settings have to be locked by owner
   policy (O7). O8 covers E4 by becoming the Private DNS resolver, but not E3.
2. **Every non-privileged option leaves a platform-provided off switch.** For VPN-based options, the
   system dialog's disconnect button and starting another VPN app end protection (R1); for every
   option, so do Settings and uninstalling. Only O7 (Device Owner) restricts these through
   platform-supported means. It costs a factory reset at onboarding, a device-wide failure blast
   radius, and a consent-and-exit design problem. O6 could technically interfere with the Settings
   screens, but the Play policy as reported (R20 †) forbids that outside parental-control and
   enterprise apps. Lifecycle gaps (E5, E6) are engineering work shared by every VPN-based option
   (CC1, CC2), not a difference between them.
3. **The decisive input is therefore M2-01's answer on deliberate self-bypass (T1).** If it is out of
   scope, the viable set narrows to O1 + O2 (or O8). If casual self-bypass is in scope, O3, O4 and O5
   enter, and O6 for supported browsers. If determined self-bypass is in scope, only O7 reaches it,
   and even O7 leaves a factory-reset exit; blocking that exit would conflict with K1 (§8).

The evidence gap with the largest effect on this comparison is **E2**: all five gating rows for
Android's default Private DNS are INCONCLUSIVE, so it is unknown whether O1 can make any claim about
Android's default configuration. Re-running them (I1) needs no code.

---

## 2. Entry state and scope

| Item | State on 2026-09-26 | Consequence for this document |
|---|---|---|
| `main` | `4137653`, which includes PR #32 (the M-1 fix) | Architecture statements refer to current `main` unless stated otherwise |
| M-1 verification | The CI check `Verify M1-07 and build debug APK` (assemble, unit tests, lint) passed on PR #32's head `5382a6c`. The Samsung device procedure in PR #32 is not recorded in the repository. | E6 is "stops truthfully by design; device evidence not recorded" |
| M1-07 | Still reads DRAFT / INCOMPLETE because of M-1. The Tech Lead's M1 → M2 decision is not recorded (M1-07 §13). | This assessment is an M2 input. It does not close M1 and does not edit M1-07. |
| M2-01 | The threat model and product claim are not written yet | M2-01 decisions are carried as explicit open inputs T1–T5 (§5) |
| Device evidence | M1-05/M1-06 evidence is attached to build `1492c108`, not to current `main` (E11) | Evidence is cited with its build |

**In scope:** options tied to at least one M1 observation; their facts, assumptions, unknowns,
trade-offs and evidence gaps.

**Out of scope:** choosing an option (M2-03), final UI wording (M2-01), implementation, mitigations,
a production ruleset, telemetry.

Options that narrow the product's scope are labelled as such (O1, O8, O9). None is presented as an
engineering fix.

### 2.1 Evidence classes

The vocabulary of [M1-06](m1-06-coverage-gate.md) and [M1-07](m1-07-evidence-synthesis.md) is kept:

- **FACT** — read directly from the cited official documentation or source code on 2026-09-26.
- **FACT ‡** — classified from an official page by the Tech Lead during M1-06.
- **HUMAN-REPORTED** — an M1 execution result reported by the Tech Lead
  ([M1-06 results](m1-06-execution-results.md)).
- **†** — known only from a search-engine excerpt or secondary reporting. The AI sandbox could not
  reach the primary page (`support.google.com`, `developers.google.com`, `support.mozilla.org` and
  `chromium.googlesource.com` were blocked). Re-read before relying on it.
- **ASSUMPTION** — inferred, not verified. **UNKNOWN** — must be measured or researched.
- Complexity, performance and maintainability statements are **AI estimates**. Nothing was measured
  for this document.

Row IDs (G, D, P, L, N) are M1-06 rows. "D1"–"D12" on their own are entries in
[`decisions.md`](decisions.md); M1-06 rows are always written as "row D2" and so on.

---

## 3. Inputs

### 3.1 What M1 observed (E1–E11)

| ID | Observation | M1 rows | Class |
|---|---|---|---|
| E1 | Standard plaintext DNS through the VPN is filtered in Chrome, Firefox and Samsung Internet, in normal and private modes, with Private DNS Off and browser DNS settings as found | G1–G4, G7, G8, rows D1 and D3, N1; lifecycle L1, L3a, L7 | PASS (G7 detailed, the others HUMAN-REPORTED) |
| E2 | Under Android's default Private DNS mode (Automatic) it is unresolved whether the filter runs or truthfully refuses. By design (D11) it refuses whenever the underlying network reports Private DNS active, that is, wherever the network's resolver validates DoT. | G5-W, G5-M, G6, G10, G11 | INCONCLUSIVE; stop condition S2 cannot be evaluated |
| E3 | Browser encrypted DNS switched on by the user bypasses the filter | Row D2 (Chrome Secure DNS, chosen provider); rows D4, D5 (Firefox DoH Increased, Max) | BYPASS (characterization), HUMAN-REPORTED |
| E4 | With a Private DNS hostname set by the user, the filter truthfully refuses, so nothing is filtered while it is set. Switching it on mid-session is unresolved. | P1–P4; P5 | UNSUPPORTED; P5 INCONCLUSIVE |
| E5 | Force-stop and reboot end protection, truthfully. Always-on is opted out (D10). | L3b, L4 | UNSUPPORTED |
| E6 | A network change stops the session; there is no handover. The M-1 fix (PR #32) makes every invalidation a truthful stop. | L5, L6; L8 | UNSUPPORTED; L8 INCONCLUSIVE; M-1 device run not recorded |
| E7 | The effect of browsers already running, and of pre-existing connections or caches, is unresolved | G9-C, G9-F, L2 | INCONCLUSIVE |
| E8 | Not measured: deliberate disabling (Stop, the system VPN disconnect, uninstall, another VPN app); non-browser apps with their own DoH or hard-coded resolvers; in-app browsers (WebView, Custom Tabs); other browsers, including browsers with a built-in VPN or proxy; Always-on and lockdown | M1-06 "Not measured" list | UNKNOWN |
| E9 | Deliberate D11 limits: IPv4/UDP DNS only (no TCP DNS, no IPv6 DNS transport); only the question name is filtered (CNAME targets are not); one worker, so a local app can delay every app's DNS by up to 2 s per query; no caching | D11 | FACT (design) |
| E10 | Truthful state held: no false `Protected`; `filteringOperational` is hard-coded false | all rows | HUMAN-REPORTED + FACT (code) |
| E11 | Device and CI evidence is attached to `1492c108`. Current `main` lacks that build's `setUnderlyingNetworks`/`setMetered` and adds the M-1 monitor. | M1-07 §3 | FACT |

### 3.2 Platform and policy facts (R1–R24)

M1-06's findings keep their IDs and classes (A1–A12, C1–C9, F1–F7, SI1–SI2). Those used below are
A6/A7 (Private DNS modes), C1 ‡ (Chrome Secure DNS: default automatic mode; a chosen provider has no
plaintext fallback; unavailable on managed devices), C2–C5 (Chrome's automatic-upgrade rules), F1/F2 ‡
(Firefox DoH levels) and F5 † (Firefox canary domain). New findings:

| ID | Finding | Class | Source |
|---|---|---|---|
| R1 | Only one VPN runs at a time; a new one deactivates the existing one. A system-managed dialog shows the current VPN and "provides a button to disconnect". The network is restored when the VPN's descriptor is closed, including when the app "is crashed or killed by the system". | FACT | [VpnService][vpnservice] |
| R2 | Always-on VPN (API 24+): Android "can start a VPN service when the device boots and keep it running". Apps opt out with `SUPPORTS_ALWAYS_ON=false` (effective from API 27), which this app declares (D10). | FACT | [VPN guide][vpnguide], [VpnService][vpnservice] |
| R3 | "Block connections without VPN" (lockdown) is a switch that the person using the device, or an IT admin, sets in Settings. Non-VPN traffic is then blocked. | FACT | [VPN guide][vpnguide] |
| R4 | `isAlwaysOn()` and `isLockdownEnabled()` (API 29) let the service detect those modes. In lockdown, "apps aren't allowed to bypass the VPN". | FACT | [VpnService][vpnservice] |
| R5 | Unless `allowBypass()` is called, apps cannot "side-step the VPN". | FACT (also A3) | [VpnService.Builder][builder] |
| R6 | `setHttpProxy()` (API 29): the proxy "is only a recommendation and it is possible that some apps will ignore it"; "PAC proxies are not supported over VPNs"; "using a proxy with a split tunnel generally won't work as expected", because on routes the VPN does not handle the proxy may be unreachable. | FACT | [VpnService.Builder][builder] |
| R7 | `excludeRoute()` exists from API 33. | FACT | [VpnService.Builder][builder] |
| R8 | Private DNS contract (API 28). In strict mode, apps doing their own DNS must encrypt every query to the named host, and send only if that host's certificate is valid. In opportunistic mode, they must encrypt to a server from `getDnsServers()`. "System DNS will handle each of these cases correctly, but applications implementing their own DNS lookups must make sure to follow these requirements." | FACT | [LinkProperties][linkprops] |
| R9 | `DnsResolver.rawQuery(Network, byte[], …)` (API 29) sends a raw DNS query on a chosen network through the system resolver. Its documentation does not say whether Private DNS is applied to such queries. | FACT; Private DNS behavior UNKNOWN | [DnsResolver][dnsresolver] |
| R10 | The device-owner method `setGlobalPrivateDnsModeSpecifiedHost()` (API 29) warns that with a VPN the Private DNS resolver "must be reachable both from within and outside the VPN", because otherwise "system traffic to the resolver may not go through the VPN". | FACT | [DevicePolicyManager][dpm] |
| R11 | `setAlwaysOnVpnPackage()` (API 24; device or profile owner) configures an always-on VPN that is "persisted after a reboot", optionally with lockdown. Lockdown "carries the risk that any failure of the VPN provider could break networking for all apps". | FACT | [DevicePolicyManager][dpm] |
| R12 | `DISALLOW_CONFIG_PRIVATE_DNS` (API 29; set by a device owner, or by the profile owner of an organization-owned profile) stops the user changing Private DNS. `DISALLOW_CONFIG_VPN` stops the user configuring or starting VPNs, while the system still starts the owner's always-on VPN. `setUninstallBlocked()` (device or profile owner) blocks uninstalling a package. | FACT | [UserManager][usermanager], [DevicePolicyManager][dpm] |
| R13 | Device-owner provisioning (`ACTION_PROVISION_MANAGED_DEVICE`) "can be sent only on an unprovisioned device"; "If provisioning fails, the device is factory reset." | FACT | [DevicePolicyManager][dpm] |
| R14 | Apps targeting API 24+ trust only system CAs by default. User-added CAs are trusted by default only by apps targeting API 23 and lower. | FACT | [Network security configuration][nsc] |
| R15 | `AccessibilityServiceInfo.isAccessibilityTool()` (API 31) marks a service that is "used to assist users with disabilities". | FACT | [AccessibilityServiceInfo][a11yinfo] |
| R16 | Chrome on Android forces Secure DNS off when it detects a device-owner or profile-owner app, unless the DoH mode is set by enterprise policy. The source notes that "Android policies can only be loaded with owner apps". Parental-control detection exists only on Windows. | FACT (Chromium source) | [`stub_resolver_config_reader.cc`][cr-stub], [`EnterpriseInfo.java`][cr-ei] |
| R17 | Chrome enterprise policies supported on Android: `DnsOverHttpsMode` (Chrome 85+), `IncognitoModeAvailability` (30+), `URLBlocklist` (86+, also Android WebView 86+), `ForceGoogleSafeSearch` (41+) and `SafeSitesFilterBehavior` (116+). The last "uses the Google Safe Search API to classify URLs as pornographic or not" and is tagged `google-sharing`. | FACT (policy definitions) | [Chromium policy definitions][cr-policies] |
| R18 | Chrome enables Encrypted Client Hello by default (pref default `true`, controllable by policy). It queries DNS HTTPS/SVCB records by default and does not require that response to come over secure DNS (`UseDnsHttpsSvcbEnforceSecureResponse` defaults to false). | FACT (Chromium source) | [`ssl_config_service_manager.cc`][cr-ssl], [`net/base/features.cc`][cr-features] |
| R19 | Play: every app using `VpnService` must file a declaration, document the use in its listing, "encrypt all data from the device to the VPN tunnel endpoint", and must not collect personal or sensitive data without prominent disclosure and consent. Tunnels to a remote server are limited to VPN-core apps plus named exceptions: parental control, enterprise management, app usage tracking, device security (including firewalls), network tools, web browsers and operator apps. How these rules apply to a tunnel that ends on the device is UNKNOWN. | † | [Play: VpnService policy][play-vpn] (search excerpt) |
| R20 | Play Accessibility API policy: it must not be used to change settings without permission, or to "prevent the ability for users to disable or uninstall any app or service", unless authorized by a parent or guardian through a parental-control app or by enterprise administrators. Apps not eligible for `isAccessibilityTool` need prominent disclosure and consent. | † | [Play: sensitive permissions and APIs][play-perms] (search excerpt) |
| R21 | Android 13+ "restricted settings": accessibility access for apps sideloaded from APK files is blocked by default until the user allows it in App info. App-store installs are not affected. | † | [Esper][esper-13] (secondary reporting) |
| R22 | Android 17 Advanced Protection Mode blocks and revokes AccessibilityService access for apps that are not flagged as accessibility tools. | † | [The Hacker News][thn-17] (secondary reporting of Android 17 beta) |
| R23 | Google no longer accepts new custom-DPC registrations with Android Enterprise and directs vendors to the Android Management API, which uses Google's own device policy client. | † | [Android Management API: DPC migration][amapi-migration], [Nomid MDM][nomid-dpc] (search excerpts, secondary reporting) |
| R24 | Firefox for Android has had an open extension ecosystem since 2023-12-14. Samsung Internet offers a content-blocker API to third-party apps. Chrome for Android has no public extension channel (ASSUMPTION). | † / ASSUMPTION | [Mozilla Add-ons blog][moz-ext], [Samsung Internet docs][sbrowser-cb] (search excerpts) |

---

## 4. Constraints and approval boundaries

| ID | Constraint | Source | Changeable by |
|---|---|---|---|
| K1 | Privacy-first, opt-in self-protection for consenting adults on their own devices. Not surveillance, parental control or third-party monitoring. | [`problem.md`](problem.md) | Tech Lead (product framing) |
| K2 | `Protected` only from verified runtime facts; every unsupported path is shown truthfully | D8 | Tech Lead |
| K3 | Tests use harmless controlled domains only | D3 | Tech Lead |
| K4 | No backend without a demonstrated need and approval. No existing decision covers third-party data flows; T3 asks. | D5, project `CLAUDE.md` | Tech Lead |
| K5 | Packet-level filtering, TLS interception, AccessibilityService, Device Owner, root and `QUERY_ALL_PACKAGES` need a new review and explicit approval. D11 allows only the DNS `/32` route and DNS framing. | D1, D11, [`requirements.md`](requirements.md) | Tech Lead |
| K6 | Always-on stays opted out until a milestone implements and verifies it | D10 | Tech Lead |
| K7 | No new Gradle modules or dependencies without approval | project and root `CLAUDE.md` | Tech Lead |

---

## 5. Open M2-01 inputs that change the answer (T1–T5)

| ID | Question (owned by M2-01) | Why it changes the comparison | Most affected |
|---|---|---|---|
| T1 | Is deliberate self-bypass in scope? (a) no; (b) casual or impulsive bypass only; (c) determined bypass too | Decides whether E3, E4 and the E8 disable paths are requirements or documented limits | all (§8) |
| T2 | Distribution target: Google Play, another store, or sideloading? | Accessibility (R20–R22) and Device Owner (R13, R23) feasibility depend on it | O6, O7 |
| T3 | Is any off-device data flow acceptable: a third-party resolver, Google Safe Search classification, a project backend? | K1, K4 | O2b, O7 (SafeSites), O8, rule distribution (CC5) |
| T4 | Which Android versions must the claim cover? (minSdk is 24.) | Private DNS exists only from API 28 (D11). Several mechanisms need API 29+ (R4, R6, R9, R12) or API 33+ (R7). | O2, O4, O7, O8, CC4 |
| T5 | Which browsers must the claim cover? | Browser-specific mechanisms cover only named browsers | O4, O6, O9 |

---

## 6. Candidate options

### 6.1 Where each option decides

```text
Where the filter decides                  Options
----------------------------------------  ---------------------------------------------
Device policy: who may change settings    O7  Device Owner
Browser UI or URL                         O6  AccessibilityService, O9 browser-scoped
Connection: hostname, SNI, destination    O4  local HTTP proxy, O5 full-tunnel VPN
DNS lookup on the device                  O1, O2, O3  DNS-only VPN, as in M1
DNS resolver off the device               O8  filtering Private DNS resolver
```

M1's encrypted-DNS gaps take lookups off the on-device DNS path (E3 observed; E4 follows from D11's
refusal rule and R10). Options that decide on another layer are not affected by that path, but each
has its own way around it (see "Residual bypass" in each card).

### 6.2 Screening

| Candidate | Tied to | Result |
|---|---|---|
| O1–O9 | see the cards | **Assessed** |
| X1 TLS interception (local MITM with a user-installed CA) | E3, E4 | **Screened out by AI; kept visible so the Tech Lead can override.** It decrypts all traffic, including banking and messaging, which conflicts with K1 at its core. It is also weak on current Android, because apps targeting API 24+ do not trust user-installed CAs by default (R14). K5 requires a new review. |
| X2 Root-based filtering | E3–E5, E8 | **Screened out.** Needs an unlocked bootloader or root; not a path for ordinary users; K5. |
| X3 OEM enterprise SDKs (for example Samsung Knox) | E4, E5, E8 | **Not assessed.** A possible O7 variant on the target device family; licensing and distribution need separate research. |
| X4 OS parental controls (for example Family Link) | E8 | **Not assessed.** Built around a supervising parent account (ASSUMPTION), which conflicts with K1's self-directed adult framing. |
| X5 Search-level enforcement (SafeSearch through DNS rewriting) | none in M1 | **Outside M2-02.** Not tied to an M1 observation; it could become a later feature of any DNS option. |

### 6.3 Option cards

Each card states what the option is, which M1 observations it addresses or leaves, and an assessment
per criterion. "Core" means the DNS filter an option is layered on (O1 or O2).

#### O1 — DNS-only VPN with a deliberately narrow claim (D11 baseline, hardened)

**What it is.** Keep D11 as it is: the DNS-only split tunnel, plaintext forwarding to the underlying
network's resolver, and a truthful refusal whenever Private DNS is active. Harden it with CC1–CC4
(§6.4). The product claim is narrowed to what this path covers; that narrowing is a product-scope
decision.

**Addresses:** E1; E9 (with CC3); E5 and E6 (with CC1, CC2); E10. **Leaves:** E2 (refuses wherever
DoT validates); E3; E4 (made visible by CC4); E8.

| Criterion | Assessment |
|---|---|
| Coverage | Standard DNS lookups of covered apps (E1). Under Android's default mode it runs only on networks whose resolver does not validate DoT (A8, an M1-06 ASSUMPTION); how many target networks do is UNKNOWN (I1). |
| APIs / permissions | Existing only: a service guarded by `BIND_VPN_SERVICE`; `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`, `POST_NOTIFICATIONS`, `INTERNET`, `ACCESS_NETWORK_STATE` (manifest; D10, D11). CC1 removes the D10 opt-out. CC4's mode detection needs API 29 (R4). |
| Play / distribution | VpnService declaration and listing disclosure (R19 †). Which declared use case fits a self-protection filter is UNKNOWN (I8). |
| Privacy | Sees the DNS question names of covered apps, in memory only; no logging, persistence or upload (D11). No off-device flow. |
| Security | Small, fuzz-tested parsing surface (IPv4, UDP, DNS). A local app can slow every app's DNS (E9) until CC3 adds bounded concurrency. |
| Complexity | Low to medium (AI estimate): CC1–CC4 are bounded additions to existing code. |
| Testability | High: a pure-Kotlin pipeline covered by JVM unit tests; the M1-06 device rows can be reused. |
| Performance / battery | Low (AI estimate): only DNS packets pass through the app. Not measured; L7 (30 min idle) passed without a battery reading. |
| Lifecycle | Today no start at boot, and a stop on network change (E5, E6). CC1 and CC2 can add Always-on and handover. The user can still press Stop, disconnect in the system dialog, or start another VPN (R1). |
| Maintainability | High: no dependencies, no reliance on browser internals. |
| Residual bypass | E3; E4 (refusal); E2 on DoT-validating networks; another VPN app (R1); apps with their own DoH or hard-coded resolvers; IP-literal URLs; pre-existing connections (E7); Stop or uninstall. |
| Truthful claim (draft) | "Blocks listed domains when apps look them up through Android's standard DNS on this device while protection is running. Browser Secure DNS, Android Private DNS and other VPNs are not covered and are shown as unsupported." Final wording belongs to M2-01. |
| Approvals | None new for the base. CC1 revisits D10; each CC3 item needs the approval D11 deferred. |

#### O2 — DNS-only VPN with an encrypted upstream (compatible with Private DNS)

**What it is.** O1's tunnel, but allowed queries leave the device encrypted as the platform contract
requires (R8), so the filter no longer has to refuse when Private DNS is active on the underlying
network. Variants:

- **O2a-sys** — forward the raw query with `DnsResolver.rawQuery()` on the underlying network
  (API 29+, R9) and let the system resolver apply Private DNS. Whether it does is UNKNOWN (I2).
- **O2a-own** — the app's own DoT client: to a resolver from the underlying network's
  `getDnsServers()` in opportunistic mode, or to the strict host with certificate validation in
  strict mode (R8). Also works on API 28.
- **O2b** — encrypted forwarding to one fixed provider. Adds a third-party data flow (T3).

**Addresses:** E2 (primary). E4 only if queries still reach the VPN in strict mode, which R10 makes
doubtful (I2). **Leaves:** E3, E8; E5 and E6 as O1.

Mechanism assumption: under Automatic, Android's DoT probe to the VPN's DNS server (TCP 853 to
`10.111.222.1`, inside the `/32` route) fails, because the tunnel serves only UDP 53. Android then
falls back to plaintext to the VPN, which is the path M1 already filters (ASSUMPTION; I1, I2).

| Criterion | Assessment |
|---|---|
| Coverage | O1, plus networks whose resolver validates DoT under the Android default (ASSUMPTION above). |
| APIs / permissions | No new permission. O2a-sys needs API 29+. O2a-own uses platform TLS (`javax.net.ssl`) and no new library (ASSUMPTION). |
| Play / distribution | As O1. |
| Privacy | O2a keeps the same resolver the device would use without the app, with no plaintext downgrade, as R8 requires. O2b gives a new third party every allowed query (T3). |
| Security | O2a-sys adds no parsing. O2a-own adds a TLS client, strict-mode certificate validation and connection state. |
| Complexity | Medium (AI estimate): DoT framing, connection reuse, timeouts, and a truthful state when the upstream fails. Lower for O2a-sys. |
| Testability | Medium: framing is JVM-testable; TLS and system-resolver behavior need device or integration tests. |
| Performance / battery | Slightly above O1 because of TCP and TLS; connection reuse limits it (AI estimate; not measured). |
| Lifecycle | As O1. |
| Maintainability | High: DoT is a stable IETF standard (RFC 7858), and O2a-sys delegates it to the platform. |
| Residual bypass | As O1 without the E2 refusal. E4 is probably unchanged (R10). |
| Truthful claim (draft) | O1's claim, extended with "also when Android's Private DNS is in its default automatic mode". |
| Approvals | D11 deferred "DNS-over-TLS / Private DNS compatibility". O2b also needs T3. |

#### O3 — Encrypted-DNS denial layer (fail closed), on an O1/O2 core

**What it is.** Turn known encrypted-DNS paths from a silent bypass into a visible failure. The DNS
core answers the bootstrap names of known DoH and DoT services with NXDOMAIN, and answers Firefox's
canary domain so that Firefox's default mode turns DoH off (F5 †). A route variant also sends the
addresses of dedicated encrypted-DNS services into the tunnel and drops them, which goes beyond D11.

**Addresses:** E3 and E4 for **known** endpoints only, by failure rather than by filtering.
**Leaves:** E2 (needs O2); unknown or self-hosted DoH endpoints; apps' own encrypted DNS to unlisted
endpoints; the E8 disable paths.

The expected outcomes are unverified (I3). Chrome with a chosen provider does not fall back to
plaintext DNS (C1 ‡), so browsing would stop until the setting is reverted. Firefox's fallback after
a failed bootstrap, per protection level, is UNKNOWN. If the name of a strict Private DNS host is
denied, the whole device would be left without DNS (ASSUMPTION), and O1's refusal rule would have to
change before the core could run under strict mode at all.

| Criterion | Assessment |
|---|---|
| Coverage | Turns E3 and E4 into failures for known endpoints (ASSUMPTION). A browser that reaches DoH through built-in addresses is not affected by DNS denial (UNKNOWN per browser). |
| APIs / permissions | DNS-only variant: nothing new. Route variant: routes beyond the DNS `/32`, and TCP handling (D11). |
| Play / distribution | Deliberately breaking other apps' encrypted-DNS features may raise policy questions; not reviewed here (I8). |
| Privacy | Overrides privacy settings the user chose (encrypted DNS). This tension with K1 must be weighed explicitly. O2 can restore encryption towards the network's resolver, not towards the user's chosen provider. |
| Security | No new parsing in the DNS-only variant. |
| Complexity | Low for the DNS-only variant, medium for the route variant (AI estimate). |
| Testability | High for the rules; per-browser device tests (I3). |
| Performance / battery | Negligible (AI estimate). |
| Lifecycle | As core. |
| Maintainability | Low to medium: endpoint lists and browser bootstrap behavior drift (an arms race). |
| Residual bypass | Unknown or self-hosted DoH; hard-coded bootstrap addresses; DoH on shared CDN addresses (blocking those addresses would break unrelated sites); VPN or proxy browsers; another VPN app; Stop or uninstall. |
| Truthful claim (draft) | "If a browser or Android is set to use a known encrypted-DNS service, browsing may stop working until that setting is turned off. Unknown encrypted-DNS services are not covered." |
| Approvals | T1 must put user-configured encrypted DNS in scope; the privacy trade-off (K1); the route variant crosses D11. |

#### O4 — VPN-advertised local HTTP proxy, on an O1/O2 core

**What it is.** Keep DNS filtering, and also advertise a loopback HTTP proxy with
`VpnService.Builder.setHttpProxy()` (API 29+). Apps that honour it send `CONNECT host:port`. The
proxy checks the host with the existing RuleSet, refuses blocked hosts, resolves allowed hosts itself
through the core's upstream path, and relays the bytes over protected sockets. Nothing is decrypted.

**Addresses:** E3, and E4 for proxied requests, because a browser that uses a proxy sends the
hostname to the proxy instead of resolving it (ASSUMPTION from HTTP `CONNECT` semantics; I4). For the
same reason ECH does not hide the `CONNECT` hostname (ASSUMPTION). **Leaves:** apps that ignore the
proxy (R6); API 24–28; the E8 disable paths.

| Criterion | Assessment |
|---|---|
| Coverage | Per browser; whether Chrome, Samsung Internet and Firefox honour a VPN-advertised loopback proxy is UNKNOWN (I4). R6 says a proxy with a split tunnel "generally won't work as expected"; a loopback proxy may avoid that problem (ASSUMPTION, I4). That browsers fall back from QUIC to TCP when proxied is an ASSUMPTION (I4). |
| APIs / permissions | `setHttpProxy()` (API 29+); no new permission. |
| Play / distribution | As O1, plus disclosure that browser connections pass through an on-device proxy (R19 †). |
| Privacy | Sees the host and port of every proxied connection, and relays encrypted bytes it cannot read. Must stay in memory, extending D11's privacy rules. |
| Security | A new local listener that every app on the device can reach. It must bind to loopback only, never act as an open relay, parse untrusted request lines, and bound connections and buffers against local denial of service. |
| Complexity | Medium to high (AI estimate): HTTP/1.1 proxying (`CONNECT` and absolute-form requests), keep-alive, timeouts, back-pressure, IPv6, error mapping. |
| Testability | Medium: the proxy core is JVM-testable; browser adherence can only be tested on devices. |
| Performance / battery | Medium to high (AI estimate): every proxied byte is copied through the app. Must be measured (I4). |
| Lifecycle | Tied to the VPN: when the VPN ends, its proxy recommendation ends with it (ASSUMPTION). |
| Maintainability | Medium: a standard protocol, but browsers' proxy behavior can change. |
| Residual bypass | Apps and browsers that ignore the proxy; browsers with their own proxy or VPN; `CONNECT` to IP literals (a policy choice); non-HTTP protocols; another VPN app; Stop or uninstall. |
| Truthful claim (draft) | "In browsers that use Android's VPN proxy setting (tested list), blocked sites are refused even with the browser's Secure DNS on. Browsers and apps that ignore the proxy are not covered." |
| Approvals | D11 (HTTP parsing, a local listener); T4 (API 29+ only). |

#### O5 — Full-tunnel local VPN with metadata-level filtering (no decryption)

**What it is.** Route all IPv4 and IPv6 traffic into the tunnel and forward it through a user-space
network stack over protected sockets. Filter on metadata only: DNS to any resolver on port 53, the
destinations of known DoH, DoT and proxy services, and the TLS or QUIC server name (SNI) where it is
visible. Nothing is decrypted.

**Addresses:** E3 and E4 for known endpoints (ASSUMPTION); hard-coded plaintext resolvers (E8); E9
(TCP DNS and IPv6 fall inside the tunnel). **Leaves:** encrypted DNS to unknown endpoints; hidden
server names; the E8 disable paths.

| Criterion | Assessment |
|---|---|
| Coverage | The broadest of the non-privileged options (ASSUMPTION). Limits: Chrome enables ECH by default and queries DNS HTTPS records — the records that carry ECH configurations — also over insecure DNS (R18). The DNS layer can withhold those records, but a browser using its own DoH still gets them and then hides the real server name (ASSUMPTION). R10 suggests that system Private DNS traffic may not pass through the VPN at all (UNKNOWN). |
| APIs / permissions | Default routes; `excludeRoute()` from API 33 (R7); no new permission (ASSUMPTION). |
| Play / distribution | The VpnService policy with much broader data handling; prominent disclosure and consent for traffic metadata (R19 †). |
| Privacy | Sees the destination, timing and server name of all device traffic, a large step up from DNS names alone. |
| Security | The largest parsing surface of the VPN options: every packet from every app, and every response. User-space stacks are commonly native code, with memory-safety risk (AI estimate). A crash sends all traffic back to the underlying network (R1), so it fails open unless lockdown is on (CC1). |
| Complexity | Very high (AI estimate): TCP and UDP state, MTU and fragmentation, IPv6, QUIC, timeouts; most likely a third-party native stack (K7). |
| Testability | Low to medium: needs extensive device and soak testing. |
| Performance / battery | High (AI estimate): all traffic passes through user space. |
| Lifecycle | As O1, but every defect affects all traffic. |
| Maintainability | Low: protocol evolution (QUIC, ECH, HTTP/3), endpoint lists, a large code base. |
| Residual bypass | ECH with DoH to unknown endpoints; in-app VPNs, proxies or Tor-like tunnels to unlisted endpoints; another VPN app; Stop or uninstall. |
| Truthful claim (draft) | "Checks the destination of most apps' connections on the device. Encrypted DNS to unknown services, hidden server names (ECH) and apps' own VPNs can still bypass it." |
| Approvals | D1 and D11 (packet-level filtering, a default route); K7 (dependency); a privacy review. |

#### O6 — AccessibilityService URL detection

**What it is.** An AccessibilityService reads supported browsers' UI (address bar, title) and
interrupts navigation to blocked hosts.

**Addresses:** E3, E4 and E7 in supported browsers, because it depends on neither DNS nor
connections. **Leaves:** unsupported browsers and apps; the E8 disable paths (see Play below).

| Criterion | Assessment |
|---|---|
| Coverage | Per browser and per version; breaks when a browser's UI changes (ASSUMPTION). |
| APIs / permissions | AccessibilityService, a K5 exclusion. It is not an accessibility tool in the R15 sense. |
| Play / distribution | Prominent disclosure and consent. It must not prevent disabling or uninstalling unless the app is a parental-control or enterprise app (R20 †), so an adult self-protection app cannot use it as an anti-uninstall lock on Play. Sideloaded installs need the user to allow restricted settings (R21 †). On Android 17 with Advanced Protection switched on, access is revoked (R22 †). |
| Privacy | The highest exposure short of TLS interception: the on-screen content of monitored apps. |
| Security | A common malware vector; a flaw in the service would expose screen content. |
| Complexity | Medium per browser adapter, multiplied by browsers and versions (AI estimate). |
| Testability | Low: device or instrumentation tests per browser version. |
| Performance / battery | Medium (AI estimate): processing accessibility events. |
| Lifecycle | Runs while enabled and is not bound to a network. The system rebinds an enabled service after a reboot (ASSUMPTION); behavior after a force-stop is UNKNOWN. The user can switch it off in Settings. |
| Maintainability | Low: browser UIs drift. |
| Residual bypass | Unsupported browsers and apps; UI changes; switching the service off; Advanced Protection. |
| Truthful claim (draft) | "In supported browsers (named versions), opening a blocked site is interrupted. Other browsers and apps are not covered." |
| Approvals | D1 (AccessibilityService); a privacy review; T2. |

#### O7 — Device Owner "managed self-protection" mode

**What it is.** An opt-in mode in which the app is provisioned as Device Owner on a freshly reset
device (R13) and uses owner policies to hold protection in place: an owner always-on VPN with
lockdown (R11), `DISALLOW_CONFIG_PRIVATE_DNS`, `DISALLOW_CONFIG_VPN`, a blocked uninstall (R12), and
Chrome managed policies (R16, R17: DoH mode, Incognito, `URLBlocklist` or `SafeSitesFilterBehavior`).
It does not filter by itself: the core is O1 or O2, or, for Chrome only, Chrome's own filters.

**Addresses:** E3 in Chrome (R16, R17); E4 (R12); E5 (R11, R12); the E8 uninstall, other-VPN and
settings paths (R12). **Leaves:** browsers that Chrome policies do not govern (Firefox and Samsung
Internet: UNKNOWN); apps' own DoH; factory reset.

| Criterion | Assessment |
|---|---|
| Coverage | The strongest against settings-level and uninstall bypass on stock Android (ASSUMPTION). |
| APIs / permissions | Device Owner, a K5 exclusion. The Private DNS lock needs API 29 (R12); the always-on VPN, VPN-configuration and uninstall restrictions exist from API 24 or earlier (R11, R12). |
| Play / distribution | Provisioning only on an unprovisioned device (R13), so onboarding starts with a factory reset. Google no longer registers new custom DPCs (R23 †). How a self-provisioned consumer Device Owner app would be distributed, and whether Play Protect would flag it, is UNKNOWN (I8). |
| Privacy | Owner APIs are device-wide, so the app must limit itself. `SafeSitesFilterBehavior` sends URLs to Google for classification (R17, `google-sharing`). The device shows a managed state (ASSUMPTION). |
| Security | A device-wide blast radius: a defect can lock the user out, and lockdown plus a VPN failure breaks networking for all apps (R11). |
| Complexity | Very high (AI estimate): provisioning, policy management, recovery, OEM variance. |
| Testability | Low: every test cycle needs a reset device or emulator. |
| Performance / battery | Negligible beyond the core (AI estimate). |
| Lifecycle | The strongest: a system-started always-on VPN and a blocked uninstall. |
| Maintainability | Medium to low: enterprise APIs and Google's device-management policy keep changing (R23 †). |
| Consent / exit | Conflicts with K1 unless an exit is designed. Factory reset remains an exit unless it is blocked, and blocking it would remove the consenting adult's way out. Designing the exit is a Tech Lead decision. |
| Residual bypass | Factory reset; unmanaged browsers; apps' own DoH; defects. |
| Truthful claim (draft) | "In managed self-protection mode, protection starts at boot and cannot be switched off from Settings. It ends through [the designed exit] or a factory reset." |
| Approvals | D1 (Device Owner); the K1 consent-and-exit design; T2 (distribution); K4 if a cloud management service is used. |

#### O8 — Delegate to Android Private DNS with a filtering resolver (no VPN)

**What it is.** The app walks the user through setting Android Private DNS to a filtering DoT
resolver, then checks the setting with `LinkProperties.getPrivateDnsServerName()` (R8). The filtering
happens at the resolver: a third-party family-filter service, or a resolver the project runs (a
backend). The app itself filters nothing. This is a product-direction change.

**Addresses:** E2 and E4, by working with the mechanism that defeated the VPN rather than against it;
E5 and E6, because Private DNS is a persistent system setting (ASSUMPTION). Chrome uses the OS
resolver when the strict Private DNS host is not on its provider list (C2, C4). **Leaves:** E3
(browser DoH); the user switching the setting back; apps' own DoH; devices below API 28, which have
no Private DNS (D11).

| Criterion | Assessment |
|---|---|
| Coverage | Every app that uses the system resolver, on API 28+ only (ASSUMPTION for the first part). |
| APIs / permissions | Only reading network state. An ordinary app cannot change Private DNS; that is owner-only (R10). |
| Play / distribution | The lowest exposure: no VpnService and no Accessibility. |
| Privacy | Every DNS lookup leaves the device for the resolver operator (T3). With a project-run resolver, the project holds that data (K4). |
| Security | A very small client. Trust moves to the resolver operator; DoT is authenticated in strict mode (R8). |
| Complexity | Very low for the client; high if the project runs the resolver (AI estimate). |
| Testability | High for the client; resolver behavior can be tested with controlled domains (K3). |
| Performance / battery | The best: no app in the data path. |
| Lifecycle | No runtime to kill; it survives reboot as a system setting (ASSUMPTION). On a network that blocks port 853, strict mode leaves the device without DNS (ASSUMPTION). |
| Maintainability | High for the client; depends on the provider's list and availability. |
| Residual bypass | E3; switching Private DNS off (as easy as pressing Stop); apps' own DoH. |
| Truthful claim (draft) | "Your device's Private DNS is set to [provider]'s filtering service, and the app checks that it stays set. Browsers using their own Secure DNS are not covered." |
| Approvals | T3 and K4 (off-device DNS); a product-direction change. |

#### O9 — Browser-scoped filtering

**What it is.** Narrow protection to a browsing surface the product controls: (a) a filtered in-app
browser, or (b) integrations through browsers' add-on channels, namely Firefox for Android extensions
and Samsung Internet content blockers (R24 †). Chrome for Android has no public extension channel
(ASSUMPTION). This is a product-scope change.

**Addresses:** E3, E4 and E7 inside the controlled surface, through URL-level decisions. **Leaves:**
every other browser and app; switching browsers is the bypass.

| Criterion | Assessment |
|---|---|
| Coverage | Only the controlled browser or the integrated browsers. |
| APIs / permissions | No VpnService and no sensitive permission. |
| Play / distribution | A browser app, or add-on review by Mozilla or Samsung for the integrations. |
| Privacy | Full URLs are visible inside the surface, more detail than DNS names; they must stay in memory. |
| Security | (a) owning a browsing surface and its security expectations; (b) sandboxed by the host browser. |
| Complexity | (a) high; (b) medium per ecosystem (AI estimate). |
| Testability | Good: URL decisions are JVM-testable; UI tests on top. |
| Performance / battery | As any browser; add-ons negligible (AI estimate). |
| Lifecycle | No background service and no network binding. |
| Maintainability | Medium to low: browser feature expectations, or several add-on ecosystems. |
| Residual bypass | Any other browser or app. |
| Truthful claim (draft) | "Filters browsing inside [this app's browser / the supported browsers]. Other browsers and apps are not filtered." |
| Approvals | A product-direction change. |

### 6.4 Cross-cutting modules (any VPN-based option)

| ID | Module | Addresses | Notes and approvals |
|---|---|---|---|
| CC1 | Always-on support, with guidance to switch on "Block connections without VPN"; detection with `isAlwaysOn()` and `isLockdownEnabled()` (API 29+) | E5 reboot (R2); with lockdown on, traffic is blocked while the VPN is down (R3) | The user can still switch both off in Settings. Revisits D10 (K6). Behavior after a force-stop under Always-on is UNKNOWN (I6). |
| CC2 | Automatic network handover | E6 | Replaces D12's stop-on-change. Matters for usability under lockdown. |
| CC3 | DNS-layer gaps: TCP DNS, IPv6 DNS transport, answer and CNAME filtering, bounded concurrency | E9 | D11 deferred each item; each needs its own approval. |
| CC4 | Truthful-state detection: Private DNS mode (R8), Always-on and lockdown (R4), revocation by another VPN (R1) | Makes E2, E4, E5 and parts of E8 visible | Needed by every option to keep K2. It turns silent gaps into visible Degraded or Unsupported states; it prevents nothing. Browser DoH (E3) stays invisible, because no platform API exposes another app's DNS setting (ASSUMPTION). |
| CC5 | Rule source and distribution (the production ruleset) | — | A separate decision for every local-filter option (K3, K4). O7's `SafeSitesFilterBehavior` and O8 delegate classification to a third party instead. |

### 6.5 Decision outcomes that are not architectures

- **N1 — Bounded investigation before choosing.** The investigations are listed in §10.
- **N2 — Change direction or stop.** Both are allowed M2-03 outcomes ([roadmap](roadmap.md)). The M1
  prototype stays as evidence, and no protection claim is made.

---

## 7. Decision matrix

### 7.1 Coverage of the paths M1 observed

Legend: **Yes**; **Partial**; **Fails closed** — the path stops working (browsing or DNS fails)
instead of bypassing; **Visible** — not prevented, but shown truthfully; **No**; **?** — unknown;
**as core** — same as the O1/O2 core it is built on; **n/a** — the path does not arise;
**(A)** — rests on an ASSUMPTION stated in the option's card.

| M1 observation | O1 | O2 | O3 | O4 | O5 | O6 | O7 | O8 | O9 |
|---|---|---|---|---|---|---|---|---|---|
| E2 default Private DNS | No (refuses where DoT validates) | Yes (A) | as core | as core | as core (needs O2 semantics) | n/a | as core | Yes | n/a |
| E3 browser DoH set by the user | No | No | Fails closed for known endpoints (A) | Yes in proxy-honouring browsers (A) | Partial: known endpoints (A) | Yes in supported browsers (A) | Chrome: Yes (R16, R17); others ? | No | Inside the surface only |
| E4 Private DNS host set by the user | Visible (refuses) | ? (I2) | Fails closed (A), after O1's refusal rule is changed | Partial: proxied requests (A) | ? (R10) | Yes in supported browsers (A) | Yes: setting locked (R12) | n/a: the host is the product | Inside the surface only |
| E5 force-stop, reboot | No; Partial with CC1 | as O1 | as core | as core | as core | Partial (A) | Yes (R11, R12) | Yes (A) | n/a |
| E6 network change | Visible stop; handover with CC2 | as O1 | as core | as core | as core | Yes (A) | as core | Yes (A) | Yes |
| E7 pre-existing browser state | ? | ? | ? | ? | ? | Yes (A) | as core | ? | Inside the surface only |

### 7.2 Coverage of unmeasured paths and known limits

| Path | O1 | O2 | O3 | O4 | O5 | O6 | O7 | O8 | O9 |
|---|---|---|---|---|---|---|---|---|---|
| Stop, system disconnect, another VPN (E8) | Visible (CC4) | Visible | Visible | Visible | Visible | Switching the service off: No (R20 †) | Prevented (R12) | Setting switched off: No, but detectable | n/a (switching browsers: row below) |
| Uninstall (E8) | No | No | No | No | No | No (R20 †) | Prevented (R12) | No | No |
| Apps' own DoH or hard-coded DNS (E8) | No | No | Partial: known endpoints | No | Partial: known endpoints, port 53 to any server | No | as core | No | No |
| Other browsers and in-app browsers (E8) | ? (I5) | ? (I5) | ? | ? per browser | Mostly (A) | Per supported browser | Chrome and WebView policies (R17); others ? | As users of the system resolver (A) | No |
| E9 DNS-layer limits | CC3 | CC3 | CC3 | Proxied requests unaffected (A) | Inside the tunnel | n/a | as core | The resolver's job | n/a |

### 7.3 Criteria relative to O1

O1 is the datum. `++` much better than O1, `+` better, `S` same, `−` worse, `−−` much worse, and `?`
where the rating depends on an unknown. Every criterion is phrased so that `+` is better for the
product (for example, "−" under Privacy means more exposure).

These ratings are **AI-proposed judgments** drawn from the cards, not measurements. There are
deliberately **no weights and no totals**: weighting is the Tech Lead's (§7.5), and any cell may be
overwritten.

| Criterion | O1 | O2 | O3 | O4 | O5 | O6 | O7 | O8 | O9 |
|---|---|---|---|---|---|---|---|---|---|
| Coverage of M1 bypasses (E2–E4, E7) | S | + | + | +? | ++? | +? | ++ | + | − |
| Lifecycle (E5, E6) | S | S | S | S | S | S | ++ | + | + |
| Residual bypass surface | S | S | + | +? | + | S | ++ | S | −− |
| API / permission footprint | S | S | S | S | − | −− | −− | ++ | + |
| Play / distribution risk | S | S | −? | S | − | −− | −− | ++ | + |
| Privacy impact | S | S (O2b: −) | − | − | −− | −− | − | −− | − |
| Security risk | S | S (sys) / − (own) | S | − | −− | −− | −− | + | − |
| Implementation complexity | S | − | S | − | −− | − | −− | ++ (third party) / −− (own resolver) | − |
| Testability | S | − | S | − | −− | −− | −− | + | S |
| Performance / battery | S | S | S | − | −− | − | S | ++ | S |
| Maintainability | S | S | − | − | −− | −− | − | + | − |
| Consent and exit (K1) | S | S | S | S | S | S | −− | S | S |
| Strength of the truthful claim it could support | S | + | + | +? | + | S | ++ | S | − |

Notes on cells that are not obvious from the cards:

- O8's `S` under "Consent and exit": the user can switch Private DNS back as easily as pressing Stop.
- O9's `−` under "Coverage": inside the controlled surface E3, E4 and E7 are covered; the rating
  reflects the device-wide coverage lost outside it.
- O7's `−` under "Privacy": owner powers are device-wide even if unused; `SafeSitesFilterBehavior`
  would add a Google data flow (R17).

### 7.4 Approval boundaries each option crosses

| Option | Needs explicit approval of |
|---|---|
| O1 | Nothing new for the base. CC1 revisits D10 (K6); each CC3 item needs the approval D11 deferred. |
| O2 | D11's deferred "DNS-over-TLS / Private DNS compatibility". O2b also needs a third-party data flow (T3). |
| O3 | A new, non-content rule category, and a product decision that user-configured encrypted DNS is in scope (T1). The privacy trade-off (K1). The route variant crosses D11 (routes beyond the `/32`, TCP handling). |
| O4 | D11 (HTTP parsing and a local listener); API 29+ scope (T4). |
| O5 | D1 and D11 (packet-level filtering, a default route); K7 (a user-space network stack, most likely native); a privacy review. |
| O6 | D1 (AccessibilityService); a privacy review; the Play Accessibility declaration (R20 †); T2. |
| O7 | D1 (Device Owner); the consent-and-exit design (K1); a distribution strategy (R23 †, T2); K4 if a cloud management service is used. |
| O8 | K4 and T3 (off-device DNS, third party or own backend); a product-direction change. |
| O9 | A product-direction change (from device level to browser level). |

### 7.5 Tech Lead weighting sheet

| Criterion | Weight (H / M / L) | Notes |
|---|---|---|
| Coverage of M1 bypasses | | |
| Lifecycle | | |
| Residual bypass surface | | |
| API / permission footprint | | |
| Play / distribution risk | | |
| Privacy impact | | |
| Security risk | | |
| Implementation complexity | | |
| Testability | | |
| Performance / battery | | |
| Maintainability | | |
| Consent and exit | | |
| Strength of the truthful claim | | |

---

## 8. How the answer to T1 changes the viable set

| T1 answer | What must then be covered | Options that can meet it | Options that exceed it (cost beyond the requirement) | Options that cannot meet it |
|---|---|---|---|---|
| (a) Self-bypass out of scope: protect ordinary and default configurations; the user can always switch off; gaps are shown truthfully | E1, E2, E5–E7, E9 and the default behaviors in E8; visibility (CC4) of E4 | O1 + O2 with CC1–CC4; O8, if T3 allows off-device DNS | O3, O5, O6, O7 | O9 narrows the scope instead of meeting it |
| (b) Casual self-bypass in scope: a browser or Private DNS setting must not silently bypass protection; determined bypass out | (a), plus E3 and E4 without silent bypass, plus friction on the in-app Stop. The system disconnect stays possible but visible (R1). | O2 + O3 (friction through failure); O2 + O4 (coverage despite DoH in proxy-honouring browsers); O5; O6 in supported browsers | O7 | O1 or O8 alone, because the E3 setting bypasses them silently |
| (c) Determined self-bypass in scope | (b), plus the system disconnect, another VPN, uninstall and factory reset | Only O7 reaches Settings and uninstall. Factory reset stays an exit unless blocked, and blocking it conflicts with K1. | — | O1–O6, O8, O9 |

No option without owner privileges can remove the system dialog's disconnect button (R1). An in-app
delay before Stop adds friction only inside the app.

Logical relations between options (properties, not preferences):

- If I1 shows that the filter refuses under Automatic on the target networks, O1 alone cannot
  support any claim about Android's default configuration, and O2 (or O8) becomes a precondition of
  every DNS-based package. If I1 shows the target networks do not validate DoT, O2's benefit shrinks
  to the networks that do; CC4 keeps that visible.
- O3 and O4 are layers, not alternatives to O1/O2: they need a running DNS core.
- O6's distinct value over O4 and O5 is independence from DNS and connections. Its costs are the
  highest privacy exposure after TLS interception, and platform restrictions that are tightening
  (R21, R22 †).
- O7 is the only option that changes the E8 disable paths from "visible" to "prevented". It does not
  filter by itself and still needs a core.
- O8 interacts with any VPN-based core through E4. Combining them needs I2 first.

---

## 9. Decision packages for the M2-03 ADR

Packages are combinations that make an ADR concrete. They are **not ranked and not exhaustive**.

| Package | Contents | M2-03 outcome | Claim it could support (subject to M2-01 and verification) | Main costs and risks | Leaves out |
|---|---|---|---|---|---|
| PK1 Narrow DNS, hardened | O1 + O2 + CC1–CC4 | Continue with a narrowed DNS-based claim | Standard system DNS lookups, including under Android's default Private DNS mode, while protection runs; unsupported configurations shown | Encrypted upstream; revisiting Always-on; CC3 work | E3, E4, the E8 disable paths |
| PK2 DNS plus circumvention friction | PK1 + O3 and/or O4 | A different architecture, as a bounded prototype | PK1, plus "known encrypted-DNS settings do not silently bypass" and/or "proxy-honouring browsers are covered despite Secure DNS" | The privacy trade-off (O3); the proxy's attack surface and battery cost (O4); endpoint-list upkeep | Unknown DoH endpoints, apps that ignore the proxy, the disable paths |
| PK3 Full-tunnel metadata filter | O5 with O2 semantics + CC1–CC4 | A different architecture, as a bounded prototype | Most connections' destinations checked on the device, with named gaps (ECH with unknown DoH, other VPNs) | Very high complexity, battery cost, privacy exposure, a dependency | The disable paths |
| PK4 Managed self-protection mode | O7 with a PK1 core and Chrome policies | Product or platform direction change (an opt-in mode on a reset device) | Protection starts at boot and cannot be switched off from Settings without the designed exit | Factory-reset onboarding; distribution (R23 †); blast radius; consent-and-exit design | Unmanaged browsers and apps; factory reset |
| PK5 Delegate to a Private DNS resolver | O8 + CC4-style verification | Direction change | "Device DNS goes to filtering service X, and the app verifies the setting" | Off-device DNS data flow (T3, K4) | E3; the settings toggle |
| PK6 Browser-scoped | O9 | Direction change | "Filtering inside this browser or integration only" | Browser engineering, or several store ecosystems | All other browsers and apps |
| PK7 Investigate first | N1: I1–I8 | More investigation required | None yet | Time; the experimental builds need approval | — |
| PK8 Stop or change product | N2 | Stop the approach | None | — | — |

---

## 10. Evidence gaps and bounded investigations

| ID | Question | Method | Resolves | Informs | Code / approval |
|---|---|---|---|---|---|
| I1 | Does the filter run or refuse under Android's default Private DNS on the target networks? | Re-run G5-W, G5-M, G6, G10 and G11 on current `main`, recording the `dumpsys` Private DNS lines before Start and after SBA; add one network whose resolver validates DoT | E2; E11 for the current build | O1 vs O2; PK1 | None; device time only |
| I2 | Under strict and automatic Private DNS, do queries still reach the VPN's DNS server? Does `DnsResolver.rawQuery()` on the underlying network apply Private DNS? | An experimental build that forwards with `rawQuery()` (API 29+) instead of refusing; harmless domains; counters plus `dumpsys` | E4; R9 | O2's scope; O3; O8 combined with a VPN core | Experimental build; approval needed (D11's deferred item) |
| I3 | What happens in rows D2, D4, D5 and P1 when the bootstrap names of known encrypted-DNS services (and the Firefox canary, F5 †) are denied? | An experimental rule set containing resolver hostnames only (harmless, K3); re-run rows D2, D4, D5 and P1 | E3; E4; F5 | O3 | Rule change in an experimental build; approval needed |
| I4 | On API 29+, do Chrome, Samsung Internet and Firefox use a VPN-advertised loopback proxy, with Secure DNS on? Do they fall back from QUIC to TCP? What does relaying cost? | A minimal experimental proxy that refuses only the blocked test domain and relays the rest; no logging | E3 through O4; R6 | O4 | Experimental build; approval needed (D11: HTTP parsing) |
| I5 | What do the unmeasured default paths do? | Current build and harmless domains: other browsers (for example Edge, Brave, Opera, DuckDuckGo), a Custom Tabs flow, a WebView in-app browser, one non-browser app | E8 | M2-01 claim wording; all options | None; device time only |
| I6 | How do Always-on and lockdown behave? | An experimental build without the D10 opt-out: reboot, force-stop, app update, lockdown with the VPN down, network change under lockdown | E5; E6 | CC1; CC2 | Approval needed (D10 revisit) |
| I7 | Can M1 be closed formally? | Run PR #32's device procedure (rows P, M, S, R, PD, X) on `main`; update M1-07; record the M1 → M2 decision | E6; E11; the M2 entry criteria | all | None |
| I8 | Does the product fit Play policy? | The Tech Lead reads the Play Console VpnService declaration categories and the Accessibility and device-owner policies directly (the AI could not reach them) | R19–R23 † | O1–O7 | None |

I1, I5, I7 and I8 need no code. I2, I3, I4 and I6 need experimental builds, which this document does
not authorize.

---

## 11. Tech Lead decision

Decisions the M2-03 ADR needs from this assessment:

- [ ] T1: scope of deliberate self-bypass (with M2-01)
- [ ] T2: distribution target
- [ ] T3: which off-device data flows, if any, are acceptable
- [ ] T4: Android versions the claim must cover
- [ ] T5: browsers the claim must cover
- [ ] Criterion weights (§7.5), and any rating in §7.3 to overwrite
- [ ] A package or outcome (§9), or another combination
- [ ] Which approval boundaries (§7.4) are accepted
- [ ] Which investigations (§10) are authorized before, or instead of, M3

### Tech Lead decision record

**Decision:** Pending  
**Date:** Pending  
**Rationale:** Pending

---

## 12. AI contribution and verification boundary

AI (Claude) contributed:

- reading the project documents and the M1 evidence;
- platform research in the Android reference documentation and the Chromium source (through its
  GitHub mirror);
- the option cards, matrices, packages and investigation list in this draft.

AI did not:

- select, rank or approve an option — §7.3 contains per-criterion judgments without weights or
  totals, and §9's packages are unranked;
- run any device test or measure performance or battery;
- read the Play policy pages or Google's enterprise pages directly (blocked; marked †);
- obtain an independent review of this document.

Verification performed: each E row was checked against
[`m1-06-execution-results.md`](m1-06-execution-results.md) and
[`m1-07-evidence-synthesis.md`](m1-07-evidence-synthesis.md); each R row not marked † was checked
against its source on 2026-09-26; relative links were checked. An independent review of §3.2 and §7
(for example by another model, per [`AI_ROLES.md`](../../../docs/AI_ROLES.md)) is advisable before
the ADR.

---

## 13. Sources

Android developer reference, read directly on 2026-09-26:

- [VpnService][vpnservice], [VpnService.Builder][builder], [VPN guide][vpnguide]
- [LinkProperties][linkprops], [DnsResolver][dnsresolver]
- [DevicePolicyManager][dpm], [UserManager][usermanager]
- [Network security configuration][nsc], [AccessibilityServiceInfo][a11yinfo]

Chromium source, `main` branch through the GitHub mirror, read on 2026-09-26:

- [`chrome/browser/net/stub_resolver_config_reader.cc`][cr-stub]
- [`components/policy/android/java/src/org/chromium/components/policy/EnterpriseInfo.java`][cr-ei]
- [`chrome/browser/ssl/ssl_config_service_manager.cc`][cr-ssl], [`net/base/features.cc`][cr-features]
- [`components/policy/resources/templates/policy_definitions/Miscellaneous/`][cr-policies]
  (`DnsOverHttpsMode`, `IncognitoModeAvailability`, `URLBlocklist`, `ForceGoogleSafeSearch`,
  `SafeSitesFilterBehavior`)

Known only from search-engine excerpts or secondary reporting (†, not verified):

- [Play Console Help: VpnService policy][play-vpn]
- [Play Console Help: permissions and APIs that access sensitive information][play-perms]
- [Esper: Android 13 restricted settings][esper-13]
- [The Hacker News: Android 17 accessibility restriction][thn-17]
- [Android Management API: migrating custom DPC devices][amapi-migration]
- [Nomid MDM: the end of custom DPCs][nomid-dpc]
- [Mozilla Add-ons blog: open extensions on Firefox for Android][moz-ext]
- [Samsung Internet: content blockers][sbrowser-cb]

M1-06 sources (A-, C- and F-rows) are listed in [`m1-06-coverage-gate.md`](m1-06-coverage-gate.md#sources).

[vpnservice]: https://developer.android.com/reference/android/net/VpnService
[builder]: https://developer.android.com/reference/android/net/VpnService.Builder
[vpnguide]: https://developer.android.com/develop/connectivity/vpn
[linkprops]: https://developer.android.com/reference/android/net/LinkProperties
[dnsresolver]: https://developer.android.com/reference/android/net/DnsResolver
[dpm]: https://developer.android.com/reference/android/app/admin/DevicePolicyManager
[usermanager]: https://developer.android.com/reference/android/os/UserManager
[nsc]: https://developer.android.com/privacy-and-security/security-config
[a11yinfo]: https://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo
[cr-stub]: https://github.com/chromium/chromium/blob/main/chrome/browser/net/stub_resolver_config_reader.cc
[cr-ei]: https://github.com/chromium/chromium/blob/main/components/policy/android/java/src/org/chromium/components/policy/EnterpriseInfo.java
[cr-ssl]: https://github.com/chromium/chromium/blob/main/chrome/browser/ssl/ssl_config_service_manager.cc
[cr-features]: https://github.com/chromium/chromium/blob/main/net/base/features.cc
[cr-policies]: https://github.com/chromium/chromium/tree/main/components/policy/resources/templates/policy_definitions/Miscellaneous
[play-vpn]: https://support.google.com/googleplay/android-developer/answer/12564964
[play-perms]: https://support.google.com/googleplay/android-developer/answer/16585319
[esper-13]: https://www.esper.io/blog/android-13-sideloading-restriction-harder-malware-abuse-accessibility-apis
[thn-17]: https://thehackernews.com/2026/03/android-17-blocks-non-accessibility.html
[amapi-migration]: https://developers.google.com/android/management/dpc-migration
[nomid-dpc]: https://www.nomidmdm.com/en/blog/the-shift-to-amapi-navigating-the-end-of-custom-dpcs-in-android-enterprise
[moz-ext]: https://blog.mozilla.org/addons/2023/12/14/a-new-world-of-open-extensions-on-firefox-for-android-has-arrived/
[sbrowser-cb]: https://samsunginternet.github.io/docs/content-blockers

# M1-06 DNS Coverage & Bypass Validation

**Status:** Draft validation gate. Not executed. Measures behavior only; it implements no mitigation
and changes no architecture. Execution requires Tech Lead approval of this document (see
[Decisions required before execution](#decisions-required-before-execution)).

## Purpose

Answer, with device evidence:

> Does the DNS-only filtering approach meaningfully work across normal Android and browser
> configurations, and where can it be bypassed?

A bypass is a valid engineering result. It is recorded and escalated, never fixed, hidden or
reclassified inside M1-06 (D1, `requirements.md` → Success / stop criteria).

## Preconditions

| # | Precondition | If not met |
|---|---|---|
| P1 | The build under test is the M1-05 DNS-only experiment: Draft PR #11, branch `feat/04-m1-05-mobile-fixes` at `ddabe8a` (or its merged successor). Record the exact commit. **M1-05 is not merged to `main`**; nothing here assumes it is. | Do not start. |
| P2 | M1-05's own gates have passed on the desktop: `.\gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon` and the M1-05 device plan A–H. Otherwise no M1-06 failure can be attributed. | Do not start. |
| P3 | The Tech Lead has confirmed `BLOCKED_TEST_DOMAIN`, `BLOCKED_TEST_SUBDOMAIN` and `ALLOWED_TEST_DOMAIN` (decision H1). | Do not start. |
| P4 | Physical Samsung device. No other VPN, DNS, ad-block or "security" app active. No work profile, MDM or device owner (Chrome disables Secure DNS on managed devices, which would distort results). | Remove it, or record it and mark affected rows INCONCLUSIVE. |
| P5 | Chrome, Firefox and Samsung Internet updated to current stable from the store. Versions recorded. | Record the actual versions. |
| P6 | Networks: N-W = the normal home Wi-Fi; N-M = mobile data (SIM). Record for each whether it has IPv6. | Rows needing a missing network are NOT RUN (with the reason). |
| P7 | A desktop with `adb`, for **read-only** evidence commands only. | Use Settings screenshots instead. |

Harmless controlled domains only. Never use, type, reference or record real adult-content domains
(D3). Below, `<TID>` is the test ID; the query string `?m106=<TID>` defeats HTTP caches and is
ignored by the harmless test site.

## Threat / coverage question

The DNS-only experiment can see a lookup only if it is a plaintext DNS query that the device sends
to the VPN's DNS server `10.111.222.1` (IPv4/UDP). Any lookup that does not follow this path goes
around it. M1-06 measures each such path under realistic settings:

| Path around the filter | How it arises | Measured by |
|---|---|---|
| Browser DNS-over-HTTPS | The browser's own Secure DNS / DoH, whether on by default or turned on by the user | G1–G8, D1–D5 |
| Android Private DNS (DoT) | Automatic (the Android default) or a provider hostname | G5, G6, P1–P5 |
| Cached lookups or reused connections | The browser resolved the domain or connected to it before the filter started | L2 |
| Lifecycle gaps | Restart, app kill, reboot or network change leaves the filter stopped or stale | L1, L3a–L6 |
| IPv6 | IPv6 underlying network or IPv6 DNS servers | N1 |

Two bypass classes are kept separate:

- **Passive** means the Android and browser settings are as found or are the defaults. A passive
  bypass is **gating**.
- **User-configured encrypted DNS** means the user turns on a browser's DoH or sets a Private DNS
  hostname. These rows are **characterization**. Whether bypass by the user themself is in scope
  for this product's threat model is a Tech Lead decision (H2), taken before execution.

## Verified platform facts

Researched 2026-09-25. **FACT** means the source says it. **ASSUMPTION** means it is inferred and
not verified on the device. **UNKNOWN** means it must be tested.

Official Google and Mozilla help and blog pages marked † could not be reached from the research
sandbox. Their content comes from search-engine excerpts of those pages, so re-read them before you
rely on them. Chromium findings come from the source on its `main` branch; the installed Chrome can
differ, including through server-side field trials.

### Android

| ID | Finding | Class | Source |
|---|---|---|---|
| A1 | `addDnsServer`: "If none is set, the DNS servers of the default network will be used." M1-05 sets only `10.111.222.1`. | FACT | [VpnService.Builder][builder] |
| A2 | `allowFamily`: without an IPv6 address, route or DNS server, IPv6 traffic "will then typically fall-through to the underlying network". M1-05 allows IPv6 but has no IPv6 route and no IPv6 DNS server. | FACT | [VpnService.Builder][builder] |
| A3 | With no allowed or disallowed app list, "all applications are allowed by default", so the browsers are VPN-covered apps. Without `allowBypass()`, apps cannot "side-step the VPN" through `bindProcessToNetwork`. | FACT | [VpnService.Builder][builder] |
| A4 | Only one VPN runs at a time. "The network is restored automatically when the file descriptor is closed", including when the VPN app "is crashed or killed by the system". | FACT | [VpnService][vpnservice] |
| A5 | Always-on keeps a VPN "persisted after device reboot and app upgrade". Apps opt out with `SUPPORTS_ALWAYS_ON=false`, which M1-04/M1-05 declare (D10). There is no boot receiver in the manifest. | FACT (docs + manifest) | [VpnService][vpnservice], [VPN guide][vpnguide] |
| A6 | `isPrivateDnsActive()`: while Private DNS is in use, "applications must not send unencrypted DNS queries". A non-null `getPrivateDnsServerName()` means strict mode; null while active means opportunistic mode. | FACT | [LinkProperties][linkprops] |
| A7 | Private DNS modes are Off, Automatic (opportunistic DoT to the network's resolver, with fallback to plaintext) and provider hostname (strict). Automatic is the platform default. | FACT † | [Android Developers Blog 2018][dotblog] † |
| A8 | M1-05 refuses to start, or stops, whenever the underlying network reports Private DNS active. So in **Automatic** mode it refuses on networks whose resolver validates DoT and runs on the others. | ASSUMPTION (M1-05 design, Draft PR #11; not device-verified) | D11 on the M1-05 branch |
| A9 | Samsung's as-shipped Private DNS mode, and whether a given home network validates DoT | UNKNOWN (record as found) | — |
| A10 | A Wi-Fi reconnect or a Wi-Fi → mobile switch makes M1-05 stop truthfully (it has no handover) | ASSUMPTION (M1-05 documented limitation) | PR #11 |
| A11 | Swiping the app out of Recents leaves the foreground VPN service running. Force-stop tears it down (A4). | ASSUMPTION (swipe); FACT (force-stop → A4) | — |

### Chrome Android

| ID | Finding | Class | Source |
|---|---|---|---|
| C1 | Secure DNS is on by default in **automatic** mode. Path: Settings → Privacy and security → Use secure DNS. It is unavailable when the device is managed or parental controls are on. | FACT † | [Chrome Help][chromehelp] † |
| C2 | Automatic mode upgrades to DoH only when a system nameserver IP matches Chrome's built-in provider list. Under strict Android Private DNS, it upgrades only when the DoT hostname matches that list. | FACT (source) | `net/dns/dns_client.cc`, `net/dns/public/doh_provider_entry.cc` |
| C3 | Chrome reads its nameservers and Private DNS state from the **active network's** `LinkProperties`. Its built-in resolver is on by default on Android. | FACT (source) | `AndroidNetworkLibrary.getDnsStatus`, `net/base/features.cc` (`kAsyncDns`) |
| C4 | Chrome's built-in plaintext resolver is not used while Private DNS is active. Chrome then uses the OS resolver. | FACT (source) | `dns_client.cc` `CanUseInsecureDnsTransactions` |
| C5 | A newer "automatic with DoH fallback" option falls back to `8.8.8.8`'s DoH. It is **not applied when a nameserver is non-public** (such as `10.111.222.1`) unless `kDohFallbackAllowedWithLocalNameservers`, which is off by default, is enabled. | FACT (source) | `dns_client.cc`, `stub_resolver_config_reader.cc` |
| C6 | As a VPN-covered app, Chrome sees the nameserver `10.111.222.1`, which matches no provider and gets no fallback. So its lookups reach the filter in plaintext. | ASSUMPTION (follows from C2–C5 and A3) | Must test: G1 |
| C7 | Incognito uses the same Secure DNS configuration as normal mode | UNKNOWN | Must test: G2 |
| C8 | The installed version and its field trials match Chromium `main` | UNKNOWN | Record the version; G1, D2 |

### Firefox Android

| ID | Finding | Class | Source |
|---|---|---|---|
| F1 | The DoH levels are Default Protection, Increased Protection, Max Protection and Off. Path: Settings → Privacy and security → DNS over HTTPS. | FACT † | [Mozilla Support][ffdoh] † |
| F2 | Default Protection "lets Firefox for Android select a DoH server automatically in specific regions when available" and falls back to the default resolvers when there are problems. | FACT † | [Mozilla Support][ffdoh] † |
| F3 | Firefox 143 (Sep 2025) let users opt in (Increased Protection). Mozilla said it planned a later on-by-default rollout in some regions. | FACT † | [Mozilla Blog][ffblog] † |
| F4 | Whether Default Protection currently turns DoH on for this device's version and region | UNKNOWN | Must test: G3, G4 |
| F5 | Mozilla documents a network "canary domain" (`use-application-dns.net`) that disables DoH in Firefox's default mode. Its behavior on Android is UNKNOWN. **M1-06 does not use or emulate it** (that would be mitigation). It is listed only as input for the architecture review. | FACT † / UNKNOWN (Android) | [Mozilla Support][ffcanary] † |
| F6 | Private Browsing uses the same DoH setting | UNKNOWN | Must test: G4 |
| F7 | With DoH Off, Firefox uses the OS resolver and is therefore filtered | ASSUMPTION | Must test: D3 |

### Samsung Internet (added: the default browser on the target device)

| ID | Finding | Class |
|---|---|---|
| S1 | Whether it has its own Secure DNS / DoH setting, and its default | UNKNOWN. Record in Settings during preparation. |
| S2 | Secret mode's DNS behavior | UNKNOWN. Must test: G8. |

## Unknowns requiring device testing

U1 = C6/C8, Chrome's DNS path under the VPN (G1, D1, D2). U2 = C7, Chrome Incognito (G2).
U3 = F4/F6, Firefox Default Protection and Private Browsing (G3, G4). U4 = S1/S2, Samsung Internet
(G7, G8). U5 = A8/A9, whether the Android default (Automatic) lets the experiment run on each
network (G5, G6). U6 = A10/A11, lifecycle and network change (L1–L6). U7 = the IPv6 path (N1).
U8 = how long a browser's pre-existing cache or connection keeps a domain reachable (L2).

## Test matrix

**Gate** column:

- **G** = gating. A BYPASS triggers S1. An UNSUPPORTED in G1–G8 triggers S2.
- **G-b** = gating for BYPASS only. An UNSUPPORTED (a truthful stop) is reported as a coverage gap.
- **C** = characterization. The result is reported in full but does not trigger a stop by itself
  (see H2).

The "Expected" column is a **hypothesis** with its basis. It is not the pass criterion.

| ID | Req # | Browser / mode | Private DNS | Browser DNS setting | Network | Gate | Expected (basis) |
|---|---|---|---|---|---|---|---|
| G1 | 1 | Chrome normal | Off | as found (default automatic) | N-W | G | PASS (C6) |
| G2 | 2 | Chrome Incognito | Off | as found | N-W | G | PASS (C7 unknown) |
| G3 | 3 | Firefox normal | Off | as found (default) | N-W | G | UNKNOWN (F4) |
| G4 | 4 | Firefox Private | Off | as found | N-W | G | UNKNOWN (F4, F6) |
| G5-W / G5-M | added | Chrome normal | **Automatic** | as found | N-W, then N-M | G | UNSUPPORTED if the network validates DoT, else PASS (A8) |
| G6 | added | Firefox normal | **Automatic** | as found | N-W | G | as G5, plus F4 |
| G7 | added | Samsung Internet normal | Off | as found | N-W | G | UNKNOWN (S1) |
| G8 | added | Samsung Internet Secret | Off | as found | N-W | G | UNKNOWN (S2) |
| P1 | 5 | Chrome normal | hostname `dns.google` | as found | N-W | C | UNSUPPORTED: the experiment refuses (A8) |
| P2 | 6 | Chrome Incognito | hostname | as found | N-W | C | UNSUPPORTED |
| P3 | 7 | Firefox normal | hostname | as found | N-W | C | UNSUPPORTED |
| P4 | 8 | Firefox Private | hostname | as found | N-W | C | UNSUPPORTED |
| P5 | added | Chrome normal | Off → hostname **mid-session** | as found | N-W | C | Stops within about 5 s; any load that succeeds while status still shows running is BYPASS |
| D1 | 9 | Chrome normal | Off | Secure DNS **off** | N-W | G-b | PASS (control for G1) |
| D2 | 10 | Chrome normal | Off | Secure DNS **on, chosen provider** (record which) | N-W | C | BYPASS (C2: explicit DoH) |
| D3 | 9 | Firefox normal | Off | DoH **Off** | N-W | G-b | PASS (F7) |
| D4 | 10 | Firefox normal | Off | DoH **Increased** | N-W | C | BYPASS (F1) |
| D5 | 10 | Firefox normal | Off | DoH **Max** | N-W | C | BYPASS (F1) |
| L1 | 11 | Harness + Chrome normal | Off | as found | N-W | G-b | PASS after every Start (M1-05 G) |
| L2 | added | Chrome normal, tab kept open | Off | as found | N-W | C | Possible transient BYPASS (U8) |
| L3a | 12 | App swiped from Recents | Off | as found | N-W | G-b | PASS (A11) |
| L3b | 12 | App force-stopped | Off | as found | N-W | G-b | UNSUPPORTED (A4) |
| L4 | 13 | Device reboot | Off | as found | N-W | G-b | UNSUPPORTED (A5) |
| L5 | 14 | Wi-Fi off → on (mobile data off) | Off | as found | N-W | G-b | UNSUPPORTED (A10) |
| L6 | 15 | Wi-Fi → mobile data | Off | as found | N-W → N-M | G-b | UNSUPPORTED (A10) |
| N1 | 16 | Harness + Chrome + Firefox normal | Off | as found | the IPv6-capable network | G-b | PASS (A2) |

Not measured in M1-06, but listed for the stop report:

- A deliberate user disable: Stop, disconnect in system VPN settings, uninstall, or start another
  VPN app (A4). M1-04/M1-05 already verify that the state stays truthful.
- Non-browser apps with their own DoH or hardcoded resolvers.
- Browsers with a built-in VPN or proxy.
- Always-on or lockdown behavior, which is not implemented (D10).

## Execution runbook

### Safety rules (apply to every step)

- Change Private DNS, browser DNS and VPN settings **by hand in the Settings UI only**. Never use
  `adb shell settings put`, scripts or automation to change DNS or VPN settings.
- Never turn on Always-on VPN or "Block connections without VPN". Do not install other VPN or DNS
  apps.
- Do not run `pm clear` on browsers, because it resets their DNS settings. Clear the cache through
  each browser's UI.
- Every `adb` command below is read-only.
- At the end, restore the as-found settings recorded in R0.

### R0 — Preparation (once)

1. Install the build under test (P1). Record the commit, device model, Android version, One UI
   version and security patch: `adb shell getprop ro.product.model`,
   `adb shell getprop ro.build.version.release`,
   `adb shell getprop ro.build.version.security_patch`.
2. Record the **as-found Private DNS mode** before changing anything. Take a screenshot of
   *Settings → Connections → More connection settings → Private DNS*, then run
   `adb shell settings get global private_dns_mode` and
   `adb shell settings get global private_dns_specifier`. Record the raw output; `null` means
   the platform default.
3. Record the browser versions: `adb shell dumpsys package com.android.chrome | findstr versionName`,
   and the same for `org.mozilla.firefox` and `com.sec.android.app.sbrowser`.
4. Record each browser's **as-found DNS setting** with a screenshot:
   - Chrome: ⋮ → Settings → Privacy and security → Use secure DNS
   - Firefox: ⋮ → Settings → Privacy and security → DNS over HTTPS
   - Samsung Internet: ≡ → Settings → Privacy (record whether any Secure DNS option exists)

   If a path differs on the device, record the path you actually used.
5. For each network, record whether IPv6 is present and which families its DNS servers use. Use
   `adb shell dumpsys connectivity` and look at the underlying network's `LinkAddresses`, `Routes`
   and `DnsAddresses`. Record yes/no and the address family only; redact the addresses.

### R1 — Session controls (at the start of each session and after every network change)

- **C0, no VPN:** Stop the experiment. Wait 5 s. Run HSC (below). Both blocked names must
  **resolve**; this shows they are resolvable without the filter. If they do not, the session is
  INCONCLUSIVE.
- **C1, VPN on:** Start the experiment and wait 5 s. The harness must show state
  `Degraded (FILTERING_NOT_OPERATIONAL)` and proxy `running (standard DNS only, experimental)`.
  Run HSC; it must pass. If C1 fails, do not run browser rows. Record the failure and escalate it
  as a failure of M1-05, not of M1-06.

### HSC — Harness Standard Check

1. Screenshot the harness (state, proxy status, counters).
2. Tap Resolve blocked test domain, then Resolve blocked test subdomain, then Resolve allowed test
   domain.
3. Screenshot again.

HSC passes only if all of the following hold:
- both blocked names show `NOT resolved`;
- the `blocked` counter rose by 2 or more;
- the allowed name shows `resolved`;
- the proxy status is `running` in both screenshots.

Wait at least 3 s after any VPN Start or Stop before running HSC (the in-process lookup cache).

### SBA — Standard Browser Attempt (used by every browser row)

1. **Setup:** apply the row's Private DNS and browser DNS settings in the Settings UI, and
   screenshot each.
2. In the browser (normal mode), clear cached images and files for "All time". Then force-stop the
   browser (Settings → Apps → *browser* → Force stop, or `adb shell am force-stop <package>`).
3. In the harness, screenshot state, proxy status and counters. This is the **before** record.
4. Open the browser in the row's mode (Chrome: New Incognito tab; Firefox: Private browsing;
   Samsung Internet: Tabs → Turn on Secret mode).
5. **Blocked attempt:** type `https://BLOCKED_TEST_DOMAIN/?m106=<TID>`, wait up to 15 s and take a
   screenshot showing the address bar and the page or error. Reload once, then screenshot again.
6. In the harness, screenshot state, proxy status and counters. This is the **after** record;
   ΔB = the change in the `blocked` counter.
7. **Positive control:** in a new tab, load `https://ALLOWED_TEST_DOMAIN/?m106=<TID>`, then
   `https://www.wikipedia.org/`. Screenshot each.
8. Classify the attempt with the decision rule in [Result classification](#result-classification).
   If it is INCONCLUSIVE, repeat once from step 2.

The blocked attempt always comes first, from a force-stopped browser. So no earlier connection to
the allowed domain can be reused for it; this matters because the test domains may share a host or
certificate.

### Row procedures

| ID | Setup | Action | Expected observation | Evidence | Classification |
|---|---|---|---|---|---|
| G1–G4, G7, G8 | Private DNS Off. Browser DNS setting as found. R1 passed. | SBA in the row's browser and mode | See the matrix | SBA screenshots, browser DNS settings screenshot | Decision rule |
| G5-W, G5-M, G6 | Private DNS **Automatic**, on the row's network. Stop, then Start the experiment. | If the proxy shows `refused: Private DNS is active`, record that; the row is UNSUPPORTED (S2 applies). Otherwise run R1 C1, then SBA. | Depends on whether the network validates DoT | Private DNS screenshot, harness status, SBA if run | Decision rule |
| P1–P4 | Stop the experiment. Set Private DNS to hostname `dns.google`. Start. | Record the harness state and proxy status, then do the SBA blocked attempt in the row's mode | The proxy shows `refused …`; state is `Error: DNS experiment refused …`; the blocked domain loads (the VPN is not up) | Harness, Private DNS screenshot, browser | UNSUPPORTED if the refusal is truthful; BLOCKING FALSE CLAIM if `Protected` appears |
| P5 | Private DNS Off; experiment running; C1 passed | Set Private DNS to hostname `dns.google`. Within 5 s, do the SBA blocked attempt in Chrome, then open the harness. | The experiment stops with `… Private DNS became active …` | Timestamped screenshots, harness | BYPASS if the blocked domain loaded while the harness still showed `running`; otherwise UNSUPPORTED |
| D1–D5 | Private DNS Off. Set the row's browser DNS setting. | SBA (normal mode) | See the matrix | Screenshot of the browser DNS setting with the provider visible, plus SBA | Decision rule |
| L1 | Running; C1 passed | Stop, wait 5 s, run HSC (the blocked names must resolve). Start, wait 5 s, run HSC (it must pass). Repeat 3 times. Then disconnect via Settings → Connections → More connection settings → VPN; confirm `Stopped`. Start again, then HSC, then SBA in Chrome. | Blocking returns after every Start and disappears after every Stop | HSC per cycle; SBA | PASS only if every post-Start HSC passes; any post-Start HSC where a blocked name resolves while the status shows running is BYPASS |
| L2 | Stop the experiment. Chrome normal. | Load `https://BLOCKED_TEST_DOMAIN/?m106=L2-0` (it loads) and keep the tab open. Start and wait 5 s. Without force-stopping, load `?m106=L2-1` in the same tab, then `L2-2` at +60 s and `L2-3` at +5 min. Then run a full SBA. | Some reloads may still load (browser cache or connection reuse) | Timestamped screenshots per reload; ΔB | BYPASS (cause: pre-existing state) for each load while running; record the time window |
| L3a | Running; C1 passed | Open Recents and swipe the app away. Wait 10 s and confirm the VPN key icon. Do an SBA in Chrome. Reopen the app and record status and counters. | The VPN keeps running and blocking continues | Key-icon screenshot, SBA, harness | Decision rule |
| L3b | Running | Force-stop the app (Settings → Apps → Recovery Protection → Force stop). Wait 10 s. Do the SBA blocked attempt in Chrome. Reopen the app. | The VPN is gone; the state is `Stopped` or `not running`; the blocked domain loads | Key icon absent, harness, browser | UNSUPPORTED if truthful; BYPASS if the harness shows `running` while the blocked domain resolves |
| L4 | Running | Restart the device. Unlock and wait 60 s. Record the VPN icon and any notification. Open the app, run HSC, then the SBA blocked attempt in Chrome. In Settings → VPN, record (without changing it) whether Always-on is offered for the app. | Not running after reboot (A5) | Screenshots | UNSUPPORTED if truthful; BLOCKING FALSE CLAIM / BYPASS as in the rule |
| L5 | Mobile data **off**; Wi-Fi on; running; C1 passed | Turn Wi-Fi off, wait 10 s, record the harness. Turn Wi-Fi on and wait until connected plus 10 s. Record the harness, run HSC, then SBA in Chrome. | The experiment stops truthfully (A10) | Harness before and after; HSC; SBA | Decision rule; UNSUPPORTED if the stop is truthful |
| L6 | Mobile data **on**; Wi-Fi on; running on Wi-Fi; C1 passed | Turn Wi-Fi off, wait 15 s, record the harness. Run HSC, then SBA in Chrome. | The experiment stops truthfully (A10) | As L5 | As L5 |
| N1 | On the network R0 recorded as having IPv6; Private DNS Off | Run R1, then SBA in Chrome and SBA in Firefox. Record whether the underlying DNS servers are IPv4 or IPv6 (redacted). | PASS | R0 IPv6 record; SBA | Decision rule. If no IPv6 network is available: NOT RUN (N/A), with R0 evidence |

## Evidence requirements

Each row needs:

- its settings screenshots;
- the harness **before and after** screenshots (state, proxy status, counters);
- browser screenshots showing the address bar;
- timestamps;
- one filled evidence record (below).

Also collect logcat per session: `adb logcat -s LocalProtectionVpn DnsProxyRuntime AndroidRuntime`
(M1-05 logs no hostnames).

Redact SSIDs, IP addresses, account names and other apps' notifications before sharing. Do not
commit raw evidence to the repository; store it outside the repository.

```text
Test ID:
Date / time:
Build commit:
Device / Android version / One UI:
Browser / version:
Mode (normal / Incognito / Private / Secret):
Network (N-W / N-M; IPv6 yes/no):
Private DNS (Off / Automatic / hostname=…):
Browser Secure DNS / DoH setting:
VPN status (key icon; system VPN screen):
Experimental DNS status (before → after):
blocked counter (before → after, ΔB):
Blocked test result (loaded / DNS error text / other):
Allowed test result:
General site (wikipedia.org) result:
ProtectionState (every value seen):
Classification (PASS / BYPASS / UNSUPPORTED / BLOCKING FALSE CLAIM / INCONCLUSIVE):
Bypass path, if BYPASS (browser DoH / Private DNS / cache-connection / IPv6 / stale status / unknown):
Retry performed (yes/no):
Notes:
```

## Result classification

| Result | Definition |
|---|---|
| **PASS** | The experiment showed `running` before and after. The blocked attempt failed with a name-resolution error **and** ΔB ≥ 1 (the experiment saw and blocked the query). The allowed domain and the general site loaded. `ProtectionState` was never `Protected`. |
| **BYPASS** | The experiment showed `running` before and after, **and** the blocked test domain resolved or its page loaded (fresh `?m106=` URL). The path is recorded, not used to excuse the result. A path outside the experiment (DoH, Private DNS, cache, IPv6) while the experiment reports `running` is **always BYPASS, never UNSUPPORTED.** |
| **UNSUPPORTED** | The experiment truthfully reported that it was **not** running, for a documented reason (refused because Private DNS is active, stopped on a network change, not started after reboot or force-stop). `ProtectionState` was `Stopped` or `Error`. The blocked domain resolving in this state is expected and is not a bypass. |
| **BLOCKING FALSE CLAIM** | `ProtectionState` shows `Protected` at any time. In M1-05 it is unreachable by design (D8/D11), so any sighting is a blocking defect, whether or not a bypass was seen. The same applies to any app text or notification that claims protection. |
| **INCONCLUSIVE** | Added. Any other outcome, for example: the blocked attempt failed but ΔB = 0 (the failure was not caused by the experiment); the allowed or general control failed (filtering and network failure cannot be told apart); a timeout; missing evidence. Retry once; a second INCONCLUSIVE stands and is reported. |

**Decision rule** (apply in this order; the first match wins):

1. `Protected` or a protection claim was seen → BLOCKING FALSE CLAIM.
2. The status showed a truthful non-running state → UNSUPPORTED.
3. The status showed `running` and the blocked domain loaded or resolved → BYPASS.
4. The PASS conditions are all met → PASS.
5. Otherwise → INCONCLUSIVE.

## Architecture stop criteria

| Stop | Trigger | Effect |
|---|---|---|
| **S0** | BLOCKING FALSE CLAIM in any row | Stop execution immediately. Report the defect. No other result from this build is trusted. |
| **S1** | BYPASS in any **G** or **G-b** row, reproduced once from a clean SBA | Architecture stop |
| **S2** | UNSUPPORTED in G5 or G6, because the experiment refuses under the **Android default** Private DNS setting (a default-configuration coverage gap) | Architecture stop |

On S1 or S2:

- Finish the remaining rows as measurement only.
- Start no fix, mitigation, code change or M1-07 work.
- Write one stop report per distinct bypass or gap (template below).
- Stop for human architecture review.

BYPASS or UNSUPPORTED results in **C** rows, and UNSUPPORTED in G-b rows, are documented in the
same report format. They do not trigger a stop by themselves.

The **gate outcome** is derived mechanically from the results, in this order:

1. **STOP — DEFECT** if S0 occurred.
2. **STOP — ARCHITECTURE REVIEW** if S1 or S2 occurred. Unexecuted rows do not delay this.
3. **INCOMPLETE** if any G or G-b row is NOT RUN or INCONCLUSIVE, except N1 when no IPv6 network is
   available.
4. **NO GATING BYPASS OBSERVED** otherwise.

The last outcome covers only the recorded device, versions, settings and networks. It is **not a
protection claim**:

- `filteringOperational` stays `false` and `Protected` stays unreachable;
- it authorizes no architecture change and no mitigation.

What happens after any outcome is the Tech Lead's decision: continue, narrow the protection claim,
investigate further, redesign, or stop the approach. This document does not choose.

### Stop report (one per bypass or gap)

```text
1. Exact bypass:
2. Android version:
3. Browser + version:
4. Browser mode:
5. Private DNS setting:
6. Browser Secure DNS / DoH setting:
7. Network type (and IPv6 yes/no):
8. Reproduction steps (row ID + deviations):
9. Why the DNS filter did not see the request (ΔB, bypass path, supporting facts):
10. Security / product impact:
11. Technically viable alternatives (listed for review, none implemented):
12. Permissions required by each alternative:
13. Privacy trade-offs:
14. Play Store policy implications, where applicable:
15. Complexity:
```

## Final result template

```text
M1-06 GATE REPORT
Build commit:            Device / Android / One UI:
Executed by / dates:     Browsers + versions:
As-found Private DNS:    As-found browser DNS settings:

Row results: ID | Classification | ΔB | Bypass path | Evidence ref
(one line per matrix row; NOT RUN rows state the reason)

Gate outcome: STOP — DEFECT / STOP — ARCHITECTURE REVIEW / INCOMPLETE / NO GATING BYPASS OBSERVED
Stop reports attached: (IDs)
Unknowns U1–U8: resolved by (row) / still open
Deviations from this runbook:

Tech Lead decision (human only): ______________________
```

## Decisions required before execution

These are fixed when this document is approved. They are not revised after results are seen; any
later change is recorded as a dated revision.

- **H1, test domains.** Confirm `BLOCKED_TEST_DOMAIN`, `BLOCKED_TEST_SUBDOMAIN` and
  `ALLOWED_TEST_DOMAIN`. The M1-05 build hardcodes `example.com`, `www.example.com` and
  `example.org`, and M1-06 changes no code. Any other values need a separately approved code
  change. The IANA example domains may share hosting or a certificate; SBA's ordering handles this.
- **H2, gating scope.** Confirm the following:
  - Samsung Internet (G7, G8) and Private DNS Automatic (G5, G6) are gating.
  - Rows where the user switches on encrypted DNS (P1–P5, D2, D4, D5) are characterization.
  - Pre-existing browser state (L2) is characterization.
- **H3, S2.** Confirm that the experiment refusing under the Android default Private DNS setting is
  an architecture stop.

## Sources

- [builder]: https://developer.android.com/reference/android/net/VpnService.Builder
- [vpnservice]: https://developer.android.com/reference/android/net/VpnService
- [vpnguide]: https://developer.android.com/develop/connectivity/vpn
- [linkprops]: https://developer.android.com/reference/android/net/LinkProperties
- [dotblog] †: https://android-developers.googleblog.com/2018/04/dns-over-tls-support-in-android-p.html
- [chromehelp] †: https://support.google.com/chrome/answer/10468685
- [ffdoh] †: https://support.mozilla.org/en-US/kb/configure-dns-over-https-protection-levels-firefox-android
- [ffblog] †: https://blog.mozilla.org/en/firefox/dns-android/
- [ffcanary] †: https://support.mozilla.org/en-US/kb/configuring-networks-disable-dns-over-https
- Chromium source (`main`, read 2026-09-25): `net/dns/dns_client.cc`,
  `net/dns/public/doh_provider_entry.cc`, `net/dns/dns_config_service_android.cc`,
  `net/android/java/src/org/chromium/net/AndroidNetworkLibrary.java`, `net/base/features.cc`,
  `chrome/browser/net/stub_resolver_config_reader.cc`

[builder]: https://developer.android.com/reference/android/net/VpnService.Builder
[vpnservice]: https://developer.android.com/reference/android/net/VpnService
[vpnguide]: https://developer.android.com/develop/connectivity/vpn
[linkprops]: https://developer.android.com/reference/android/net/LinkProperties
[dotblog]: https://android-developers.googleblog.com/2018/04/dns-over-tls-support-in-android-p.html
[chromehelp]: https://support.google.com/chrome/answer/10468685
[ffdoh]: https://support.mozilla.org/en-US/kb/configure-dns-over-https-protection-levels-firefox-android
[ffblog]: https://blog.mozilla.org/en/firefox/dns-android/
[ffcanary]: https://support.mozilla.org/en-US/kb/configuring-networks-disable-dns-over-https

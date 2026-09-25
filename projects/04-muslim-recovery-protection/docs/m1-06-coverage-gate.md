# M1-06 DNS Coverage & Bypass Validation

**Status:** Draft validation gate. Not executed. Measures behavior only; it implements no mitigation
and changes no architecture. Execution requires Tech Lead approval of this document (see
[Proposed Tech Lead decisions](#proposed-tech-lead-decisions-required-before-execution)).

## Purpose

Answer, with device evidence:

> Does the DNS-only filtering approach meaningfully work across normal Android and browser
> configurations, and where can it be bypassed?

A bypass is a valid engineering result. It is recorded and escalated, never fixed, hidden or
reclassified inside M1-06 (D1, `requirements.md` → Success / stop criteria).

## Preconditions

| # | Precondition | If not met |
|---|---|---|
| P1 | The build under test is the M1-05 DNS-only experiment: Draft PR #11, branch `feat/04-m1-05-mobile-fixes` at `ddabe8a`. **M1-05 is not merged to `main`**; nothing here assumes it is. Any other commit, including a later merge commit, needs the Tech Lead to confirm it is behaviorally equivalent. | Do not start. |
| P2 | M1-05's own gates have passed on the desktop: `.\gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon` and the full M1-05 manual device plan A–I. Otherwise no M1-06 failure can be attributed. | Do not start. |
| P3 | The Tech Lead has approved the proposed decisions H1–H3. Until then they are proposals only. | Do not start. |
| P4 | Physical Samsung device. No other VPN, DNS, ad-block or "security" app active. No work profile, MDM or device owner (Chrome disables Secure DNS on managed devices, which would distort results). | Remove it, or record it and mark affected rows INCONCLUSIVE. |
| P5 | Chrome, Firefox and Samsung Internet updated to current stable from the store. Versions recorded. | Record the actual versions. |
| P6 | Networks: N-W = the normal home Wi-Fi; N-M = mobile data (SIM). Record for each whether it has IPv6. | Rows needing a missing network are NOT RUN (with the reason). |
| P7 | A desktop with `adb`, for **read-only** evidence commands only. | Use Settings screenshots instead. |
| P8 | The remaining source marked † (F5) has been re-read by a human, and its classification updated if needed. | Record that it was not re-read. |

Harmless controlled domains only. Never use, type, reference or record real adult-content domains
(D3). Below, `<TID>` is the test ID; the query string `?m106=<TID>` defeats HTTP caches and is
ignored by the harmless test site.

## Threat / coverage question

The DNS-only experiment can see a lookup only if it is a plaintext DNS query that the device sends
to the VPN's DNS server `10.111.222.1` (IPv4/UDP). Any lookup that does not follow this path goes
around it. M1-06 measures each such path under realistic settings:

| Path around the filter | How it arises | Measured by |
|---|---|---|
| Browser DNS-over-HTTPS | The browser's own Secure DNS / DoH, whether on by default or turned on by the user | G1–G9, D1–D5 |
| Android Private DNS (DoT) | Automatic (the Android default) or a provider hostname | G5, G6, P1–P5 |
| Stale DNS configuration, cached lookups or reused connections | The browser was already running, or had already resolved or connected, before the filter started | G9, L2 |
| Lifecycle gaps | Restart, app kill, idle/Doze, reboot or network change leaves the filter stopped or stale | L1–L8 |
| IPv6 | IPv6 underlying network or IPv6 DNS servers | N1 |

Two bypass classes are kept separate:

- **Passive** means the browser DNS settings are as found. Private DNS is either Off or Automatic:
  - **Off** is a controlled isolation setting. It is M1-05's supported path, not the Android
    default.
  - **Automatic** is the Android default. It is covered by G5 and G6 only.

  A passive bypass is **gating**.
- **User-configured encrypted DNS** means the user turns on a browser's DoH or sets a Private DNS
  hostname. These rows are **characterization**. Whether bypass by the user themself is in scope
  for this product's threat model is a Tech Lead decision (H2), taken before execution.

## Verified platform facts

Researched 2026-09-25. **FACT** means the cited official source or the Chromium source says it.
**HISTORICAL FACT** means it was true when the source was published and says nothing about current
behavior. **ASSUMPTION** means it is inferred or not directly verified. **UNKNOWN** means it must
be tested on the device.

A FACT about documented behavior is not device evidence. Rows that depend on actual device or
installed-version behavior stay ASSUMPTION or UNKNOWN until they are tested.

The AI research sandbox could not reach the official Google and Mozilla help and blog pages.

- **Tech Lead-verified (‡).** A7, C1, F1, F2 and F3 are classified from the official source and
  marked ‡.
- **Unverified (†).** F5 is still known only from a search-engine excerpt. It stays
  **ASSUMPTION †** until it is re-read (P8).

Chromium findings come from the source on its `main` branch. The installed Chrome can differ,
including through server-side field trials.

### Android

| ID | Finding | Class | Source |
|---|---|---|---|
| A1 | `addDnsServer`: "If none is set, the DNS servers of the default network will be used." M1-05 sets only `10.111.222.1`. | FACT | [VpnService.Builder][builder] |
| A2 | `allowFamily`: without an IPv6 address, route or DNS server, IPv6 traffic "will then typically fall-through to the underlying network". M1-05 allows IPv6 but has no IPv6 route and no IPv6 DNS server. | FACT | [VpnService.Builder][builder] |
| A3 | With no allowed or disallowed app list, "all applications are allowed by default", so the browsers are VPN-covered apps. Without `allowBypass()`, apps cannot "side-step the VPN" through `bindProcessToNetwork`. | FACT | [VpnService.Builder][builder] |
| A4 | Only one VPN runs at a time. "The network is restored automatically when the file descriptor is closed", including when the VPN app "is crashed or killed by the system". | FACT | [VpnService][vpnservice] |
| A5 | Always-on keeps a VPN "persisted after device reboot and app upgrade". Apps opt out with `SUPPORTS_ALWAYS_ON=false`, which M1-04/M1-05 declare (D10). There is no boot receiver in the manifest. | FACT (docs + manifest) | [VpnService][vpnservice], [VPN guide][vpnguide] |
| A6 | `isPrivateDnsActive()`: while Private DNS is in use, "applications must not send unencrypted DNS queries". A non-null `getPrivateDnsServerName()` means strict mode; null while active means opportunistic mode. | FACT | [LinkProperties][linkprops] |
| A7 | Private DNS modes are Off, Automatic (opportunistic DoT to the network's resolver, with fallback to plaintext) and provider hostname (strict). Automatic is the platform default. | FACT ‡ | [Android Developers Blog 2018][dotblog] ‡ |
| A8 | M1-05 refuses to start, or stops, whenever the underlying network reports Private DNS active: before start, before each forward, and every 2 s. So in **Automatic** mode it refuses on networks whose resolver validates DoT and runs on the others. | ASSUMPTION (M1-05 design, Draft PR #11; not device-verified) | D11 on the M1-05 branch |
| A9 | Samsung's as-shipped Private DNS mode, and whether a given network validates DoT | UNKNOWN (record as found) | — |
| A10 | A Wi-Fi reconnect or a switch of the underlying network makes M1-05 stop truthfully (it has no handover) | ASSUMPTION (M1-05 documented limitation) | PR #11 |
| A11 | Swiping the app out of Recents, or Doze while idle, leaves the foreground VPN service running. Force-stop tears it down (A4). | ASSUMPTION (swipe, Doze); FACT (force-stop → A4) | — |
| A12 | M1-05's counters are in memory and reset on every Start and when the process dies. | FACT (M1-05 code, read-only review) | M1-05 branch |

### Chrome Android

| ID | Finding | Class | Source |
|---|---|---|---|
| C1 | Secure DNS is on by default in **automatic** mode, which may fall back to unencrypted DNS. With a manually chosen (custom) provider, Chrome does **not** fall back to unencrypted DNS. Path: Settings → Privacy and security → Use secure DNS. It is unavailable when the device is managed or parental controls are on. This is documented behavior; what the installed Chrome actually does on the device is covered by C6–C8. | FACT ‡ | [Chrome Help][chromehelp] ‡ |
| C2 | Automatic mode upgrades to DoH only when a system nameserver IP matches Chrome's built-in provider list. Under strict Android Private DNS, it upgrades only when the DoT hostname matches that list. | FACT (source) | `net/dns/dns_client.cc`, `net/dns/public/doh_provider_entry.cc` |
| C3 | Chrome reads its nameservers and Private DNS state from the **active network's** `LinkProperties`. Its built-in resolver is on by default on Android. | FACT (source) | `AndroidNetworkLibrary.getDnsStatus`, `net/base/features.cc` (`kAsyncDns`) |
| C4 | Chrome's built-in plaintext resolver is not used while Private DNS is active. Chrome then uses the OS resolver. | FACT (source) | `dns_client.cc` `CanUseInsecureDnsTransactions` |
| C5 | A newer "automatic with DoH fallback" option falls back to `8.8.8.8`'s DoH. It is **not applied when a nameserver is non-public** (such as `10.111.222.1`) unless `kDohFallbackAllowedWithLocalNameservers`, which is off by default, is enabled. | FACT (source) | `dns_client.cc`, `stub_resolver_config_reader.cc` |
| C6 | As a VPN-covered app, Chrome sees the nameserver `10.111.222.1`, which matches no provider and gets no fallback. So its lookups reach the filter in plaintext. In G1, ΔB ≥ 1 shows the query reached the filter; a query sent to the underlying resolver would give ΔB = 0 and a BYPASS. | ASSUMPTION (follows from C2–C5 and A3) | Must test: G1, G9-C |
| C7 | Incognito uses the same Secure DNS configuration as normal mode | UNKNOWN | Must test: G2 |
| C8 | The installed version and its field trials match Chromium `main` | UNKNOWN | Record the version; G1, D2 |
| C9 | Chrome's automatic upgrade can only trigger when a tested network's resolver is on Chrome's list (for example a public resolver handed out by the router or carrier). If no tested network uses such a resolver, that trigger is not exercised. | FACT (follows from C2); coverage limit | R0 step 5; U1b |

### Firefox Android

| ID | Finding | Class | Source |
|---|---|---|---|
| F1 | The DoH levels are Default Protection, Increased Protection, Max Protection and Off. Path: Settings → Privacy and security → DNS over HTTPS. | FACT ‡ | [Mozilla Support][ffdoh] ‡ |
| F2 | Default Protection can use secure DNS (DoH) automatically where supported ("select a DoH server automatically in specific regions when available") and can fall back to the default resolver. | FACT ‡ | [Mozilla Support][ffdoh] ‡ |
| F3 | The September 2025 Mozilla announcement (Firefox 143 for Android) let users opt in (Increased Protection) and said Mozilla planned a later on-by-default rollout in some regions. This is **not** evidence of the default behavior in September 2026. | HISTORICAL FACT ‡ (Sep 2025) | [Mozilla Blog][ffblog] ‡ |
| F4 | Whether Default Protection currently turns DoH on for this device. It depends on the installed version, rollout state, region and device; F2 and F3 do not settle it. | UNKNOWN / MUST TEST | Must test: G3, G4, G9-F |
| F5 | Mozilla documents a network "canary domain" (`use-application-dns.net`) that disables DoH in Firefox's default mode. Its behavior on Android is UNKNOWN. **M1-06 does not use or emulate it** (that would be mitigation). It is listed only as input for the architecture review. | ASSUMPTION † / UNKNOWN (Android) | [Mozilla Support][ffcanary] † |
| F6 | Private Browsing uses the same DoH setting | UNKNOWN | Must test: G4 |
| F7 | With DoH Off, Firefox uses the OS resolver and is therefore filtered | ASSUMPTION | Must test: D3 |

### Samsung Internet (added: the default browser on the target device)

| ID | Finding | Class |
|---|---|---|
| SI1 | Whether it has its own Secure DNS / DoH setting, and its default | UNKNOWN. Record in Settings during preparation. |
| SI2 | Secret mode's DNS behavior | UNKNOWN. Must test: G8. |

## Unknowns requiring device testing

| ID | Unknown | Resolved by |
|---|---|---|
| U1 | Chrome's DNS path under the VPN (C6, C8) | G1, G9-C, D1, D2 |
| U1b | Chrome's automatic upgrade on a network whose resolver is on its list (C9) | Only if such a network is tested; otherwise reported open |
| U2 | Chrome Incognito (C7) | G2 |
| U3 | Firefox Default Protection and Private Browsing (F4, F6) | G3, G4, G9-F |
| U4 | Samsung Internet (SI1, SI2) | G7, G8 |
| U5 | Whether the Android default (Automatic) lets the experiment run on each network (A8, A9) | G5, G6 |
| U6 | Lifecycle, Doze and network change (A10, A11) | L1, L3a–L8 |
| U7 | The IPv6 path | N1 |
| U8 | How long a browser's pre-existing cache or connection keeps a domain reachable | L2 |
| U9 | Whether a browser that is already running picks up the VPN's DNS configuration | G9-C, G9-F |

## Test matrix

**Gate** column:

- **G** = gating. A BYPASS triggers S1. An UNSUPPORTED is valid only in G5/G6, with
  `refused: Private DNS is active`, and triggers S2. Any other non-running state in a G row is
  INCONCLUSIVE.
- **G-b** = gating for BYPASS only. An UNSUPPORTED (a truthful stop) is reported as a coverage gap
  (see H2).
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
| G7 | added | Samsung Internet normal | Off | as found | N-W | G | UNKNOWN (SI1) |
| G8 | added | Samsung Internet Secret | Off | as found | N-W | G | UNKNOWN (SI2) |
| G9-C / G9-F | added | Chrome / Firefox normal, **already running** before Start | Off | as found | N-W | G | UNKNOWN (U9) |
| P1 | 5 | Chrome normal | hostname `dns.google` | as found | N-W | C | UNSUPPORTED: the experiment refuses (A8) |
| P2 | 6 | Chrome Incognito | hostname | as found | N-W | C | UNSUPPORTED |
| P3 | 7 | Firefox normal | hostname | as found | N-W | C | UNSUPPORTED |
| P4 | 8 | Firefox Private | hostname | as found | N-W | C | UNSUPPORTED |
| P5 | added | Chrome normal | Off → hostname **mid-session** | as found | N-W | C | Stops within about 2–5 s (A8); a load that completes before the stop is BYPASS |
| D1 | 9 | Chrome normal | Off | Secure DNS **off** | N-W | G-b | PASS (control for G1) |
| D2 | 10 | Chrome normal | Off | Secure DNS **on, chosen provider** (record which) | N-W | C | BYPASS (C1: chosen provider, no fallback; device behavior to be tested) |
| D3 | 9 | Firefox normal | Off | DoH **Off** | N-W | G-b | PASS (F7) |
| D4 | 10 | Firefox normal | Off | DoH **Increased** | N-W | C | BYPASS (F1; device behavior to be tested) |
| D5 | 10 | Firefox normal | Off | DoH **Max** | N-W | C | BYPASS (F1; device behavior to be tested) |
| L1 | 11 | Harness + Chrome normal | Off | as found | N-W | G-b | PASS after every Start (M1-05 G) |
| L2 | added | Chrome normal, tab kept open | Off | as found | N-W | C | Possible transient BYPASS (U8) |
| L3a | 12 | App swiped from Recents | Off | as found | N-W | G-b | PASS (A11) |
| L3b | 12 | App force-stopped | Off | as found | N-W | G-b | UNSUPPORTED (A4) |
| L4 | 13 | Device reboot | Off | as found | N-W | G-b | UNSUPPORTED (A5) |
| L5 | 14 | Wi-Fi off → on (mobile data off) | Off | as found | N-W | G-b | UNSUPPORTED (A10) |
| L6 | 15 | Wi-Fi → mobile data | Off | as found | N-W → N-M | G-b | UNSUPPORTED (A10) |
| L7 | added | Idle soak: screen locked, 30 min, battery settings as found | Off | as found | N-W | G-b | PASS (A11) |
| L8 | added | Mobile data → Wi-Fi (arriving home) | Off | as found | N-M → N-W | G-b | UNKNOWN: a truthful stop (A10), or still running if mobile stays up |
| N1 | 16 | Harness + Chrome + Firefox normal | Off | as found | the IPv6-capable network | G-b | PASS (A1: the only DNS server is IPv4; the A2 fall-through is the risk under test) |

Not measured in M1-06, but listed for the stop report:

- A deliberate user disable: Stop, disconnect in system VPN settings, uninstall, or start another
  VPN app (A4). M1-04/M1-05 already verify that the state stays truthful.
- Non-browser apps with their own DoH or hardcoded resolvers.
- In-app browsers (WebView, Custom Tabs).
- Other browsers (Edge, Brave, Opera and others), including browsers with a built-in VPN or proxy.
- Always-on or lockdown behavior, which is not implemented (D10).

## Execution runbook

### Safety rules (apply to every step)

- Change Private DNS, browser DNS and VPN settings **by hand in the Settings UI only**. Never use
  `adb shell settings put`, scripts or automation to change DNS or VPN settings.
- Never turn on Always-on VPN or "Block connections without VPN". Do not install other VPN or DNS
  apps.
- Do not run `pm clear` on browsers, because it resets their DNS settings. Clear browsing data
  through each browser's UI, and force-stop apps through Settings → Apps.
- Every `adb` command in this document is read-only.
- At the end, restore the as-found settings recorded in R0.

### Execution order

R0 → R1 → G1–G9 → D1–D5 → N1 → L1 → L3a → L7 → L5 → L6 → L8 → L3b → L4 → L2 → P1–P5.

Rows that load the blocked domain unfiltered or change Private DNS run last, so they cannot seed
browser history or caches for the gating rows. Repeat R1 after every network change.

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

   If a path differs on the device, record the path you actually used. Also record the app's
   battery setting: Settings → Apps → Recovery Protection → Battery.
5. For each network, use `adb shell dumpsys connectivity` to record the underlying network's
   `LinkAddresses`, `Routes`, `DnsAddresses` and Private DNS lines:
   - whether IPv6 is present;
   - which address families its DNS servers use;
   - **who operates its DNS resolver**: the router or ISP, or a named public provider such as
     Google, Cloudflare or Quad9 (this is C9).

   Record the provider name only; redact all addresses. Field names in the output may vary, so
   record the relevant lines as printed.

### R1 — Session controls (at the start of each session and after every network change)

- **C0, no VPN:** Stop the experiment, wait 5 s, run **HSC-OFF**. If it fails, the session is
  INCONCLUSIVE.
- **C1, VPN on:** Start the experiment and wait 5 s. The harness must show state
  `Degraded (FILTERING_NOT_OPERATIONAL)` and proxy `running (standard DNS only, experimental)`.
  Run **HSC-ON**; it must pass. If C1 fails, do not run browser rows. Record the failure and
  escalate it as a failure of M1-05, not of M1-06.

### Harness checks

Tap Resolve blocked test domain, then Resolve blocked test subdomain, then Resolve allowed test
domain. Take a harness screenshot before and after. Wait at least 3 s after any VPN Start or Stop
first, because of the in-process lookup cache.

**HSC-ON** passes only if all of the following hold:
- both blocked names show `NOT resolved`;
- the `blocked` counter rose by 2 or more;
- the allowed name shows `resolved`;
- the proxy status is `running` in both screenshots.

**HSC-OFF** passes only if all three names show `resolved`, the proxy shows `not running` and the
state shows `Stopped`.

If the blocked names still fail more than 5 s after a Stop, the Stop left a **DNS black hole**.
That is an M1-05 defect: stop the session and report it. It is not an M1-06 classification.

**Counters (A12).** ΔB is valid only within one running session. Always take the **before** record
after the last Start.

### SBA — Standard Browser Attempt (used by every browser row)

1. **Setup:** apply the row's Private DNS and browser DNS settings in the Settings UI, and
   screenshot each.
2. **Reset the browser.**
   - Close every tab in every mode.
   - Delete browsing history and cached images and files for "All time".
   - Force-stop the browser: Settings → Apps → *browser* → Force stop.
3. In the harness, screenshot state, proxy status and counters. This is the **before** record.
4. Open the browser in the row's mode (Chrome: New Incognito tab; Firefox: Private browsing;
   Samsung Internet: Tabs → Turn on Secret mode).
5. **Blocked attempt:** type `https://BLOCKED_TEST_DOMAIN/?m106=<TID>`, wait up to 15 s and take a
   screenshot showing the address bar and the page or error. Record the **exact error text**.
   Reload once, then screenshot again.
6. In the harness, screenshot state, proxy status and counters. This is the **after** record;
   ΔB = the change in the `blocked` counter.
7. **Positive control:** in a new tab, load `https://ALLOWED_TEST_DOMAIN/?m106=<TID>`, then
   `https://www.wikipedia.org/`. Screenshot each.
8. Classify the attempt with the decision rule in [Result classification](#result-classification).
   If it is INCONCLUSIVE, repeat once from step 2.

The blocked attempt always comes first, from a reset browser. So no earlier connection to the
allowed domain can be reused for it; this matters because the test domains may share a host or
certificate.

### Row procedures

To reproduce a result: for SBA rows, repeat the SBA; for L rows, repeat the row's whole action
sequence once.

| ID | Setup | Action | Expected observation | Evidence | Classification |
|---|---|---|---|---|---|
| G1–G4, G7, G8 | Private DNS Off. Browser DNS setting as found. R1 passed. | SBA in the row's browser and mode | See the matrix | SBA screenshots, browser DNS settings screenshot | Decision rule |
| G5-W, G5-M, G6 | Stop the experiment. Set Private DNS to **Automatic**. On the row's network, turn it off and on (Wi-Fi, or mobile data for G5-M) and wait 30 s for DoT validation. Record the underlying network's Private DNS lines (R0 step 5). | Start. If the proxy shows `refused: Private DNS is active`, record it: the row is UNSUPPORTED (S2). Otherwise run C1, then SBA, then record the Private DNS lines again. | Depends on whether the network validates DoT | Private DNS screenshot, dumpsys lines (before Start, after SBA), harness, SBA | Decision rule. INCONCLUSIVE if the dumpsys lines disagree with the harness (active but running, or inactive but refused) |
| G9-C, G9-F | Private DNS Off; experiment **stopped**. Reset the browser (SBA step 2). | Open the browser and load `https://www.wikipedia.org/`. Do **not** visit the blocked domain. Leave the browser running in the background. Start the experiment and wait 5 s, then take the **before** record. Return to the same browser **without force-stopping it**, open a new tab and do SBA steps 5–7. | See the matrix | As SBA | Decision rule |
| P1–P4 | Stop the experiment. Set Private DNS to hostname `dns.google`. Start. | Record the harness state and proxy status, then do the SBA blocked attempt in the row's mode | The proxy shows `refused …` and the state shows `Error: DNS experiment refused …`. Lookups then work through Private DNS if the network allows DoT; if all DNS fails, record it as a network condition. | Harness, Private DNS screenshot, browser | UNSUPPORTED if the refusal is truthful, whatever the lookup result; BLOCKING FALSE CLAIM if S0 applies |
| P5 | Private DNS Off; experiment running; C1 passed. Start the Samsung screen recorder (it shows the clock) and `adb logcat -v time -s LocalProtectionVpn DnsProxyRuntime`. | Set Private DNS to hostname `dns.google`. Within 5 s, do the SBA blocked attempt in Chrome, then open the harness. | The experiment stops with `… Private DNS became active …` | Screen recording, logcat with timestamps, harness | BYPASS if the blocked page finished loading before the logged stop time; UNSUPPORTED if it did not load before the stop; INCONCLUSIVE if the order cannot be established |
| D1–D5 | Private DNS Off. Set the row's browser DNS setting. | SBA (normal mode) | See the matrix | Screenshot of the browser DNS setting with the provider visible, plus SBA | Decision rule |
| L1 | Running; C1 passed | Stop, wait 5 s, run HSC-OFF. Start, wait 5 s, run HSC-ON. Repeat 3 times. Then disconnect via Settings → Connections → More connection settings → VPN and confirm `Stopped`. Start again, run HSC-ON, then SBA in Chrome. | Blocking returns after every Start and disappears after every Stop | HSC per cycle; SBA | PASS only if every HSC-ON passes. BYPASS if a blocked name resolves while the proxy shows `running`. A DNS black hole after Stop is an M1-05 defect. |
| L2 | Experiment stopped. Chrome normal. | Load `https://BLOCKED_TEST_DOMAIN/?m106=L2-0` (it loads) and keep the tab open. Start and wait 5 s. Without force-stopping, load `?m106=L2-1` in the same tab, then `L2-2` at +60 s and `L2-3` at +5 min. Then run a full SBA. | Some reloads may still load (browser cache or connection reuse) | Timestamped screenshots per reload; ΔB | BYPASS (cause: pre-existing state) for each load while running; record the time window |
| L3a | Running; C1 passed | Open Recents and swipe the app away. Wait 10 s and confirm the VPN key icon. Do an SBA in Chrome. Reopen the app and record status and counters. | The VPN keeps running and blocking continues | Key-icon screenshot, SBA, harness | Decision rule |
| L3b | Running | Force-stop the app (Settings → Apps → Recovery Protection → Force stop). Wait 10 s. Do the SBA blocked attempt in Chrome. Reopen the app. | The VPN is gone; the state is `Stopped` or `not running`; the blocked domain loads | Key icon absent, harness, browser | UNSUPPORTED if truthful; BYPASS if the harness shows `running` while the blocked domain resolves |
| L4 | Running | Restart the device. Unlock and wait 60 s. Record the VPN icon and any notification. Open the app, run HSC-OFF, then the SBA blocked attempt in Chrome. In Settings → VPN, record (without changing it) whether Always-on is offered for the app. | Not running after reboot (A5) | Screenshots | UNSUPPORTED if truthful; BLOCKING FALSE CLAIM / BYPASS as in the rule |
| L5 | Mobile data **off**; Wi-Fi on; running; C1 passed | Turn Wi-Fi off, wait 10 s, record the harness. Turn Wi-Fi on and wait until connected plus 10 s. Record the harness, run HSC-ON if it shows running (HSC-OFF otherwise), then SBA in Chrome. | The experiment stops truthfully (A10) | Harness before and after; HSC; SBA | Decision rule; UNSUPPORTED if the stop is truthful |
| L6 | Mobile data **on**; Wi-Fi on; running on Wi-Fi; C1 passed | Turn Wi-Fi off, wait 15 s, record the harness. Run HSC-ON if it shows running (HSC-OFF otherwise), then SBA in Chrome. | The experiment stops truthfully (A10) | As L5 | As L5 |
| L7 | Running on N-W; C1 passed; device unplugged | Lock the screen and leave the device idle for 30 min. Unlock, record the harness (no Start in between, so counters stay valid), run HSC-ON, then SBA in Chrome. | Still running and blocking (A11) | Harness before and after, HSC, SBA | Decision rule |
| L8 | Wi-Fi off, mobile data on; running on N-M; C1 passed | Turn Wi-Fi on (it auto-joins N-W) and wait 15 s. Record the harness. Run HSC-ON if it shows running (HSC-OFF otherwise), then SBA in Chrome. | Unknown (see the matrix) | As L5 | Decision rule |
| N1 | On the network R0 recorded as having IPv6; Private DNS Off | Run R1, then SBA in Chrome and SBA in Firefox. Record whether the underlying DNS servers are IPv4 or IPv6 (redacted). | PASS | R0 IPv6 record; SBA | Decision rule. If no IPv6 network is available: NOT RUN (N/A), with R0 evidence |

## Evidence requirements

Each row needs:

- its settings screenshots;
- the harness **before and after** screenshots (state, proxy status, counters);
- browser screenshots showing the address bar and the exact error text;
- timestamps;
- one filled evidence record (below).

Also collect logcat per session: `adb logcat -v time -s LocalProtectionVpn DnsProxyRuntime AndroidRuntime`
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
Network (N-W / N-M; IPv6 yes/no; resolver operator):
Private DNS (Off / Automatic / hostname=…; dumpsys Private DNS lines if G5/G6):
Browser Secure DNS / DoH setting:
VPN status (key icon; system VPN screen):
Experimental DNS status (before → after):
blocked counter (before → after, ΔB):
Blocked test result (outcome class + exact text):
Allowed test result:
General site (wikipedia.org) result:
ProtectionState (every value seen):
Classification (PASS / BYPASS / UNSUPPORTED / BLOCKING FALSE CLAIM / INCONCLUSIVE):
Bypass path, if BYPASS (browser DoH / Private DNS / stale config / cache-connection / IPv6 / stale status / resolved-connection-failed / unknown):
Reproduction (reproduced / intermittent / not attempted):
Notes:
```

## Result classification

### Blocked-attempt outcome (fixed before execution)

The error strings are an ASSUMPTION; record the exact text. Any error that is neither a
name-resolution error nor a no-network error is treated as **post-resolution**.

| Outcome | Examples | Meaning |
|---|---|---|
| NAME ERROR | Chrome / Samsung Internet `ERR_NAME_NOT_RESOLVED`, `DNS_PROBE_FINISHED_NXDOMAIN`; Firefox "Hmm. We're having trouble finding that site." | The name did not resolve |
| LOADED | The site's page is shown | Resolved and connected |
| POST-RESOLUTION ERROR | Connection timed out, refused or reset; TLS or certificate error; HTTP error | The name **resolved** |
| NO NETWORK | Chrome `ERR_INTERNET_DISCONNECTED`; Firefox offline page | Environment failure |

### Classes

| Result | Definition |
|---|---|
| **PASS** | The experiment showed `running` before and after. The blocked outcome was NAME ERROR **and** ΔB ≥ 1 (the experiment saw and blocked the query). The allowed domain and the general site loaded. S0 did not apply. |
| **BYPASS** | The experiment showed `running` before and after, **and** the blocked outcome was LOADED or POST-RESOLUTION ERROR (or a harness lookup resolved). The path is recorded, not used to excuse the result. A path outside the experiment (DoH, Private DNS, stale config, cache, IPv6) while the experiment reports `running` is **always BYPASS, never UNSUPPORTED.** |
| **UNSUPPORTED** | The experiment truthfully reported that it was **not** running, in both records, for a documented reason: refused because Private DNS is active, stopped on a network change, or not started after Stop, force-stop or reboot. `ProtectionState` was `Stopped` or `Error`. The blocked domain resolving in this state is expected and is not a bypass. In G rows, this is valid only in G5/G6 with `refused: Private DNS is active`. |
| **BLOCKING FALSE CLAIM** | S0 applies: the harness `State:` line shows `Protected` at any time, or any harness or notification text states that the device or user is protected or that filtering is operational. The app name "Recovery Protection" and the VPN session name do not count. `Protected` is unreachable in M1-05 by design (D8/D11), so any sighting is a blocking defect, whether or not a bypass was seen. |
| **INCONCLUSIVE** | Added. Any other outcome, for example: NAME ERROR with ΔB = 0 (the failure was not caused by the experiment); a failed allowed or general control; NO NETWORK; a state change during the attempt; a non-running state in a G row other than the S2 case; missing evidence. Retry once; a second INCONCLUSIVE stands and is reported. |

**Decision rule** (apply in this order; the first match wins):

1. S0 applies → BLOCKING FALSE CLAIM.
2. The proxy status differs between the before and after records, or logcat shows a stop during
   the attempt → INCONCLUSIVE. Record the timestamps and retry. P5 uses its own rule.
3. Non-running in both records, with a truthful documented reason → UNSUPPORTED, subject to the
   G-row restriction above.
4. `running` in both records, and the blocked outcome is LOADED or POST-RESOLUTION ERROR → BYPASS.
5. The PASS conditions are all met → PASS.
6. Otherwise → INCONCLUSIVE.

A BYPASS is recorded when it is first observed with valid evidence. One reproduction attempt then
labels it **reproduced** or **intermittent**. Both count as BYPASS for the stop criteria.

## Architecture stop criteria

| Stop | Trigger | Effect |
|---|---|---|
| **S0** | BLOCKING FALSE CLAIM in any row | Stop execution immediately. Report the defect. No other result from this build is trusted. |
| **S1** | BYPASS, reproduced or intermittent, in any **G** or **G-b** row | Architecture stop |
| **S2** | UNSUPPORTED in G5 or G6 with `refused: Private DNS is active`, meaning the experiment refuses under the **Android default** Private DNS setting (a default-configuration coverage gap) | Architecture stop / review (proposed decision H3; not a project kill) |

On S1 or S2:

- Finish the remaining rows as measurement only.
- Start no fix, mitigation, code change or M1-07 work.
- Write one stop report per distinct bypass or gap (template below).
- Stop for human architecture review.

S1 and S2 apply as written only once the Tech Lead approves H2 and H3 (P3).

BYPASS or UNSUPPORTED results in **C** rows, and UNSUPPORTED in G-b rows, are documented in the
same report format. They do not trigger a stop by themselves.

The **gate outcome** is derived mechanically from the results, in this order:

1. **STOP — DEFECT** if S0 occurred.
2. **STOP — ARCHITECTURE REVIEW** if S1 or S2 occurred. Unexecuted rows do not delay this.
3. **INCOMPLETE** if any G or G-b row is NOT RUN or INCONCLUSIVE, except N1 when no IPv6 network is
   available.
4. **NO GATING BYPASS OBSERVED** otherwise.

The last outcome covers only the recorded device, versions, settings and networks, and it must
list U1b if that unknown is still open. It is **not a protection claim**:

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
7. Network type (IPv6 yes/no; resolver operator):
8. Reproduction steps (row ID + deviations; reproduced / intermittent):
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
Networks (IPv6; resolver operator):   † source F5 re-read (P8): yes / no

Row results: ID | Classification | ΔB | Bypass path | Reproduction | Evidence ref
(one line per matrix row; NOT RUN rows state the reason)

Gate outcome: STOP — DEFECT / STOP — ARCHITECTURE REVIEW / INCOMPLETE / NO GATING BYPASS OBSERVED
Stop reports attached: (IDs)
Unknowns U1–U9 (incl. U1b): resolved by (row) / still open
Deviations from this runbook:

Tech Lead decision (human only): ______________________
```

## Proposed Tech Lead decisions (required before execution)

**Status: PROPOSED. The Tech Lead has not approved these yet.** Approving them fixes them before
execution. They are not revised after results are seen; any later change is recorded as a dated
revision.

### H1 — Test domains (proposed)

```text
BLOCKED_TEST_DOMAIN    = example.com
BLOCKED_TEST_SUBDOMAIN = www.example.com
ALLOWED_TEST_DOMAIN    = example.org
```

These are harmless controlled test domains (IANA example domains) that the M1-05 experimental
harness already uses (hardcoded in the M1-05 build; M1-06 changes no code). Any other values would
need a separately approved code change. `example.com` and `example.org` may share hosting or a
certificate; SBA's ordering handles this.

### H2 — Gating scope (proposed)

**Gating:**

| Proposed scope | Rows |
|---|---|
| Chrome normal | G1 |
| Chrome Incognito | G2 |
| Firefox normal | G3 |
| Firefox Private | G4 |
| Samsung Internet normal | G7 |
| Samsung Internet Secret | G8 |
| Already-running browser scenarios | G9-C, G9-F |
| Android Private DNS Automatic | G5-W, G5-M, G6 |

G1–G4 and G7–G9 use Private DNS Off as an isolation setting. Only G5 and G6 cover the Android
default. The existing G-b rows (D1, D3, L1, L3a–L8, N1) stay gating for BYPASS only, as the matrix
already defines.

**Characterization:**

| Proposed scope | Rows |
|---|---|
| The user explicitly enables browser DoH / Secure DNS | D2, D4, D5 |
| The user explicitly sets a Private DNS hostname | P1–P5 |
| Pre-existing browser cache or connection state | L2 |
| Truthful lifecycle stops, where the VPN no longer claims to be running | UNSUPPORTED results in G-b rows (e.g. L3b, L4, L5, L6, L8) |

This split only assigns rows before execution. It does not interpret any result.

### H3 — Android default Private DNS (proposed)

Suppose M1-05 refuses to operate under Android's default Private DNS **Automatic** mode on a normal
tested network, because encrypted DNS is active there (G5 or G6 UNSUPPORTED with
`refused: Private DNS is active`). That is an **architecture stop / review condition** (S2).

This does **not** mean the project is killed. It means:

- no mitigation is implemented automatically;
- no broader protection claim is made;
- alternatives are brought back to the human Tech Lead, who decides the next step.

## Sources

Android developer reference (read directly, 2026-09-25):

- [VpnService.Builder][builder]
- [VpnService][vpnservice]
- [VPN guide][vpnguide]
- [LinkProperties][linkprops]

Official pages the AI sandbox could not reach. Classification verified by the Tech Lead (‡):

- [Android Developers Blog: DNS over TLS in Android P][dotblog] (A7)
- [Chrome Help: safety and security (Android)][chromehelp] (C1)
- [Mozilla Support: DoH protection levels in Firefox for Android][ffdoh] (F1, F2)
- [Mozilla Blog: Firefox DNS privacy on Android][ffblog] (F3, historical)

Official page known only from a search-engine excerpt (†, unverified):

- [Mozilla Support: configure networks to disable DoH][ffcanary] (F5)

Chromium source (`main`, read 2026-09-25): `net/dns/dns_client.cc`,
`net/dns/public/doh_provider_entry.cc`, `net/dns/dns_config_service_android.cc`,
`net/android/java/src/org/chromium/net/AndroidNetworkLibrary.java`, `net/base/features.cc`,
`chrome/browser/net/stub_resolver_config_reader.cc`.

[builder]: https://developer.android.com/reference/android/net/VpnService.Builder
[vpnservice]: https://developer.android.com/reference/android/net/VpnService
[vpnguide]: https://developer.android.com/develop/connectivity/vpn
[linkprops]: https://developer.android.com/reference/android/net/LinkProperties
[dotblog]: https://android-developers.googleblog.com/2018/04/dns-over-tls-support-in-android-p.html
[chromehelp]: https://support.google.com/chrome/answer/10468685
[ffdoh]: https://support.mozilla.org/en-US/kb/configure-dns-over-https-protection-levels-firefox-android
[ffblog]: https://blog.mozilla.org/en/firefox/dns-android/
[ffcanary]: https://support.mozilla.org/en-US/kb/configuring-networks-disable-dns-over-https

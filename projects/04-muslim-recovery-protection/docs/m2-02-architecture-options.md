# M2-02 — Protection Architecture: Revised Candidate

> **Project:** Muslim Recovery Protection  
> **Milestone:** M2 — Architecture & Truthful Product Claim  
> **Task:** M2-02 — Architecture options assessment ([issue #21](https://github.com/takh86/ai-engineering-lab/issues/21))  
> **Status:** **REVISED CANDIDATE — for final verification review before the Architecture Gate (M2-03). Nothing in this document is approved.**  
> **Date:** 2026-09-26  
> **Baseline:** M2-01 decisions H4–H12, approved by the Tech Lead
> ([`m2-01-approved-threat-model.md` @ `5291383`][m2-01], not yet on `main`). They are not reopened here.  
> **Supersedes:** the A1–A8 proposal (uploaded 2026-09-26, not in the repository) and the O1–O9 draft
> previously in this file (commit `e9f0e09`). See §B.  
> **Scope:** architecture and verification design only. No implementation, no production code, and no
> device, service or repository setting was changed.

Evidence classes, as in [M1-06](m1-06-coverage-gate.md) and [M1-07](m1-07-evidence-synthesis.md):

- **FACT** — read directly on 2026-09-26 from Android reference documentation, Chromium source, or
  Cloudflare's documentation source (§L sources).
- **HUMAN-REPORTED** — an M1 result reported by the Tech Lead
  ([M1-06 results](m1-06-execution-results.md)); M1 device evidence belongs to build `1492c108`.
- **EXPECTATION** — inferred from a FACT; must be confirmed on the device.
- **†** — known only from a search-engine excerpt or secondary reporting; re-read before relying on it.
- **ASSUMPTION**, **UNKNOWN** — as in M1. Complexity, performance and maintenance ratings are AI
  estimates; nothing was measured.

"Row D2" and similar are M1-06 rows. D1–D12 on their own are entries in [`decisions.md`](decisions.md).

---

## A. Revised Architecture Decision

### A.1 Candidate architecture

```text
One Android app — single artifact, no backend, no provider framework
├─ Recovery layer      independent: never depends on the filter layer's presence,
│                      state, code paths or data (H6, H12)
└─ Filter layer (A8)   optional; Android 9+ (API 28+); the app is NOT in the DNS path
    ├─ Guidance         explains the trade-off; the user sets Android Private DNS to the
    │                   provider host by hand (the app cannot and does not change it)
    ├─ Observation      LinkProperties of the active network:
    │                   isPrivateDnsActive(), getPrivateDnsServerName()
    ├─ On-demand check  provider test name vs neutral control, through the system
    │                   resolver, only on app foreground or "Check now"
    └─ State evaluator  pure logic: mechanism state + coverage + freshness (§F)

DNS path, outside the app:
apps → Android system resolver → DoT (strict Private DNS) → provider's filtering tier
```

### A.2 Proposed decisions (all PENDING; wording in §L)

1. **Recovery/filter boundary (H13).** The recovery layer never depends on the filter layer.
2. **A8 is the filter layer's verification candidate, not a production decision (H14).** Under A8,
   the user sets Android Private DNS to a filtering resolver they choose. The provider under
   verification is Cloudflare 1.1.1.1 for Families, DoT host `family.cloudflare-dns.com`.
   Production selection requires three things: the §I acceptance criteria, the privacy decision
   (§G, H18) and the Architecture Gate.
3. **Platform scope.** Private DNS exists from API 28. On API 24–27 the filter layer shows
   Unsupported and recovery is unaffected; minSdk stays 24.
4. **A2 is a deferred investigation, not an alternative that can be estimated now** (§D.4, §J Q4).
5. **A4 is split into two modes.**
   - **A4a Always-on** is a required companion of any VPN-based filter (reboot, row L4). It does
     not apply to A8.
   - **A4b Lockdown** is out of the MVP and needs its own connectivity matrix and decision.
6. **A1** stays the M1 experiment and evidence baseline, with no production path.
7. **A3, A5 and A6 are deferred. A7 is split into two parts.**
   - **A7a** Device Owner and legacy Device Admin are excluded by H5.
   - **A7b** AccessibilityService used as a URL detector is out of scope. If it is reopened, it is
     judged on H9, D1 and Play policy, not on H5.
8. **Nothing is implemented.** `filteringOperational` stays `false`, and no M1 code is removed by
   this document (§H).

### A.3 Recommendation

This section is kept separate from the neutral comparison in §D.

**Verify A8 first.** Taken from §D, the reasons are:

- It has the lowest complexity and maintenance cost.
- It satisfies H11 by construction, because it *is* Private DNS.
- It is expected to survive reboot, app kill and network changes, because the app is not in the
  DNS path. This covers M1 gaps L3b, L4, L5 and L6 (EXPECTATION, rows V6 and V8).
- It needs no VpnService, so there is no VpnService Play declaration and it does not take the
  device's single VPN slot.
- It has no packet-parsing surface.
- Its category blocking can be checked with a harmless test name that the provider documents (§E).

**Costs**, all to be accepted explicitly through §G:

- every DNS lookup goes to a third party;
- H8 friction cannot reach the Android setting that turns the filter off;
- browser and app DoH remain a gap, as they would for A2;
- it works on Android 9+ only.

**Confidence:** moderate for the order of verification; low for product effectiveness until the
§E results exist. This recommendation does **not** claim that A8 blocks better than the other
options.

---

## B. Changes Made From Previous Version

| # | Review item | Change | Where |
|---|---|---|---|
| 1 | M1 traceability missing (MAJOR) | Every M1 row group is traced to A8 and A2. For A2, G5-W, G5-M, G6, G10 and G11 are UNKNOWN. | §C |
| 2 | Issue #21 criteria incomplete (MAJOR) | All criteria are filled in for A8, A2 (minimal definition) and A1, and in compact form for the rest. The verdict column is removed from the matrix. | §D |
| 3 | Third-party DNS trade-off not a decision (MAJOR) | New pending decision H18, plus provider selection criteria | §G, §L |
| 4 | Impact on M1 and on D8–D12 undefined (MAJOR) | A disposition for `vpn/`, `dns/`, `domain/`, the manifest, the build and each decision | §H |
| 5 | A2 undefined (MAJOR) | A2 is now a deferred investigation, with a minimal definition, reopening triggers and a no-code first step | §A, §D.4, §J |
| 6 | A8 verifiability and claim limits (MAJOR; the review's F3 premise is corrected) | Cloudflare documents `nudity.testcategory.com`. A DNS check of it against controls verifies the category tier. Browser coverage is verified separately and never inferred from that check. | §E, §F, §I |
| 7 | Filter Active conditions (MAJOR) | Explicit mechanism conditions, with coverage taken only from committed evidence. Draft user texts added. | §F |
| 8 | Always-on and Lockdown deferred together (MINOR) | Split into A4a and A4b | §A, §D.2 |
| 9 | No acceptance or rejection thresholds (MINOR) | AC1–AC9 and RJ1–RJ6, with the consequence of each rejection | §I |
| 10 | Offline recovery attributed to H12 (MINOR) | Removed from H12. Proposed separately as H20, derived from H9 (local-first). | §L |
| 11 | Probe privacy (MINOR) | Checks use only provider-documented names; no background scheduler | §F.5 |
| 12 | A7 rationale (MINOR) | Split into A7a (H5) and A7b (H9, D1, Play) | §A, §D.2 |
| 13 | A8's name implied a monopoly on recovery (MINOR) | Renamed "guided Private DNS filtering". Recovery is a baseline shared by every option. | throughout |
| 14 | Evaluation mixed with recommendation (optional) | Neutral §D; the recommendation appears only in §A.3 | §A.3, §D |
| 15 | Chrome source evidence (optional) | Recorded as an EXPECTATION until row V3 | §E.4 |
| 16 | User research as a gate | Removed from the gates. Product-value research is left to M4/M6 with a privacy plan. | §K |
| 17 | Build variants | None added: one artifact | §H |
| 18 | Provider framework, background probes, parallel A2 work | None added | §F, §G, §H |
| 19 | M2-01 exists only on a side branch | Pre-gate action: merge it into `main` | §L |
| 20 | Source classes; Play links not verified | Classes are used throughout, and Play policy statements are marked † | §L |

**Kept unchanged:**

- recovery is independent of filtering;
- the three-dimension state model (mechanism, coverage, freshness);
- A8 is a verification candidate, not a production choice;
- A2 remains the local alternative, now defined as a deferred investigation;
- A4 is a mode, not an architecture;
- A3, A5 and A6 are deferred, and Device Owner is excluded;
- no backend;
- `filteringOperational=false`;
- neither Private DNS nor an encrypted upstream is assumed to meet the user's needs by itself.

**Mapping from the O1–O9 draft this file replaces:**

| Old | New |
|---|---|
| O1 | A1 |
| O2 | A2 (encrypted upstream) |
| O3 (encrypted-DNS denial) | Not adopted: it breaks a security setting the user chose (H11 spirit) and would need its own decision (§D.4) |
| O4 (VPN-advertised proxy) | Considered but not evaluated (§D.3) |
| O5 | A3 |
| O6 | A7b |
| O7 | A7a |
| O8 | A8 (third-party resolver) and A5 (own resolver) |
| O9 | A6 |

---

## C. M1 Traceability Matrix

No M1 device result is A8 evidence: M1 tested a different DNS path, on build `1492c108`.

What carries over to A8 is **behavior classes** (browser DoH bypasses the device's DNS path; a
strict Private DNS host takes precedence), not results.

| M1 evidence | Class | What it showed | A8 | A2 | Verify (§E) |
|---|---|---|---|---|---|
| G1–G4, G7, G8; rows D1, D3 | PASS (G7 detailed, the rest HUMAN-REPORTED) | With browser DoH off or as found, Chrome, Firefox and Samsung Internet used the device's DNS path in normal and private modes | EXPECTATION: the same browsers and modes use Android's resolver, now through Private DNS | Directly relevant; re-run on current `main` | V3 |
| Rows D2, D4, D5 | BYPASS (HUMAN-REPORTED) | Browser DoH switched on by the user goes around the device's DNS path | The same gap is expected → DISCLOSED | The same gap → DISCLOSED | V4 |
| G5-W, G5-M, G6, G10, G11 | INCONCLUSIVE | Unknown whether the VPN runs or refuses under Android's default Private DNS (Automatic) | Not a failure mode: A8 replaces Automatic with the strict provider host. Automatic means "filter Stopped" (§F). | Viability UNKNOWN; these rows are the first step if A2 is reopened (§D.4) | V1, V5 |
| P1–P4 | UNSUPPORTED (HUMAN-REPORTED) | A strict Private DNS host takes precedence over the app's DNS path | A8 builds on that precedence | Strict-mode behavior undefined; UNKNOWN whether queries even reach a VPN (DevicePolicyManager note, §L) | V1, V2 |
| P5 | INCONCLUSIVE | Private DNS switched on mid-session | Analogue: the user changes Private DNS → DETECTED at the next observation | Must stop or adapt truthfully | V5, V15 |
| G9-C, G9-F, L2 | INCONCLUSIVE | Already-running browsers, open tabs, cached answers or connections | Same risk right after enabling | Same | V7 |
| L1, L3a, L7 | PASS (HUMAN-REPORTED) | VPN start/stop, swipe from Recents, 30-min idle | Not applicable: no app runtime in the DNS path | Relevant | — |
| L3b, L4 | UNSUPPORTED | Force-stop and reboot end the VPN | EXPECTATION: unaffected, because the system setting persists. Uninstalling the app also leaves the setting in place (EXPECTATION). | Reboot needs A4a; force-stop stays outside the guarantee (H5) | V6 |
| L5, L6, L8 | UNSUPPORTED; L8 INCONCLUSIVE | A network change stops the session (no handover; M-1) | EXPECTATION: Private DNS applies "on all networks — including cellular" (Cloudflare's Android page). New risk: networks that block DoT. | Needs a handover design | V8, V10 |
| N1 | PASS (HUMAN-REPORTED) | IPv6-capable network usable | DoT over IPv6 and the blocked AAAA answer are UNKNOWN | Relevant | V9 |
| M1-06 "not measured": other browsers, in-app browsers, apps' own DoH, another VPN, deliberate disabling | UNKNOWN | — | Each must be classified COVERED, DETECTED or DISCLOSED | Same | V5, V11–V13 |
| D11 design limits: no TCP DNS, no IPv6 DNS transport, question name only, one worker | FACT (design) | Gaps in the local DNS pipeline | Not applicable: the system resolver and the provider handle transport. CNAME handling is on the provider side (ASSUMPTION). | Must be closed; each needs approval | V0 |
| M-1 fix (PR #32) | CI PASS on `5382a6c`; device run not recorded | A stale network produces a truthful stop | Not applicable | Relevant | — |
| Truthful state (no false `Protected`) | HUMAN-REPORTED + FACT | The invariant held | Must hold under §F | Must hold | V14 |
| Provenance: evidence on `1492c108`, not `main` | FACT | — | All A8 claims need new evidence | Re-run on current code | all |

---

## D. Candidate Comparison Matrix

This comparison is neutral: it has no verdict column and no weights. The recommendation is only in
§A.3.

### D.1 Serious candidates, all issue #21 criteria

A2 is assessed as its minimal definition in §D.4.

| Criterion | A8 — guided Private DNS filtering | A2 — improved DNS VPN (deferred) | A1 — M1 experiment (baseline) |
|---|---|---|---|
| Coverage against M1 bypasses | Browser DoH (rows D2, D4, D5): not covered → DISCLOSED. Strict host (P1–P4): it is the mechanism. Default Automatic (G5–G11 rows): replaced by the strict host through a user action. Lifecycle (L3b, L4, L5, L6): expected covered (V6, V8). Pre-existing state: V7. | Browser DoH: not covered. Default Automatic: UNKNOWN. Strict host: UNKNOWN. Lifecycle: needs A4a and handover. | Standard DNS path only. Refuses under active Private DNS. No reboot start, no handover. |
| Android APIs and permissions | Normal permissions only: `INTERNET` (for checks) and `ACCESS_NETWORK_STATE`. API 28+ `LinkProperties` getters. The app cannot set Private DNS, which is owner-only. | VpnService consent; service guarded by `BIND_VPN_SERVICE`; `FOREGROUND_SERVICE(_SYSTEM_EXEMPTED)`, `POST_NOTIFICATIONS`, `INTERNET`, `ACCESS_NETWORK_STATE`. A4a removes the D10 opt-out; mode detection needs API 29. | As A2, today |
| Play / distribution | No VpnService or Accessibility declaration. The listing discloses the third-party resolver; the app itself collects no DNS data. Low risk (policy pages †). | VpnService declaration required; eligibility of an on-device self-protection filter UNKNOWN (†) | Experiment; not distributable as is |
| Privacy impact | Every DNS lookup goes to the provider. Cloudflare deletes resolver logs within 25 h, except limited samples for aggregate statistics, and shares anonymized data with APNIC. It replaces the network's or the user's own resolver. The app stores no hostnames. Needs H18. | Hostnames parsed in memory on the device. Allowed queries go to the network's or user's resolver, encrypted where Private DNS applies. Updating the rule list may need a distribution channel (open question, H9). | As A2, with plaintext upstream; refuses when Private DNS is active |
| Security risk | No parsing or listening surface. Trust moves to the provider's answers and availability. DoT authenticates the host (the `LinkProperties` contract). | Packet-parsing surface (fuzz-tested in M1). Another app can slow DNS (single worker). A TLS client if it does its own DoT. Integrity of rule updates. | As A2 without TLS; experiment |
| Implementation complexity | Low: guidance, observation, on-demand check, pure evaluator | Medium to high: compliant encrypted upstream, Always-on lifecycle, handover, rule management | Exists as an experiment; production hardening means A2 |
| Testability | DNS-level oracle with a harmless provider test name and controls. State logic is JVM-testable. Browser coverage needs a device matrix. Provider behavior is external and must be re-verified at each release. | Pipeline is JVM-testable (M1 suite). Device matrix at M1-06 scale. | M1 suite exists |
| Performance / battery | Negligible: the app is not in the data path; checks run only on foreground or user request | Low to moderate: every DNS query passes through the app, plus TLS upstream | Low (L7 idle soak passed; not measured) |
| Lifecycle behavior | The system setting persists across reboot, app kill, updates and network changes (EXPECTATION: V6, V8). The app observes only while it runs (H5: "next available opportunity"). | VPN service lifecycle. Reboot needs A4a. Force-stop ends it (outside the guarantee, H5). A network change needs handover; today it stops (D12). | No boot start; stops on network change |
| Maintainability | Little code. Depends on the provider's hostnames, test names and policies (external change risk). | Protocol, rule-list and lifecycle upkeep | Experiment code; not maintained for production |
| Residual bypass surface | Browser or app DoH. Private DNS switched off or changed in Settings (a few taps; outside the guarantee; DETECTED). Another VPN (UNKNOWN, V11). Pre-existing connections (V7). Content inside allowed domains. Provider misclassification. | Browser or app DoH. System VPN disconnect or another VPN (H5). Apps' own DNS. Strict Private DNS (probably Unavailable). | As A2, plus refusal under active Private DNS |
| Fit with H4–H12 | H5 ✓. H8: friction only in in-app flows; the off switch is Android Settings. H9 ✓ for app data; the third-party flow needs H18. H10 ✓ via §E. H11 ✓ by construction. H12 ✓. | H5 ✓. H8 ✓ (friction on the in-app Stop). H9: rule distribution open. H10 needs an M1-06-scale matrix. H11 only with a compliant upstream. H12 ✓. | H11 ✓ (it refuses rather than downgrading); no production path |

### D.2 Modes and other options (compact)

The status column is screening against H4–H12. It is not a ranking.

| Option | What it adds | Main costs and risks | Fit | Status |
|---|---|---|---|---|
| A3 full-tunnel VPN (metadata only) | Blocking of known DoH/DoT endpoints and hard-coded resolvers | No guarantee against unknown DoH or ECH (RFC 9849). Parses all traffic. Very high complexity and battery cost. Likely a native dependency. | Allowed by H5; crosses the D1/D11 boundary | Deferred |
| A4a Always-on (user setting; mode) | Starts a VPN filter at boot | A system-start path; revisits D10 | ✓ (the user can switch it off) | Required with any VPN filter; N/A to A8 |
| A4b Lockdown (user setting; mode) | Blocks traffic when the VPN is down | Connectivity risk with a split tunnel (UNKNOWN); captive portals; recovery path | Allowed (user setting); high user-facing risk | Out of the MVP; separate decision and matrix |
| A5 own resolver via Private DNS | Our own classification | A backend; the project would hold DNS data; operations | Conflicts with H9 ("no backend required for the MVP") | Deferred (outside the MVP) |
| A6 browser-scoped | URL-level decisions inside our own browsing surface | Browser engineering; every other browser uncovered | ✓ | Deferred |
| A7a Device Owner / legacy Device Admin | Owner-enforced locks on settings | Onboarding by factory reset; device-wide blast radius | Conflicts with H5 | Excluded |
| A7b AccessibilityService as a URL detector | DNS-independent detection in supported browsers | Exposes screen content (H9); D1 review; Play disclosure; restricted settings and Advanced Protection trends (†); brittle | Not an H5 issue; tension with H9 | Out of scope; judged on these grounds if reopened |

### D.3 Considered, not evaluated

A VPN-advertised HTTP proxy (`VpnService.Builder.setHttpProxy`, API 29) could make browser DoH
irrelevant for browsers that honour it. The platform calls it "only a recommendation" that apps may
ignore. It is recorded here so that "browser DoH remains a gap" is clearly limited to the options
that were evaluated.

### D.4 A2: minimal definition and reopening triggers

**Minimal definition** (enough to estimate it if it is reopened):

1. A1's DNS-only split tunnel.
2. An upstream that follows the `LinkProperties` Private DNS contract:
   - in opportunistic mode, encrypt to a resolver from `getDnsServers()`;
   - in strict mode, encrypt to the named host with certificate validation, or show a truthful
     Unavailable state if queries do not reach the VPN;
   - never send plaintext while Private DNS is active (H11).
3. A4a Always-on support. No Lockdown.
4. A local rule list with recorded provenance, licence, signed updates and rollback. Its source is
   decided separately; no backend is assumed.
5. A §F-equivalent state model.

**Not included:** encrypted-DNS denial (breaking the user's own DoH or Private DNS choice, which
would need its own decision under the spirit of H11), a full tunnel, and a proxy.

**Reopening triggers** (any one):

- A8 is rejected for an A8-specific reason (§I) and a filter is still wanted;
- a product need for local rules, or for friction on an in-app off switch, is demonstrated;
- H18 is rejected.

**First step when reopened (no code):** re-run G5-W, G5-M, G6, G10 and G11 on current `main` with
`dumpsys` evidence, then estimate.

---

## E. A8 Verification Plan

The purpose is to produce the evidence §I needs. It is **not** implementation.

The Tech Lead runs it on the physical Samsung device, as in M1-06. Settings are changed by hand, and
`adb` is used only for read-only commands and name-resolution checks.

### E.1 Gate V0 — before any device row

1. **Test names (H19, extends D3).** Designate the following as harmless test names:
   - `nudity.testcategory.com`: Cloudflare says it "tests whether adult content and malware domains
     are blocked";
   - `malware.testcategory.com`: the malware tier;
   - controls `example.org` and `example.com` (IANA). The provider does not block them. M1's local
     list blocked `example.com`; A8 does not.
2. **Browser navigation to the test name.** The only evidence that the page is harmless is a search
   result title, "This is a test website provided by Cloudflare Gateway" (†).
   - The Tech Lead confirms this once before any browser row.
   - If navigation is not approved, rows V3, V4, V7 and V11–V13 fall back to weaker evidence
     (settings screenshots only) and cannot produce COVERED.
3. **Provider:** Cloudflare Families `family.cloudflare-dns.com`, documented for Android 9+ Private
   DNS.

### E.2 The oracle (DNS level)

Cloudflare documents that it "returns the address `0.0.0.0` instead of the real address" for a
blocked name. The documentation sentence says "classified as malicious"; V0 confirms the same
answer for the adult tier. The blocked AAAA answer is UNKNOWN (V9).

| Observation | Meaning |
|---|---|
| Test name → `0.0.0.0` (or `::`), control → a real address | Filtered on this path |
| Test name → a real address | Not filtered on this path |
| Control fails | Environment failure → INCONCLUSIVE, never PASS |
| Test name NXDOMAIN or other error | Not the provider's documented signal → INCONCLUSIVE |

The oracle never needs page content. With V0 approval, a browser BYPASS shows only Cloudflare's
test page.

### E.3 Safety rules

- Change Settings by hand only.
- `adb` only for reads and `ping`-based name resolution.
- Never use real adult domains.
- Record the as-found settings and restore them.
- No Always-on or Lockdown.
- No other DNS or VPN apps, except in V11.
- Redact SSIDs and IP addresses.
- Keep raw evidence outside the repository; commit one classified results document, as for M1-06.

### E.4 Matrix

The "Was" column gives the matching row ID from the A1–A8 proposal.

| ID | Was | Setup | Action | Expected (basis) | Result classes |
|---|---|---|---|---|---|
| V0 | T12 | Desktop, no device | `dig` the test names at `1.1.1.3` and at `1.1.1.1`; `dig` the controls at `1.1.1.3` | Test names `0.0.0.0` at `1.1.1.3` and a real address at `1.1.1.1`; controls real at both (Cloudflare docs). The malware name is informational only (†: a community report says the malware-only tier may not block it). | Oracle VALID / INVALID |
| V1 | T03 | Device: Wi-Fi, then cellular; Private DNS = provider host | Settings screenshot; `dumpsys connectivity` Private DNS lines; `dumpsys dnsresolver` validation | Strict mode active with the provider host | PASS / FAIL |
| V2 | T03 | As V1, plus a baseline with Private DNS Off | `adb shell ping -c 1 <name>`; read only the resolved address | Host set: test name `0.0.0.0`, controls real. Private DNS Off: test name real. | PASS / FAIL / INCONCLUSIVE |
| V3 | T01 | Host set; browser DNS settings as found (recorded) | Chrome normal and Incognito, Samsung Internet normal and Secret, Firefox normal and Private: open the test name (V0-gated), then a control | Error page with no content; control loads. Chrome EXPECTATION: its DoH upgrade list maps `family.cloudflare-dns.com` to Cloudflare's family DoH endpoint, but that entry is disabled by default, so Chrome should use Android's resolver; if it were enabled, Chrome would still stay on the family tier. | COVERED / BYPASS / INCONCLUSIVE |
| V4 | T02 | Host set | Chrome Secure DNS with a chosen non-filtering provider; Firefox DoH Increased and Max | BYPASS expected (the browser's own DoH); Cloudflare's test page shows | DISCLOSED (with evidence) / COVERED |
| V5 | T03 | Host set | Switch Private DNS to Automatic, to Off, and to another host; repeat V2 each time | Test name resolves, so filtering is off | DETECTED on the app side later (V15) |
| V6 | T07 | Host set | Reboot without opening the app, then V2. Force-stop the app, then V2. | Still blocked (EXPECTATION: the app is not in the DNS path) | PASS / FAIL |
| V7 | T08 | Private DNS Off; the browser loads the test name (V0-gated) and stays open | Set the host; reload at +0 s, +60 s and +5 min; then a cold start | A short window from cached answers or connections is possible; record it | DISCLOSED window / PASS |
| V8 | T04 | Host set | Wi-Fi → cellular → Wi-Fi; V2 and part of V3 on each | Blocked on every network | PASS / FAIL |
| V9 | T08 | Host set; IPv6-capable network | AAAA lookups (`ping6`) for the test name and a control; part of V3 | Test name AAAA `::` or none; control usable | PASS / FAIL / NOT RUN (no IPv6) |
| V10 | T05 | Host set | A network that blocks TCP 853 (router rule), and a captive-portal network, if available | DNS fails on that network. Record the system message and a recovery path: set Automatic, connect or log in, restore the host. | DISCLOSED with recovery documented / FAIL (no clear recovery) |
| V11 | T06 | Host set | Start a common VPN app that has its own DNS; V2 and part of V3 | UNKNOWN. The DevicePolicyManager note says the resolver "must be reachable both from within and outside the VPN". | COVERED / DISCLOSED |
| V12 | new | Host set | A Custom Tabs flow and a WebView in-app browser | UNKNOWN | COVERED / DISCLOSED |
| V13 | new | Host set | One more browser at default settings (for example Edge or Brave) | UNKNOWN | COVERED / DISCLOSED |

**Later rows.** These depend on an app and need a separate, approved prototype task. They are not
executed under this plan.

| ID | Was | Checks |
|---|---|---|
| V14 | T09 | §F accuracy: Filter Active only when its conditions hold; stale after a network change |
| V15 | T03, T09 | Private DNS change detected at the next foreground (H5) |
| V16 | T10 | Check privacy: only documented names; no hostnames in logs, storage or backup |
| V17 | T11 | Recovery works with the filter Unsupported, Unavailable or Stopped (H12); product acceptance for M3/M4 |

### E.5 Evidence and classification

Each row records:

- Settings screenshots;
- redacted `dumpsys` lines;
- the first `ping` line (name and address);
- browser screenshots with the URL bar and the exact error;
- Android, One UI and browser versions;
- network type;
- timestamps;
- the classification.

Classifications map to H4:

- **COVERED** means PASS within the tested boundary.
- **DETECTED** means Android exposes a reliable signal and the app's state changes truthfully; the
  app side needs V14 and V15.
- **DISCLOSED** means the path is neither prevented nor detected, and it is named in the claim's
  limitations.
- A row that is INCONCLUSIVE twice counts as not passed.

---

## F. Filter State / Coverage State Model

### F.1 Observed facts (A8)

| Fact | Source | Kept |
|---|---|---|
| F-api: API ≥ 28 | `Build.VERSION` | — |
| F-net: an active network exists | `ConnectivityManager` | memory |
| F-pdns: `isPrivateDnsActive()` | `LinkProperties` of the active network | memory |
| F-host: `getPrivateDnsServerName()` equals the provider host (exact match, case-insensitive) | same | memory |
| F-check: the last check on this network: test name → provider block answer, control → real address | system resolver | memory only, never persisted |
| F-vpn: the active network is a VPN | `NetworkCapabilities` | memory |
| Setup intent: the user completed setup | local preference | persisted. Used only for wording, never for Filter Active (D8 principle). |

### F.2 Mechanism state

The first matching rule wins.

| State | Condition | User meaning |
|---|---|---|
| Unsupported | not F-api | Filtering needs Android 9+ |
| Not set up | no setup intent and not F-host | Neutral onboarding state |
| Stopped | not F-host (Private DNS Off, Automatic or another host) | Filtering is off. If setup intent exists: "changed in Android settings" (DETECTED). |
| Unavailable | F-host but not F-pdns; or the last check failed with the control also failing | The resolver or network is unreachable |
| Error | the last check contradicts the configuration: the test name got a real address while F-host and F-pdns hold (this path is not filtered, e.g. another VPN) | Never Active |
| Degraded | F-host and F-pdns, but no fresh passing check (§F.4) | Set up, not verified on this network |
| **Filter Active** | F-api, F-pdns, F-host, and a fresh passing check | All conditions of the approved boundary are observed (H7) |

### F.3 Coverage

Coverage is a statement built only from the committed §E results. For each browser and mode it
says: covered (tested PASS), not covered (DISCLOSED) or not tested.

- Runtime facts can narrow coverage but never widen it. Example: another VPN is active (F-vpn) and
  V11 was not COVERED, so the text becomes "coverage not verified with another VPN".
- Filter Active never implies any browser row.

### F.4 Observation freshness

- A check is fresh only for the network it ran on, and only within the current app process.
- It expires on:
  - a network change or a Private DNS change (callbacks while the process lives);
  - a process restart.
- Checks run when the app comes to the foreground with a stale state, and when the user taps
  "Check now".
- There is **no** background service, scheduler or periodic job.
- The UI shows the check time. A time-based expiry can be added by the spec, but it may only shorten
  freshness.

### F.5 Check constraints (H9)

- Only provider-documented test names and neutral controls; never a name that identifies the app.
  The app contacts nothing else.
- Results are kept in memory only: no hostname or check history, and no hostnames in logs.
- Lookups go through the system resolver, the same path other apps use, bypassing the local cache
  where the platform allows (implementation detail).

### F.6 User-facing texts (drafts; final copy follows M2-01 §5)

| State | Draft |
|---|---|
| Filter Active | "Filter active on this network (checked 10:42). Covers apps that use Android's DNS. Tested browsers: Chrome, Samsung Internet. Browsers or apps using their own secure DNS are not covered." |
| System check passes, browser not tested | "System DNS filter: active (checked just now). Firefox: not tested — it may use its own secure DNS." |
| Degraded | "Set up, not yet checked on this network. [Check now]" |
| Stopped (after a change) | "Filtering is off: Android Private DNS was changed. Recovery tools still work." |
| Unavailable | "The filtering DNS can't be reached on this network. Android may have no internet here. [How to reconnect]" |
| Error | "The check failed: a test name wasn't blocked. Filtering may not be working on this network." |
| Unsupported | "Filtering needs Android 9 or later. Recovery tools work normally." |

The texts never say "Protected", "full protection" or any other wording M2-01 §5 rejects.

### F.7 Relation to D8

- D8's principle holds: state is computed from runtime facts only, and saved intent never produces
  Active.
- D8's `ProtectionSignals` fields are VPN-specific. A8 needs a Private-DNS signals type evaluated
  with the same discipline: pure logic with JVM tests.
- Renaming `ProtectionState.Protected` stays deferred (H7).
- If A2 is reopened, its mechanism facts are VPN, tunnel and upstream facts; coverage and freshness
  stay the same.

---

## G. Privacy & Trust Decision

Proposed decision H18 — PENDING.

### G.1 The decision

> When the user turns on filtering, Android sends every DNS lookup made by apps that use the system
> resolver, encrypted with DoT, to the filtering provider the user chose. The provider may keep
> query logs within its published policy. The project runs no server and receives nothing.

**Options:**

- accept for verification only (the Tech Lead's own device during §E);
- accept for production (after §I);
- reject: A8 stops, and either A2 is reopened (§D.4) or the product ships recovery-only (H12).

### G.2 What leaves the device

**Goes to the provider:** query names and types, timing, and the source IP, subject to the
provider's policy. This covers every app that uses Android's resolver, not only browsers.

**What is already true without A8:** DNS goes to the network's resolver (often the ISP, often in
plaintext) or to the user's own Private DNS choice. A8 changes who receives it, and encrypts the
path.

**Stays on the device:** recovery data, app usage, check results, and any identifier from the app.
The app's only own lookups are the check names.

### G.3 Provider facts — Cloudflare (FACT, documentation source)

- 1.1.1.1 for Families "uses the same privacy commitments" as 1.1.1.1.
- The source IP is not written to non-volatile storage, except randomly sampled packets from at
  most 0.05% of traffic, used for troubleshooting and attack mitigation. Truncated IPs are deleted
  within 25 hours.
- Resolver logs, which include query name and type, are deleted within 25 hours. The exception is
  limited sampled data, without IP addresses, used for aggregate statistics.
- APNIC can access anonymized query names, types and resolver location for research.
- The practices are audited by an accounting firm.

**This is not "zero logs".**

### G.4 User explanation

Shown before setup; the user can decline. Draft:

> "To filter, Android will send the names of the sites and services your apps look up to
> Cloudflare's family filter instead of your network's DNS. Cloudflare says it deletes these logs
> within 25 hours, apart from limited samples kept for statistics, and shares anonymized data with a
> research partner (APNIC). This app never sees
> or stores them. You can turn filtering off in Android settings at any time — uninstalling this
> app does not turn it off. Recovery tools work either way."

### G.5 Trust boundaries

- **Device ↔ provider:** DoT to the named host, certificate-validated under the Private DNS
  contract. This authenticates who answers, not whether the answers are right. The provider
  controls classification and availability.
- **App ↔ Android settings:** read-only observation. Only a device owner can set Private DNS.
- **App ↔ provider:** the check lookups only.

### G.6 Provider selection criteria

| # | Criterion | Cloudflare Families |
|---|---|---|
| 1 | Android Private DNS (DoT host) with an adult-content tier | FACT |
| 2 | A documented harmless test name blocked by that tier, and a documented blocked answer | FACT (docs); browser safety of the test page † (V0) |
| 3 | Published retention, IP handling, sharing and audit; no advertising or data sale | FACT |
| 4 | No account or identity needed (H9) | FACT: only a hostname is entered |
| 5 | Availability record and redundant anycast | UNKNOWN (not researched) |
| 6 | A misclassification feedback path that doesn't require sending browsing history | FACT: anonymous categorization feedback |
| 7 | Terms allow recommending the service; hostnames are stable | UNKNOWN (terms not read) |
| 8 | If Chrome's DoH upgrade list contains the host, it maps to the same filtering tier | FACT: Chromium maps it to the family DoH endpoint; the entry is disabled by default |

**Result:** Cloudflare is the provider under verification, not a final choice. There is no
provider framework: a provider is three data items (DoT host, test names, blocked answer).

---

## H. Migration Impact on Existing M1 / D8–D12 / `vpn/` / `dns/`

This document changes no code. The dispositions below apply only if the gate selects A8 for
production. The removal work would then become an M3 task under its own contract.

### H.1 Components

| Item | Today | If A8 is selected for production | If A2 is later reopened |
|---|---|---|---|
| `vpn/` (`LocalProtectionVpnService`, `VpnLifecycleController`, `DnsProxyRuntime`, `UnderlyingNetworkMonitor`, `UnderlyingNetworkDns`, `CapturedNetworkWatch`, `VpnRuntimeFacts`, `VpnRuntimeStatus`) | M1 experiment on `main` | Removed from the product (M3), after tagging the last experiment commit. Not disabled by a flag: a declared VpnService keeps the Play VpnService obligations (the A1–A8 proposal's point; Play policy †). | Basis for A2 |
| `dns/` (codec, IPv4/UDP adapter, filtering engine, packet processor, upstream selector, status, experimental rules) | M1 experiment | Removed together with `vpn/` | Reused and extended (§D.4) |
| `domain/rules/` `RuleSet` (D9) | Pure Kotlin, used by `dns/` | Unused, because the provider classifies. Removed unless the gate keeps local lists for another reason. | Reused |
| `domain/protection/` (D8) | VPN-shaped signals | Principle kept; signals replaced by Private-DNS facts (§F.7) | VPN signals extended |
| `MainActivity` harness | Development harness | Replaced by product UI (M4). V14–V16 need a separate prototype task. | — |
| Manifest | VpnService (guarded by `BIND_VPN_SERVICE`); `FOREGROUND_SERVICE(_SYSTEM_EXEMPTED)`; `POST_NOTIFICATIONS`; `INTERNET`; `ACCESS_NETWORK_STATE` | `INTERNET` and `ACCESS_NETWORK_STATE`; `POST_NOTIFICATIONS` only if a product feature needs it. No VpnService, no foreground service. | Unchanged |
| JVM tests | Cover `dns/`, `vpn/`, rules | Removed with their code; new tests for the §F evaluator | Kept |
| CI workflow | Builds, tests and lints project 04 | Unchanged | Unchanged |

### H.2 Decisions

| Decision | Under A8 | Under A2 |
|---|---|---|
| D1 (DNS hypothesis) | Answered by the M2-03 ADR; closed with a pointer | Same |
| D2–D7 | Unchanged | Unchanged |
| D3 (test domains) | Extended by H19 | Extended by H19 |
| D5 (no backend) | Kept; A8 needs no backend | Kept |
| D8 | Principle kept; amended for Private-DNS signals | Extended |
| D9 | Retired with `RuleSet` | Kept |
| D10, D11, D12 | Historical (M1 experiment) | Baseline |

### H.3 Artifact and roadmap

- **Artifact:** one app, with **no build variants**. The M1 experiment stays reproducible from its
  tag. Bringing VPN code back later needs an explicit decision.
- **Docs** (a separate docs task):
  - merge M2-01 into `main`;
  - update M1-07 (M-1 merged; gate state) and the README status;
  - update the roadmap.
- **Roadmap:** under A8, M3 "Protection Core V1" becomes a small filter-observation core plus the
  removal of the experiment code, and the recovery MVP (M4) carries more of the product. This
  roadmap change needs its own decision.

---

## I. Acceptance & Rejection Criteria

**Required browser set** (proposed; the Tech Lead confirms, §J Q2): the target device's default
browsers, Chrome (normal and Incognito) and Samsung Internet (normal and Secret), with browser DNS
settings as found.

### I.1 Accept A8 as the production filter architecture only if all of these hold

| ID | Criterion | Rows |
|---|---|---|
| AC1 | The oracle is valid | V0 |
| AC2 | The mechanism is active on Wi-Fi and on cellular | V1 |
| AC3 | The system path is blocked on Wi-Fi and cellular, and the controls resolve | V2 |
| AC4 | Every required browser row is COVERED and reproduced once | V3 |
| AC5 | Blocking persists after a reboot and after an app force-stop, without opening the app, and across Wi-Fi ↔ cellular | V6, V8 |
| AC6 | Every other row is classified COVERED, DETECTED or DISCLOSED with evidence; NOT RUN only with a stated reason | V4, V5, V7, V9–V13 |
| AC7 | Behavior when the resolver is unreachable or behind a captive portal is documented, with a working recovery path through standard Settings | V10 |
| AC8 | H18 is accepted | — |
| AC9 | H19 is accepted before any row | — |

### I.2 Reject A8 if any of these holds

| ID | Criterion | Consequence |
|---|---|---|
| RJ1 | Oracle invalid: the test name is not blocked by the family tier, or is also blocked by the unfiltered resolver (V0) | Stop. Retry V0 with another provider that meets §G.6, or reopen A2. |
| RJ2 | The mechanism or the system path fails on the target device on normal networks (V1, V2) | Stop A8; reopen A2 (§D.4) |
| RJ3 | A required browser row BYPASSes reproducibly at default settings (V3) | A2 would have the same browser-level gap, so reopening A2 does not help. The Tech Lead chooses between narrowing the claim to the browsers that pass and making no filter claim. |
| RJ4 | Blocking does not survive a reboot (V6) | Stop A8; reopen A2 |
| RJ5 | V10 shows the user can be left without connectivity and without a clear standard recovery path | Stop A8, or narrow the supported networks (Tech Lead) |
| RJ6 | H18 is rejected | Stop A8; A2 or recovery-only |

### I.3 Handling other results

- **Not decisive but recorded:** Firefox and other browsers must be classified COVERED or DISCLOSED.
  The claim covers only the COVERED rows (H10); DISCLOSED rows become its limitations.
- **INCONCLUSIVE:** a required row that is INCONCLUSIVE twice counts as not passed. The Tech Lead
  decides between another re-run and rejection.

---

## J. Answers to Reviewer Questions

1. **What exactly are the Filter Active conditions, and what text shows when the system check
   passes but browser coverage is unknown?**
   Filter Active holds only when all of the following are true:
   - the device runs API 28+;
   - Private DNS is active in strict mode with the provider host on the active network;
   - a check on this network, in this app session, got the provider's block answer for the test
     name while the control resolved.

   Nothing else produces Active: not the saved setup, not the host alone, not a check from another
   network. When the system check passes and a browser is untested, the app shows: "System DNS
   filter: active (checked just now). [Browser]: not tested — it may use its own secure DNS."
   (§F.2, §F.6)

2. **Which T1 rows must pass before A8 is accepted, and what result stops it?**
   - **Must pass:** V3 COVERED for Chrome (normal, Incognito) and Samsung Internet (normal,
     Secret) at default settings, plus V1, V2, V6 and V8.
   - **Stops A8:** any of RJ1–RJ6. RJ3, a reproducible default-settings BYPASS in a required
     browser, leads to narrowing the claim or making no filter claim, because A2 shares that gap.
   - **Other browsers:** Firefox and the rest do not block acceptance. They must be classified, and
     the claim excludes them if they are DISCLOSED. (§I)

3. **Does the Tech Lead accept sending DNS queries to the chosen provider, and how is it explained to
   the user?**
   This is not decided. H18 is pending and belongs to the Tech Lead. Running §E already sends the
   test device's DNS to Cloudflare, so the first sub-decision is to accept it "for verification".
   The user explanation in §G.4 appears before setup, with a way to decline, and recovery works
   either way.

4. **Can A2 be estimated now, or is it a deferred investigation?**
   It is a deferred investigation. Four things are unknown or open:
   - whether it works under Android's default Private DNS (five INCONCLUSIVE M1 rows);
   - how it behaves under a strict Private DNS host;
   - whether Play accepts it;
   - where its rule list comes from.

   §D.4 records a minimal definition, the triggers that reopen it and the first no-code step:
   re-run the five rows on current `main`.

5. **Which old parts and decisions does A8 replace, and what does the published artifact look like?**
   - **Code:** the product drops `vpn/` and `dns/`, and `RuleSet` too unless it is kept for
     another reason.
   - **Decisions:** D8's principle stays with Private-DNS signals; D9 is retired; D10–D12 become
     historical.
   - **Artifact:** a single app with normal permissions (`INTERNET`, `ACCESS_NETWORK_STATE`), no
     VpnService, no foreground service, no backend and no build variants. The experiment stays
     reproducible from a tag.
   - **Play:** no VpnService declaration; the listing discloses the third-party resolver. (§H)

---

## K. Remaining Unknowns

| ID | Unknown | Resolved by | Affects |
|---|---|---|---|
| U1 | Whether `nudity.testcategory.com` is safe to open in a browser; only a search-result title says it is a Cloudflare test site | V0 gate (Tech Lead) | V3, V4, V7, V11–V13 |
| U2 | The AAAA answer for blocked names | V9 | Oracle |
| U3 | Whether Firefox uses its own DoH by default in the tested region while Private DNS is strict | V3 | Claim scope |
| U4 | Samsung Internet's own DNS behavior | V3 | AC4 |
| U5 | Another VPN running together with A8 | V11 | T4 coverage |
| U6 | In-app browsers and WebView | V12 | Claim scope |
| U7 | Captive portals and DoT-blocking networks on the target device, and the exact system message | V10 | AC7 |
| U8 | The cache or connection window right after enabling | V7 | Claim limitations |
| U9 | What `isPrivateDnsActive()` reports when the strict host fails validation | V10, later V14 | §F Unavailable |
| U10 | Cloudflare's availability record and terms | Desk research (§G.6 #5, #7) | H18 |
| U11 | Play listing wording for an app that guides users to a third-party DNS (policy pages †) | The Tech Lead reads the Play Console | Distribution |
| U12 | Whether the malware test name separates the two Families tiers (†) | V0 | Use the nudity name as the family oracle |
| U13 | Whether the recovery layer is valuable enough on its own | Product research in M4/M6 with a privacy plan; not an architecture gate | Product |
| U14 | Whether A2 works under Android's default Private DNS | Only if A2 is reopened | A2 |

---

## L. Updated ADR / Architecture Baseline Candidate

### ADR-M2-02 — Filter layer: verify guided Private DNS (A8) first

**Status:** Proposed. It goes to final verification review, then to the Architecture Gate (M2-03).
It is not accepted.

**Context:** In M1, a DNS-only VpnService filter:

- worked on the standard DNS path;
- was bypassed by browser DoH (rows D2, D4, D5);
- refused to run under a user-set Private DNS host (P1–P4);
- left its behavior under Android's default Private DNS unknown (G5-W, G5-M, G6, G10, G11).

M2-01 approved:

- recovery first (H6, H12);
- no OS-level locks (H5);
- privacy with no backend (H9);
- claim control (H10);
- no Private DNS downgrade (H11).

**Options considered:** A1–A8 (§D).

**Decision (proposed):** H13–H20 below.

**Why:** §A.3.

**Trade-offs:**

- a third-party DNS data flow (H18);
- the off switch sits in Android Settings, outside H8 friction;
- browser DoH stays DISCLOSED;
- API 28+ only;
- dependence on a provider.

**Consequences:** the §H migration if accepted; verification per §E before any production claim;
A2 kept as a defined, deferred investigation.

**AI contribution:** AI (Claude) did the analysis and drafting as input to the Tech Lead's decision.
The Tech Lead owns the decision.

### Decision items (all PENDING)

| ID | Proposed wording | Relation to the A1–A8 proposal |
|---|---|---|
| H13 | Recovery/filter boundary: the recovery layer never depends on the filter layer's presence, state, code paths or data. Filter absence, failure, an unsupported platform or the user's choice never changes recovery behavior. | Its H13, rewritten as a boundary |
| H14 | A8 is the filter layer's verification candidate. The user sets Android Private DNS (strict) to a filtering provider; the provider under verification is Cloudflare Families `family.cloudflare-dns.com`. The filter layer is API 28+, shown Unsupported below that, with minSdk unchanged. Production selection only after §I acceptance, H18 and the gate. | Its H14 |
| H15 | Mechanism state, coverage and freshness are separate. Filter Active only under the §F.2 conditions. Coverage comes only from committed verification results. Checks run only on foreground or user request; no background probes. | Its H15, made precise |
| H16 | A4a Always-on is required with any VPN-based filter (N/A to A8). A4b Lockdown is out of the MVP pending its own matrix. A3, A5 and A6 are deferred. A7a is excluded (H5). A7b is out of scope; if reopened it is judged on H9, D1 and Play. A2 is a deferred investigation with the §D.4 triggers. | Its H16, split |
| H17 | Next step: the Tech Lead runs §E rows V0–V13 on the target device after H19, and the results are committed as a classified report. No implementation. V14–V17 need a separate, approved prototype task. | Its H17, made concrete |
| H18 | Privacy and trust: accept or reject the third-party DNS data flow for A8, for verification and for production (§G) | New |
| H19 | Test names (extends D3): `nudity.testcategory.com` and `malware.testcategory.com` for DNS-level checks; browser navigation to them only after the Tech Lead confirms they are harmless test pages; controls `example.org` and `example.com` | New |
| H20 | Optional, derived from H9 (local-first), not from H12: recovery also works without internet | New; corrects the H12 attribution |

### Pre-gate actions (Tech Lead)

1. Merge `docs/04-m2-01-approved-decisions` (`5291383`) into `main`, so that H4–H12 are in the formal
   reference before M2-03.
2. Decide H19, and at least the "for verification" part of H18; then run §E.
3. Separate docs task: M1-07 status after PR #32, README status, roadmap update (§H.3).

### Architecture baseline candidate

If §I passes, the gate would approve:

- the §A.1 structure;
- the §F state model;
- the §G decision;
- the §H dispositions.

### Sources

Android reference, read directly (FACT):

- [LinkProperties][linkprops] — Private DNS contract, API 28
- [DevicePolicyManager][dpm] — Private DNS is owner-only; the note on VPN reachability
- [VpnService][vpnservice], [VPN guide][vpnguide], [VpnService.Builder][builder]
- [UserManager][usermanager]

Chromium source, `main`, through the GitHub mirror (FACT):

- [`net/dns/public/doh_provider_entry.cc`][cr-doh] — the `CloudflareFamily` entry, disabled by
  default
- [`net/dns/dns_util.cc`][cr-dnsutil] — `GetDohUpgradeServersFromDotHostname` requires the entry's
  feature to be enabled
- [`chrome/browser/net/stub_resolver_config_reader.cc`][cr-stub]

Cloudflare documentation source, `production` branch on GitHub (FACT), and the published pages:

- [`1.1.1.1/setup/index.mdx`][cf-setup-src] ([page][cf-setup]) — Families tiers, `0.0.0.0`, test
  URLs, miscategorization feedback
- [`1.1.1.1/setup/android.mdx`][cf-android-src] ([page][cf-android]) — Android 9+ Private DNS host
- [`1.1.1.1/privacy/public-dns-resolver.mdx`][cf-privacy-src] ([page][cf-privacy]) — retention, IP
  handling, APNIC, audit
- [`cloudflare-one/traffic-policies/dns-policies/test-dns-filtering.mdx`][cf-test-src] — the
  `testcategory.com` naming format

† Search excerpts, not verified:

- the `nudity.testcategory.com` page title;
- a Cloudflare community thread on the malware-only tier;
- the Play VpnService and sensitive-permissions policies ([VpnService][play-vpn],
  [sensitive permissions][play-perms]).

Project sources:

- [M1-06 results](m1-06-execution-results.md)
- [M1-07](m1-07-evidence-synthesis.md)
- [`decisions.md`](decisions.md), [`requirements.md`](requirements.md), [`roadmap.md`](roadmap.md),
  [`architecture.md`](architecture.md)
- [M2-01][m2-01]
- [issue #21](https://github.com/takh86/ai-engineering-lab/issues/21)
- [PR #32](https://github.com/takh86/ai-engineering-lab/pull/32)

[m2-01]: https://github.com/takh86/ai-engineering-lab/blob/529138340c74b29a78298e60ef6019dc3ff2083d/projects/04-muslim-recovery-protection/docs/m2-01-approved-threat-model.md
[linkprops]: https://developer.android.com/reference/android/net/LinkProperties
[dpm]: https://developer.android.com/reference/android/app/admin/DevicePolicyManager
[vpnservice]: https://developer.android.com/reference/android/net/VpnService
[vpnguide]: https://developer.android.com/develop/connectivity/vpn
[builder]: https://developer.android.com/reference/android/net/VpnService.Builder
[usermanager]: https://developer.android.com/reference/android/os/UserManager
[cr-doh]: https://github.com/chromium/chromium/blob/main/net/dns/public/doh_provider_entry.cc
[cr-dnsutil]: https://github.com/chromium/chromium/blob/main/net/dns/dns_util.cc
[cr-stub]: https://github.com/chromium/chromium/blob/main/chrome/browser/net/stub_resolver_config_reader.cc
[cf-setup-src]: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/1.1.1.1/setup/index.mdx
[cf-setup]: https://developers.cloudflare.com/1.1.1.1/setup/
[cf-android-src]: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/1.1.1.1/setup/android.mdx
[cf-android]: https://developers.cloudflare.com/1.1.1.1/setup/android/
[cf-privacy-src]: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/1.1.1.1/privacy/public-dns-resolver.mdx
[cf-privacy]: https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/
[cf-test-src]: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/cloudflare-one/traffic-policies/dns-policies/test-dns-filtering.mdx
[play-vpn]: https://support.google.com/googleplay/android-developer/answer/12564964
[play-perms]: https://support.google.com/googleplay/android-developer/answer/16585319

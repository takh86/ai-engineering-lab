# M2-02 — Protection Architecture Baseline

> **Project:** Muslim Recovery Protection  
> **Milestone:** M2 — Architecture & Truthful Product Claim  
> **Task:** M2-02 — Architecture options assessment ([issue #21](https://github.com/takh86/ai-engineering-lab/issues/21)); input to the M2-03 ADR  
> **Status:** **FINAL ARCHITECTURE BASELINE.** Issued on 2026-09-26 at the Tech Lead's direction,
> which closed the review loop. Still required:
> - the Tech Lead records the decision in M2-03 (§L);
> - no device test starts until the Tech Lead records gate G0 — H18 (verification scope), H19 and
>   H21 (§E.1);
> - A8 is accepted for production only on a §I PASS.
>
> **Date:** 2026-09-26  
> **Revision:** final baseline after the second verification review of `bff6c09` (status BLOCK).
> Every item is resolved in §B.3; earlier reviews are in §B.1 and §B.2.  
> **Approved inputs:** M2-01 decisions H4–H12, approved by the Tech Lead
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

### A.2 Decisions (final wording in §L; the Tech Lead records them in M2-03)

1. **Recovery/filter boundary (H13).** The recovery layer never depends on the filter layer.
2. **A8 is the filter layer's verification candidate, not a production decision (H14).** Under A8,
   the user sets Android Private DNS to a filtering resolver they choose. The provider under
   verification is Cloudflare 1.1.1.1 for Families, DoT host `family.cloudflare-dns.com`.
   Production selection requires three things: the §I acceptance criteria, the privacy decision
   (§G, H18) and the Architecture Gate. No device test starts before gate G0 (§E.1).
3. **Platform scope.** Private DNS exists from API 28. On API 24–27 the filter layer shows
   Unsupported and recovery is unaffected; minSdk stays 24.
4. **A2 is a deferred investigation, not an alternative that can be estimated now** (§D.4, §J Q4).
5. **A4 is split into two modes.**
   - **A4a Always-on** is needed only if a VPN-based filter claims coverage after reboot (row L4).
     That claim would then need a lifecycle test when A2 is reopened; without it, reboot is
     DISCLOSED for that filter. It does not apply to A8.
   - **A4b Lockdown** is out of the MVP and needs its own connectivity matrix and decision.
6. **A1** stays the M1 experiment and evidence baseline, with no production path.
7. **A3, A5 and A6 are deferred. A7 is split into two parts.**
   - **A7a** Device Owner and legacy Device Admin are excluded by H5.
   - **A7b** AccessibilityService used as a URL detector is out of scope. If it is reopened, it is
     judged on H9, D1 and Play policy, not on H5.
8. **Nothing is implemented.** `filteringOperational` stays `false`, and no M1 code is removed by
   this document (§H).
9. **T1 scope and test gate.** The T1 browser set is registered before testing (H21, §I.1). No
   device test runs before gate G0: H18 (verification scope), H19 and H21 (§E.1). The outcomes of
   verification are decided in advance (§I.3).

### A.3 Recommendation

This section is kept separate from the neutral comparison in §D.

**Verify A8 first.** Taken from §D, the reasons are:

- It has the lowest complexity and maintenance cost.
- It satisfies H11 by construction, because it *is* Private DNS.
- It is expected to survive reboot, app kill and network changes, because the app is not in the
  DNS path. This covers M1 gaps L3b, L4, L5 and L6 (EXPECTATION: rows V6 and V8; app kill with
  the prototype, V14).
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

### B.1 First revision (`df69d43`): independent review of the A1–A8 proposal

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

### B.2 Baseline revision: final verification review of `df69d43` (status BLOCK)

| # | Review finding | Resolution | Where |
|---|---|---|---|
| 1 | Filter Active evidence had no time limit, so Active could stay on screen for hours after a provider failure (blocking) | Check evidence expires after `CHECK_TTL` = 10 minutes, and also on a network change, a Private DNS change or a process restart. Expired evidence lowers every check-derived state to Degraded until a new check runs. The UI applies the expiry by itself, without any network activity. | §F.4, §F.2, §L H15 |
| 2 | Browser coverage was shown without the configuration it was tested in | Every coverage entry records browser, mode, version, DNS setting, OS, device, date and evidence. Texts say "tested with …" and state that the app cannot see browser settings. Coverage is re-verified before each release. | §F.3, §F.6 |
| 3 | The T1 browser set was only proposed, and Firefox could fail at default settings while A8 still passed (contradiction with H4; blocking) | New decision H21 pre-registers the T1 set before any device row: Chrome, Samsung Internet and Firefox, each in normal and private mode, at default settings. AC4 requires every one of these rows. | §I.1, §I.2, §L H21 |
| 4 | RJ3 mixed "the candidate failed" with "the scope was narrowed" (blocking) | RJ3 now means the candidate failed for the registered scope. Narrowing the scope is a separate, recorded Tech Lead decision followed by re-evaluation, and is never a pass. | §I.3 |
| 5 | Oracle validity in V0 depended on the informational malware name (blocking) | Validity now rests on the required category name only. The malware name is recorded but never affects validity. | §E.4 V0 |
| 6 | No outcome was defined if browser navigation is not approved (blocking) | Deterministic outcome: A8 is NOT VERIFIABLE for the T1 claim and is not accepted, and no device row runs. Each follow-up is its own decision. | §E.1, §I.3 |
| 7 | H18 was pending, yet device tests could start | Gate G0: H18 (verification scope), H19 and H21 must be recorded before V1. V0 needs H19a only. | §E.1, §L |
| 8 | H16 made Always-on an absolute rule (new risk) | A4a is conditional: only for a VPN-based filter that claims coverage after reboot, and only with a lifecycle test | §A.2, §D.2, §D.4, §L H16 |
| 9 | No named T2 register and no way to measure steps and time (gap against H4) | Register B1–B12, each with an expected class, the signal the app can use and the row that measures it. A friction protocol measures steps and time. No numeric threshold is set. | §E.6, §I.2 AC6 |
| 10 | H20 must not become an implementation precondition | Stated in H20 | §L |
| 11 | Found in self-review: the friction protocol assumed an app showing Filter Active, but no A8 app exists during verification | The start state uses the V2 method. The app side of detection moves to V14–V15, and AC6 is split to match. | §E.6, §I.2 |
| 12 | Found in self-review: V6 force-stopped an app that does not exist during verification | V6 is now reboot only. Force-stop and uninstall are checked with the prototype (V14). | §E.4, §E.6, §I.2 AC5 |
| 13 | Found in self-review: no state existed for "no active network", so being offline would read as Stopped | New first-match row "Unavailable (offline)" | §F.2 |

### B.3 Final baseline: second verification review of `bff6c09` (status BLOCK)

The Tech Lead then directed that this revision be issued as the final baseline.

| # | Review finding | Resolution | Where |
|---|---|---|---|
| 1 | V3 tested DNS settings "as found", but a setting the user changed is not the default that H4 covers | Default-setting rule. Establish the default for the installed version and region. If the as-found setting differs, test it as a separate, characterization-only row, then test the default with the Tech Lead's consent (given in G0) and restore the as-found setting. Region is recorded and scopes the claim. | §I.1, §E.1, §E.4 V3, §F.3, §L H21 |
| 2 | B11 and B12 were classed "Not a bypass" instead of an H4 class; V14 did not list the tests the register cited; DETECTED was treated as final on the Android signal alone | Every register action now has one H4 class marked *expected*, with separate columns for gate evidence and final evidence. V14 and V15 list every test the register cites. DETECTED becomes final only after V14 or V15 proves the app's response; a failure reclassifies the action to DISCLOSED. | §E.6, §E.4, §E.5, §I.2 AC6 |
| 3 | V0 asked for AAAA answers, although the AAAA answer is UNKNOWN and belongs to V9 | V0 and V2 decide on A answers only; AAAA is decided only in V9 | §E.2, §E.4 V0 |
| 4 | B10 implied that A8 has a technical off switch | Renamed "optional in-app guidance". It is not a technical control: the actual change is B1 in Android Settings, and the guidance can be skipped, so it never counts toward bypass cost. | §E.6 |
| 5 | V5 inferred the setting change from name resolution, but after switching to Automatic the network's own resolver may still block the test name | V5 is decided by the system signal (`dumpsys`). Resolution is recorded as information, on a network whose own resolver was shown to be unfiltered (V2 baseline). The friction end condition uses the same rule. | §E.4 V5, §E.6 |
| 6 | Found in self-review: an unmet criterion with no RJ condition (for example, a row still INCONCLUSIVE after its extra run) had no outcome, although §I.3 promises outcomes decided in advance | New outcome INCOMPLETE: A8 is not accepted yet, the cause is recorded, and only the affected rows are run again under the same scope. A scope change may follow it, as after a FAIL. | §I.1, §I.3, §J Q2 |
| 7 | Status after the Tech Lead's direction | Final baseline. The review loop is closed; the Tech Lead records the decision in M2-03 and gate G0. H18, H19 and H21 are not recorded here on the Tech Lead's behalf. | Header, §A.2, §L |

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
| P5 | INCONCLUSIVE | Private DNS switched on mid-session | Analogue: the user changes Private DNS → DETECTED (expected) at the next observation | Must stop or adapt truthfully | V5, V15 |
| G9-C, G9-F, L2 | INCONCLUSIVE | Already-running browsers, open tabs, cached answers or connections | Same risk right after enabling | Same | V7 |
| L1, L3a, L7 | PASS (HUMAN-REPORTED) | VPN start/stop, swipe from Recents, 30-min idle | Not applicable: no app runtime in the DNS path | Relevant | — |
| L3b, L4 | UNSUPPORTED | Force-stop and reboot end the VPN | EXPECTATION: unaffected, because the system setting persists. Uninstalling the app also leaves the setting in place (EXPECTATION). | Reboot coverage needs A4a; force-stop stays outside the guarantee (H5) | V6 (reboot); V14 (force-stop, uninstall) |
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
| Lifecycle behavior | The system setting persists across reboot, app kill, updates and network changes (EXPECTATION: V6, V8; app kill with the prototype, V14). The app observes only while it runs (H5: "next available opportunity"). | VPN service lifecycle. Reboot needs A4a. Force-stop ends it (outside the guarantee, H5). A network change needs handover; today it stops (D12). | No boot start; stops on network change |
| Maintainability | Little code. Depends on the provider's hostnames, test names and policies (external change risk). | Protocol, rule-list and lifecycle upkeep | Experiment code; not maintained for production |
| Residual bypass surface | Browser or app DoH. Private DNS switched off or changed in Settings (a few taps; outside the guarantee; DETECTED, expected). Another VPN (UNKNOWN, V11). Pre-existing connections (V7). Content inside allowed domains. Provider misclassification. | Browser or app DoH. System VPN disconnect or another VPN (H5). Apps' own DNS. Strict Private DNS (probably Unavailable). | As A2, plus refusal under active Private DNS |
| Fit with H4–H12 | H5 ✓. H8: friction only in in-app flows; the off switch is Android Settings. H9 ✓ for app data; the third-party flow needs H18. H10 ✓ via §E. H11 ✓ by construction. H12 ✓. | H5 ✓. H8 ✓ (friction on the in-app Stop). H9: rule distribution open. H10 needs an M1-06-scale matrix. H11 only with a compliant upstream. H12 ✓. | H11 ✓ (it refuses rather than downgrading); no production path |

### D.2 Modes and other options (compact)

The status column is screening against H4–H12. It is not a ranking.

| Option | What it adds | Main costs and risks | Fit | Status |
|---|---|---|---|---|
| A3 full-tunnel VPN (metadata only) | Blocking of known DoH/DoT endpoints and hard-coded resolvers | No guarantee against unknown DoH or ECH (RFC 9849). Parses all traffic. Very high complexity and battery cost. Likely a native dependency. | Allowed by H5; crosses the D1/D11 boundary | Deferred |
| A4a Always-on (user setting; mode) | Starts a VPN filter at boot | A system-start path; revisits D10 | ✓ (the user can switch it off) | Needed only if a VPN-based filter claims coverage after reboot, backed by a lifecycle test when A2 is reopened; N/A to A8 |
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
3. A4a Always-on support if A2 claims coverage after reboot, backed by a lifecycle test (reboot,
   force-stop, update); otherwise reboot is DISCLOSED. No Lockdown.
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

### E.1 Gate G0 — decisions recorded before any test

| Decision | Needed before | Content |
|---|---|---|
| H19a — test names (extends D3) | V0 | Harmless test names: `nudity.testcategory.com` (the **category name**: Cloudflare says it "tests whether adult content and malware domains are blocked") and `malware.testcategory.com` (informational only). Controls: `example.org` and `example.com` (IANA). The provider does not block the controls; M1's local list blocked `example.com`, A8 does not. |
| H19b — browser navigation | V3, V4, V7, V11–V13 and the browser-level friction runs (§E.6) | Whether browsers may open the category test page. The only evidence that the page is harmless is a search-result title, "This is a test website provided by Cloudflare Gateway" (†). The Tech Lead checks it once before deciding. |
| H18 — verification scope | V1 and every later device row | Accept that the test device's DNS goes to the provider while the tests run (§G). |
| H21 — T1 browser set | V1 | The browsers and modes the T1 claim will cover, each at its default DNS setting, registered before any result exists (§I.1). It includes consent to switch a browser's DNS setting to its default for the test and to restore the as-found setting afterwards. |

Provider: Cloudflare Families `family.cloudflare-dns.com`, documented for Android 9+ Private DNS.

**If H19b is not approved, the outcome is fixed in advance:**

- No validated alternative currently gives equivalent browser evidence. A resolver-diagnostic page
  (for example Cloudflare's `1.1.1.1/help`) is an unvalidated candidate (U15). It counts as
  equivalent only after it has been validated and the Tech Lead records that decision.
- Until then, V3 cannot produce COVERED, so AC4 cannot be met. **No device row runs**, and A8's
  outcome is **NOT VERIFIABLE for the T1 claim — not accepted** (§I.3).
- Each follow-up is a separate decision:
  - approve navigation later;
  - validate and approve the alternative;
  - reopen A2, whose browser evidence can use the IANA example domains through local rules, as M1
    did;
  - amend H4 to drop browser claims, which would be a product-scope change to M2-01.

### E.2 The oracle (DNS level)

Cloudflare documents that it "returns the address `0.0.0.0` instead of the real address" for a
blocked name. The documentation sentence says "classified as malicious"; V0 confirms the same
answer for the adult tier. The blocked AAAA answer is UNKNOWN (V9).

V0 and V2 decide on **A answers only**. The AAAA answer is decided only in V9.

| Observation | Meaning |
|---|---|
| Test name A → `0.0.0.0`, control → a real address | Filtered on this path |
| Test name → a real address | Not filtered on this path |
| Control fails | Environment failure → INCONCLUSIVE, never PASS |
| Test name NXDOMAIN or other error | Not the provider's documented signal → INCONCLUSIVE |

The oracle never needs page content. With H19b approval, a browser BYPASS shows only Cloudflare's
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
| V0 | T12 | Desktop, no device; after H19a | `dig A` for the category name and the controls at `1.1.1.3` and at `1.1.1.1`; record `malware.testcategory.com` the same way | **Validity rests on the category name's A answer only.** It gets `0.0.0.0` at `1.1.1.3` and a real address at `1.1.1.1`, and the controls get real addresses at both (Cloudflare docs). AAAA is left to V9. The malware name's result is recorded but never affects validity (†: a community report says the malware-only tier may not block it). | Oracle VALID / INVALID |
| V1 | T03 | Device: Wi-Fi, then cellular; Private DNS = provider host | Settings screenshot; `dumpsys connectivity` Private DNS lines; `dumpsys dnsresolver` validation | Strict mode active with the provider host | PASS / FAIL |
| V2 | T03 | As V1, plus a baseline with Private DNS Off | `adb shell ping -c 1 <name>`; read only the resolved IPv4 (A) address | Host set: category name `0.0.0.0`, controls real. Private DNS Off: category name real, which also shows that the network's own resolver does not block it (needed by V5 and §E.6). | PASS / FAIL / INCONCLUSIVE |
| V3 | T01 | Host set; each H21 browser at its default DNS setting, following the §I.1 default-setting rule. The as-found setting is recorded, and if it differs it is tested as a separate characterization row. | Every H21 row (§I.1): Chrome normal and Incognito, Samsung Internet normal and Secret, Firefox normal and Private. Open the category name (H19b), then a control; two runs per row. | Error page with no content; control loads. Chrome EXPECTATION: its DoH upgrade list maps `family.cloudflare-dns.com` to Cloudflare's family DoH endpoint, but that entry is disabled by default, so Chrome should use Android's resolver; if it were enabled, Chrome would still stay on the family tier. | COVERED / BYPASS / INCONCLUSIVE |
| V4 | T02 | Host set | Chrome Secure DNS with a chosen non-filtering provider; Firefox DoH Increased and Max | BYPASS expected (the browser's own DoH); Cloudflare's test page shows | DISCLOSED (with evidence) / COVERED |
| V5 | T03 | Host set, on a network whose own resolver the V2 baseline showed to be unfiltered | Switch Private DNS to Automatic, to Off, and to another host; each time record `dumpsys connectivity`, then repeat V2 | **Decided by the system signal:** `dumpsys` shows that the provider host is no longer in use. This is the Android signal a DETECTED class relies on. The V2 result is recorded as information only: another resolver may still block the name. | Signal PASS / FAIL; the app side is checked later (V15) |
| V6 | T07 | Host set | Reboot, then V2 before opening any app | Still blocked (EXPECTATION: no app is in the DNS path; during verification no A8 app exists). Force-stop and uninstall of the app are checked with the prototype (V14). | PASS / FAIL |
| V7 | T08 | Private DNS Off; the browser loads the category name (H19b) and stays open | Set the host; reload at +0 s, +60 s and +5 min; then a cold start | A short window from cached answers or connections is possible; record it | DISCLOSED window / PASS |
| V8 | T04 | Host set | Wi-Fi → cellular → Wi-Fi; V2 and part of V3 on each | Blocked on every network | PASS / FAIL |
| V9 | T08 | Host set; IPv6-capable network | AAAA lookups (`ping6`) for the test name and a control; part of V3 | Test name AAAA `::` or none; control usable | PASS / FAIL / NOT RUN (no IPv6) |
| V10 | T05 | Host set | A network that blocks TCP 853 (router rule), and a captive-portal network, if available | DNS fails on that network. Record the system message and a recovery path: set Automatic, connect or log in, restore the host. | DISCLOSED with recovery documented / FAIL (no clear recovery) |
| V11 | T06 | Host set | Start a common VPN app that has its own DNS; V2 and part of V3 | UNKNOWN. The DevicePolicyManager note says the resolver "must be reachable both from within and outside the VPN". | COVERED / DISCLOSED |
| V12 | new | Host set | A Custom Tabs flow and a WebView in-app browser | UNKNOWN | COVERED / DISCLOSED |
| V13 | new | Host set | One more browser at default settings (for example Edge or Brave), characterized outside the H21 set | UNKNOWN | COVERED / DISCLOSED (characterization only; never part of the T1 claim) |

**Later rows.** These depend on an app and need a separate, approved prototype task. They are not
executed under this plan.

| ID | Was | Checks |
|---|---|---|
| V14 | T09 | §F accuracy: Filter Active only when its conditions hold; expiry by `CHECK_TTL`, network change and process restart; Unavailable (offline). B6 app side: with another VPN active, a failing check shows Error. B11: after a force-stop or data clear, filtering continues and the reopened app re-derives its state, never showing a stale Active. B12: after uninstall, Private DNS stays set (reinstall and observe). |
| V15 | T03, T09 | Detection at the next foreground (H5) for B1, B2 and B9: Private DNS Off, Automatic or another host leads to Stopped. B10: the optional guidance flow and its H8 delay. |
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
- **DETECTED** means Android exposes a reliable signal and the app's state changes truthfully. The
  gate can show only the signal, so a class stays "DETECTED (expected)" until V14 or V15 proves the
  app's response.
- **DISCLOSED** means the path is neither prevented nor detected, and it is named in the claim's
  limitations.
- Runs, repeats and INCONCLUSIVE handling follow §I.1.

### E.6 T2 register and friction measurement (H4)

H4 asks for a named list of casual bypass actions (T2), each classified COVERED, DETECTED or
DISCLOSED. It measures success by the steps and time added between an urge and access.

Every action below has exactly one H4 class, marked *expected* until its evidence is complete.

- **Gate evidence** is what V0–V13 can show without an A8 app.
- **Final evidence** is what fixes the class. For DETECTED, that is always the app's response (V14
  or V15).
- A class becomes final only when its final evidence passes. If it fails, the action is
  reclassified (DETECTED or COVERED → DISCLOSED), and the claim wording changes before any release
  (H10).

| ID | T2 action | Expected H4 class | Gate evidence | Final evidence |
|---|---|---|---|---|
| B1 | Set Android Private DNS to Off or Automatic | DETECTED (expected) | Android signal: V5 | The app shows Stopped at the next foreground: V15 |
| B2 | Replace the provider host with another host | DETECTED (expected) | Android signal: V5 | V15 |
| B3 | Turn on a browser's own secure DNS: Chrome Secure DNS with a chosen provider, or Firefox DoH Increased or Max | DISCLOSED (expected): the app cannot see browser settings | V4 | V4 |
| B4 | Use a browser outside the H21 set, or one with built-in DoH or a built-in VPN | DISCLOSED (expected). V13 informs the wording but never adds a browser to the claim. | V13 | V13 |
| B5 | Use private mode in an H21 browser | COVERED (expected) | V3, private-mode rows | V3 |
| B6 | Start another VPN app | COVERED (expected; ASSUMPTION from the DevicePolicyManager note that the Private DNS resolver must be reachable through VPNs) | V11 | V11. If V11 shows a bypass: DETECTED only if the check then shows Error (V14), otherwise DISCLOSED. |
| B7 | Open the page in an in-app browser (Custom Tabs, WebView) | COVERED (expected; ASSUMPTION: both use the system or Chrome resolver path) | V12 | V12 |
| B8 | Reuse a page or connection opened before filtering was turned on | DISCLOSED (expected), with the measured window | V7 | V7 |
| B9 | On a network that blocks DoT, turn Private DNS off "to get online" | DETECTED (expected), as B1. The outage itself shows Unavailable. | Android signal: V10 | V15 |
| B10 | Follow the app's optional "how to turn off filtering" guidance. It gives instructions only and is **not a technical control**: the change itself is B1, in Android Settings. | DETECTED (expected), through B1 | Android signal: V5 | V15, including the H8 delay on the guidance |
| B11 | Force-stop the app or clear its data | COVERED (expected): filtering does not depend on the app | V6: filtering persists with no app running | V14 |
| B12 | Uninstall the app | COVERED (expected): Private DNS stays set, although the app stops reporting | — | V14 |

Outside T2, with no guarantee (H5, T3): factory reset, another user or profile, ADB and root.

**Friction measurement protocol.** At the gate it applies to B1–B4 and B6–B9. B10 is measured with
the prototype (V15). B5, B11 and B12 are COVERED-expected actions with no bypass path to time.

- **Precondition:** the test network's own resolver does not block the category name (V2 baseline
  with Private DNS Off).
- **Start:** device unlocked on the home screen; Private DNS set to the provider host, with the
  category name blocked (V2 method); an H21 browser open on a blank tab. No A8 app is needed.
- **End**, by kind of action:
  - **Settings actions (B1, B2, B9):** the system signal shows that the provider host is no longer
    in use (V5 method), and the category name then gets a real address (V2 method).
  - **Path actions (B6):** the category name gets a real address on the path under test (V2
    method).
  - **Browser actions (B3, B4, B7, B8):** the browser opens the test page, which needs H19b.
  - **End not reached:** the action did not get past the filter in that run. It is recorded that
    way, with the path that was tried.
- **Steps:** every discrete interaction on the shortest path the Tech Lead finds (tap, toggle, text
  entry, confirmation). The path is written down.
- **Time:** seconds from start to end, median of three runs by the same practiced user, including
  system waits.
- **Detection:** for DETECTED actions, the gate records the Android signal (V5, V10, V11). Whether
  the app shows the narrower state when reopened, and how long that takes, is measured with the
  prototype (V14, V15).
- **Report:** per action, with the device, Android and One UI versions, and browser versions.
- **Bypass cost:** the configuration's bypass cost is its cheapest measured action. Without
  filtering, access needs zero extra steps, so the bypass cost is the friction the product adds.
  B10 is excluded, because the guidance can be skipped: its delay is voluntary and never counts as
  added friction.
- **No numeric threshold is set now.** Results feed the claim wording (H10) and the H8 design.
  DISCLOSED actions are reported as disclosure only, never as protection.

---

## F. Filter State / Coverage State Model

### F.1 Observed facts (A8)

| Fact | Source | Kept |
|---|---|---|
| F-api: API ≥ 28 | `Build.VERSION` | — |
| F-net: an active network exists | `ConnectivityManager` | memory |
| F-pdns: `isPrivateDnsActive()` | `LinkProperties` of the active network | memory |
| F-host: `getPrivateDnsServerName()` equals the provider host (exact match, case-insensitive) | same | memory |
| F-check: the last check and its time (monotonic clock): category name → provider block answer, control → real address | system resolver | memory only, never persisted |
| F-vpn: the active network is a VPN | `NetworkCapabilities` | memory |
| Setup intent: the user completed setup | local preference | persisted. Used only for wording, never for Filter Active (D8 principle). |

### F.2 Mechanism state

The first matching rule wins.

| State | Condition | User meaning |
|---|---|---|
| Unsupported | not F-api | Filtering needs Android 9+ |
| Unavailable (offline) | not F-net | No network, so nothing can be observed; never read as Stopped |
| Not set up | no setup intent and not F-host | Neutral onboarding state |
| Stopped | not F-host (Private DNS Off, Automatic or another host) | Filtering is off. If setup intent exists: "changed in Android settings" (DETECTED). |
| Unavailable | F-host but not F-pdns; or a fresh check (§F.4) failed with the control also failing | The resolver or network is unreachable |
| Error | a fresh check contradicts the configuration: the category name got a real address while F-host and F-pdns hold (this path is not filtered, e.g. another VPN) | Never Active |
| Degraded | F-host and F-pdns, but no fresh passing check: never checked here, or the evidence expired (§F.4) | Set up, not verified on this network recently |
| **Filter Active** | F-api, F-pdns, F-host, and a passing check that is fresh under §F.4, so younger than `CHECK_TTL` | All conditions of the approved boundary are observed (H7) |

### F.3 Coverage

Coverage is a record built only from the committed §E results. It is never a live check.

Each coverage entry records:

- the browser and mode;
- the browser version and its DNS setting as tested, marked **default** or **as found** (§I.1).
  As-found entries are characterization only and are never shown as coverage;
- the region (§I.1);
- the Android and One UI versions and the device model;
- the test date and the V-row with its evidence reference;
- the result: COVERED, DISCLOSED or not tested.

Rules for showing it:

- The app cannot see a browser's settings or know whether they changed, and the texts say so
  (§F.6).
- The texts name the tested configuration, for example "tested with Chrome 1xx, Secure DNS:
  automatic, [region], Sep 2026". They never say that the user's browser *is* covered.
- Coverage is re-verified on current browser versions before each release. This is a release
  checklist item (M5); H10 requires re-review whenever the evidence changes.
- Runtime facts can narrow coverage but never widen it. Example: another VPN is active (F-vpn) and
  V11 was not COVERED, so the text becomes "coverage not verified with another VPN".
- Filter Active never implies any browser row.

### F.4 Observation freshness

A check result is fresh only while **all** of these hold:

- it is younger than **`CHECK_TTL` = 10 minutes**. This is the baseline value (H15), measured
  with a monotonic clock. The spec may shorten it; lengthening it needs a new decision.
- the active network is the one it ran on;
- Private DNS has not changed since (callbacks while the process lives);
- the app process has not restarted.

When any of these stops holding, every state that came from a check (Filter Active, Error, and
Unavailable from a failed check) drops to **Degraded — not verified recently** until a new check
runs; that check's result then sets the state. The UI applies the expiry by itself, with no network activity, so Filter Active is never
shown on evidence older than 10 minutes. States read directly from `LinkProperties` (Stopped, and
Unavailable without a check) are re-read whenever the state is evaluated.

- New checks run only when the app comes to the foreground with stale evidence, or when the user
  taps "Check now". There is **no** automatic periodic re-check, background service, scheduler or
  job.
- The UI always shows the check time.
- A8 shows its state only inside the app. No notification claims Filter Active.

Why 10 minutes: it bounds how stale a displayed Filter Active can be, while a check costs only a
few lookups and runs only while the user is in the app.

### F.5 Check constraints (H9)

- Only provider-documented test names and neutral controls; never a name that identifies the app.
  The app contacts nothing else.
- Results are kept in memory only: no hostname or check history, and no hostnames in logs.
- Lookups go through the system resolver, the same path other apps use, bypassing the local cache
  where the platform allows (implementation detail).

### F.6 User-facing texts (drafts; final copy follows M2-01 §5)

| State | Draft |
|---|---|
| Filter Active | "Filter active on this network (checked 10:42). Covers apps that use Android's DNS. Tested with Chrome 1xx, Samsung Internet 2x and Firefox 1xx at default settings ([region], Sep 2026). This app can't see your browser's settings; if you changed them, this may not apply. Browsers or apps using their own secure DNS are not covered." |
| System check passes, browser not tested | "System DNS filter: active (checked just now). [Browser]: not tested — it may use its own secure DNS." |
| Degraded (never checked here) | "Set up, not yet checked on this network. [Check now]" |
| Degraded (evidence expired) | "Last verified 10:42 — not verified recently. [Check now]" |
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

Decision H18 — PENDING. The Tech Lead records its verification part at gate G0 (§E.1) and its
production part through AC8 (§I.2).

### G.1 The decision

> When the user turns on filtering, Android sends every DNS lookup made by apps that use the system
> resolver, encrypted with DoT, to the filtering provider the user chose. The provider may keep
> query logs within its published policy. The project runs no server and receives nothing.

**Options:**

- accept for verification only (the Tech Lead's own device during §E); required before V1 (gate
  G0, §E.1);
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

### I.1 Pre-registered T1 scope (H21)

The T1 scope is recorded before V1, so no result can change it silently. In H4's wording, these are
the "tested browsers".

| Browser | Modes | Settings |
|---|---|---|
| Chrome | normal, Incognito | The default DNS setting of the installed version in the tested region (default-setting rule below); current store version at test time |
| Samsung Internet | normal, Secret | same |
| Firefox | normal, Private | same |

- This matches the gating scope approved in M1-06 (H2: rows G1–G4, G7, G8).
- The device is the Tech Lead's target Samsung phone; its model and One UI version are recorded.
- Browsers tested in V13 are **characterized**. They are not "tested browsers" in H4's sense, and
  they are never claimed.

**Default-setting rule.** H4 covers default behavior, so a setting that was changed on the device
is not evidence for the default. For each H21 browser, before its first V3 run:

1. **Record** the installed version, the region and the as-found DNS setting (Chrome "Use secure
   DNS"; Firefox "DNS over HTTPS"; Samsung Internet's secure-DNS setting, if it has one). The region
   is the country of the device settings and of the network used. Browser defaults can depend on
   region (U3).
2. **Establish the default** for that version and region from a source that is recorded with the
   result: the browser's documentation, release notes or source for that version, or a default
   marked in its own settings screen. Remembered or assumed defaults do not count. If the browser
   exposes no DNS setting, its installed state is its default, and that is recorded.
3. **Default not established,** or the setting cannot be switched to it because G0 holds no
   consent: the rows for that browser cannot be COVERED. They are NOT MET, and the outcome is
   INCOMPLETE (§I.3) until they are run.
4. **As found equals the default:** run the rows as found.
5. **As found differs:**
   - run the rows as found first, as **characterization** rows, recorded separately; they never
     count for AC4 and never enter the claim;
   - then, with the consent recorded in G0 (H21), switch the setting to the default in the
     browser's settings screen and run the T1 rows;
   - restore the as-found setting afterwards and record the restore with a screenshot.

The claim is scoped to the tested region. A claim for another region needs its own V3 run.

**Run rules for T1 rows:**

- Each T1 row runs twice. A row is COVERED only if both runs are COVERED.
- A BYPASS in either run makes the row BYPASS, whether reproduced or intermittent, as in M1-06.
- An INCONCLUSIVE run allows one extra run, recorded before it happens. A row that is still not
  COVERED after that is NOT MET.

### I.2 Accept A8 as the production filter architecture only if all of these hold

| ID | Criterion | Rows |
|---|---|---|
| AC1 | The oracle is valid, judged on the category name only | V0 |
| AC2 | The mechanism is active on Wi-Fi and on cellular | V1 |
| AC3 | The system path is blocked on Wi-Fi and cellular, and the controls resolve | V2 |
| AC4 | Every H21 row is COVERED under the §I.1 run rules | V3 |
| AC5 | Blocking persists after a reboot with no app running, and across Wi-Fi ↔ cellular | V6, V8 |
| AC6 | Every T2 register action (§E.6) that has gate evidence holds an expected H4 class supported by that evidence. If the evidence contradicts the expected class, the action is reclassified before the §I.3 decision (B6 follows its register row). The friction runs record steps and time for B1–B4 and B6–B9. V9 is classified COVERED or DISCLOSED, or NOT RUN only with a stated reason. DETECTED classes, and the COVERED classes of B11 and B12, stay *expected* at the gate. They become final only when V14–V15 pass as M3 acceptance, before any release claim; a failure reclassifies the action to DISCLOSED and changes the claim (H10). | V4, V5, V7, V9–V13; §E.6 friction runs |
| AC7 | Behavior when the resolver is unreachable or behind a captive portal is documented, with a working recovery path through standard Settings | V10 |
| AC8 | H18 is accepted for production | — |
| AC9 | Gate G0 (H18 verification scope, H19, H21) was recorded before the first device row | — |

### I.3 Outcomes, decided in advance

| Outcome | When | Result |
|---|---|---|
| **PASS** | AC1–AC9 all hold | A8 is accepted as the production filter architecture. The ADR can be accepted, and M3 task contracts follow. |
| **FAIL — candidate** | Any of RJ1–RJ6 | A8 is not accepted for the registered scope. The follow-up comes from the RJ row below. |
| **NOT VERIFIABLE** | H19b not approved and no validated equivalent exists (§E.1) | A8 is not accepted, and no device row runs |
| **INCOMPLETE** | An AC is not met and no RJ condition holds: for example, an H21 row is NOT MET because it is still INCONCLUSIVE after its extra run, a browser's default could not be established (§I.1), or H18 for production is not yet decided | A8 is not accepted yet. The cause is recorded, and only the affected rows are run again once it is removed, under the same registered scope. A BYPASS found on any run stays a FAIL. |

| ID | Rejection condition | Follow-up (each a separate decision) |
|---|---|---|
| RJ1 | Oracle invalid: the category name is not blocked by the family tier, or is also blocked by the unfiltered resolver (V0) | A new V0 with another provider that meets §G.6, or reopen A2 (§D.4) |
| RJ2 | The mechanism or the system path fails on the target device on normal networks (V1, V2) | Reopen A2 |
| RJ3 | Any H21 row is BYPASS (V3) | Reopening A2 does not help, because A2 has the same browser-level gap. A scope change is possible (below). |
| RJ4 | Blocking does not survive a reboot (V6) | Reopen A2 |
| RJ5 | V10 shows the user can be left without connectivity and without a clear standard recovery path | Reopen A2, or narrow the supported networks through a scope change |
| RJ6 | H18 is rejected for production | A2 or recovery-only (H12) |

**A scope change is not a pass.**

- After a FAIL or an INCOMPLETE, the Tech Lead may record a separate decision that changes the
  product scope. For example, it can remove a browser from H21, so that the claim explicitly
  excludes it, or narrow the supported networks.
- A8 is then re-evaluated against the new scope, using the recorded evidence and re-running only
  the rows the change affects.
- The record shows three things in order: the FAIL or INCOMPLETE on the original scope, the scope
  decision, and the re-evaluation result.

After a PASS, the claim covers only COVERED rows (H10), and DISCLOSED rows become its stated
limitations.

---

## J. Answers to Reviewer Questions

1. **What exactly are the Filter Active conditions, and what text shows when the system check
   passes but browser coverage is unknown?**
   Filter Active holds only when all of the following are true:
   - the device runs API 28+;
   - Private DNS is active in strict mode with the provider host on the active network;
   - a check on this network, in this app session, got the provider's block answer for the
     category name while the control resolved, and that check is younger than `CHECK_TTL`
     (10 minutes).

   Nothing else produces Active: not the saved setup, not the host alone, not a check from another
   network, and not an expired check. When the evidence expires, the state drops to Degraded until
   a new check runs.

   When the system check passes and a browser is untested, the app shows: "System DNS filter:
   active (checked just now). [Browser]: not tested — it may use its own secure DNS." Browser lines
   name the configuration that was tested; the app never claims to see a browser's current
   settings. (§F.2–§F.4, §F.6)

2. **Which T1 rows must pass before A8 is accepted, and what result stops it?**
   - **Must pass:** every H21 row, registered before testing: Chrome, Samsung Internet and Firefox,
     each in normal and private mode, at the default DNS setting of the installed version in the
     tested region (the §I.1 default-setting rule). Each must be COVERED in both runs. An as-found
     setting that differs from the default is tested separately and never counts. V1, V2, V6 and
     V8 must also pass.
   - **Stops A8:** any of RJ1–RJ6 is a candidate FAIL for the registered scope. Narrowing the claim,
     for example by dropping a browser from H21, is a separate scope decision followed by
     re-evaluation, never a pass. If browser navigation (H19b) is not approved, the outcome is NOT
     VERIFIABLE. A row that stays INCONCLUSIVE, or a browser whose default cannot be established,
     makes the outcome INCOMPLETE: A8 is not accepted until the affected rows are run. (§I.1–§I.3,
     §E.1)

3. **Does the Tech Lead accept sending DNS queries to the chosen provider, and how is it explained to
   the user?**
   This is not decided. H18 is pending and belongs to the Tech Lead. Running §E sends the test
   device's DNS to Cloudflare, so the "for verification" part of H18 is part of gate G0, and no
   device row runs before it (§E.1). The user explanation in §G.4 appears before setup, with a way
   to decline, and recovery works either way.

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
| U1 | Whether `nudity.testcategory.com` is safe to open in a browser; only a search-result title says it is a Cloudflare test site | H19b (Tech Lead, gate G0) | V3, V4, V7, V11–V13; NOT VERIFIABLE path (§E.1) |
| U2 | The AAAA answer for blocked names | V9 | Oracle |
| U3 | Whether Firefox uses its own DoH by default in the tested region while Private DNS is strict | V3 | AC4 (Firefox is in H21) |
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
| U15 | Whether a resolver-diagnostic page (for example `1.1.1.1/help`) can give browser-path evidence equivalent to opening the category page | Validation, then a recorded Tech Lead decision | The NOT VERIFIABLE path (§E.1) |
| U16 | Whether a 10-minute `CHECK_TTL` suits real use | V14 (later) | §F.4; it may only be shortened without a new decision |

---

## L. Updated ADR / Architecture Baseline

### ADR-M2-02 — Filter layer: verify guided Private DNS (A8) first

**Status:** Final baseline, issued on 2026-09-26 at the Tech Lead's direction; the review loop is
closed. The Tech Lead records the decision in M2-03 ([roadmap](roadmap.md): "The Tech Lead records
one explicit decision"). Recording it does not accept A8 for production; that happens only on a §I
PASS.

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

**Decision:** H13–H21 below, in final wording. H18, H19 and H21 are the Tech Lead's gate G0
decisions (§E.1).

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

### Decision items (final wording; recorded by the Tech Lead in M2-03)

| ID | Wording | Relation to the A1–A8 proposal |
|---|---|---|
| H13 | Recovery/filter boundary: the recovery layer never depends on the filter layer's presence, state, code paths or data. Filter absence, failure, an unsupported platform or the user's choice never changes recovery behavior. | Its H13, rewritten as a boundary |
| H14 | A8 is the filter layer's verification candidate. The user sets Android Private DNS (strict) to a filtering provider; the provider under verification is Cloudflare Families `family.cloudflare-dns.com`. The filter layer is API 28+, shown Unsupported below that, with minSdk unchanged. Production selection only after §I acceptance, H18 and the gate. | Its H14 |
| H15 | Mechanism state, coverage and freshness are separate. Filter Active only under the §F.2 conditions, on check evidence younger than `CHECK_TTL` = 10 minutes and never on saved intent (§F.4). Expired evidence drops the state to Degraded until a new check runs. Coverage comes only from committed results and names the tested configuration (§F.3). Checks run only on foreground or user request; no automatic re-checks and no background probes. | Its H15, made precise and time-bounded |
| H16 | A4a Always-on is needed only if a VPN-based filter claims coverage after reboot, backed by a lifecycle test when A2 is reopened; otherwise reboot is DISCLOSED for that filter. N/A to A8. A4b Lockdown is out of the MVP pending its own matrix. A3, A5 and A6 are deferred. A7a is excluded (H5). A7b is out of scope; if reopened it is judged on H9, D1 and Play. A2 is a deferred investigation with the §D.4 triggers. | Its H16, split; Always-on made conditional |
| H17 | Next step after the baseline is recorded in M2-03: the Tech Lead records gate G0 (H18 verification scope, H19, H21), then runs §E rows V0–V13 and the §E.6 friction runs, and commits a classified report. The A8 production decision then follows §I.3. No implementation. V14–V17 need a separate, approved prototype task. | Its H17, made concrete |
| H18 | Privacy and trust: accept or reject the third-party DNS data flow for A8, in two parts: for verification (part of G0, before V1) and for production (AC8) (§G) | New |
| H19 | (a) Test names, extending D3: the category name `nudity.testcategory.com` and the informational `malware.testcategory.com` for DNS-level checks; controls `example.org` and `example.com`. (b) Whether browsers may open the category page; if not, the §E.1 NOT VERIFIABLE outcome applies. | New |
| H20 | Optional, derived from H9 (local-first), not from H12: recovery also works without internet. It is not an implementation precondition unless approved. | New; corrects the H12 attribution |
| H21 | T1 browser set, registered before V1: Chrome, Samsung Internet and Firefox, each in normal and private mode, at the default DNS setting of the installed version in the tested region, established and applied under the §I.1 default-setting rule; current store versions; the target device. It includes consent to switch a browser's DNS setting to its default for the test and to restore the as-found setting afterwards. An as-found setting that differs is tested separately as characterization and never counts for AC4. The claim is scoped to the tested region. Changing the set after results is a separate scope decision followed by re-evaluation, never a pass. | New |

### Pre-gate actions (Tech Lead)

1. Merge `docs/04-m2-01-approved-decisions` (`5291383`) into `main`, so that H4–H12 are in the formal
   reference before M2-03.
2. Separate docs task: M1-07 status after PR #32, README status, roadmap update (§H.3).

### What recording this baseline means

The content is final, and no further review round is planned. Recording it in M2-03 approves:

- the §A.1 structure;
- the §F state model, including `CHECK_TTL`;
- the §E verification protocol: gate G0, the oracle, the §E.6 T2 register and friction protocol,
  and the §I.1 default-setting rule;
- the §I outcomes, decided in advance;
- the §H dispositions, which take effect only after a PASS;
- decision items H13–H17, and H20 as optional.

H18, H19 and H21 are recorded at G0 as the Tech Lead decides them; the wording above is the
proposal. They contain consents that only the Tech Lead can give: sending the test device's DNS to
the provider, letting browsers open the test page, and switching a browser's DNS setting for a test.
Recording the baseline does **not** accept A8 for production.

### Sequence

1. **M2-03 (Tech Lead):** record the decision on this final baseline, and gate G0 (H18 verification
   scope, H19a, H19b, H21).
2. **Verification:** V0, then V1–V13 and the §E.6 friction runs, by the Tech Lead, followed by a
   committed, classified report. If H19b is refused, stop here as NOT VERIFIABLE.
3. **Decision:** the outcome per §I.3. On a PASS, together with H18 for production, the ADR is
   accepted and M3 task contracts follow: the observation core and state evaluator, the removal of
   the experiment code, and the docs updates.
4. **Acceptance tests:** V14–V17 become acceptance tests for M3 and M4.

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

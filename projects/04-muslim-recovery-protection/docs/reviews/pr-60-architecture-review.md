# Project 04 — PR #60 Architecture Review (voluntary app blocking + recovery-first baseline)

> **Project:** Muslim Recovery Protection\
> **Nature:** REPORT ONLY. Independent architecture review prepared by AI for the Tech Lead /
> Owner. It changes no code, test, workflow, manifest or existing document, and it makes no
> decision: it does **not** record the Owner's PR #60 decision, does not approve AB1–AB7 or D13,
> does not approve any mechanism for the D14 scope items, does not approve A8 for production, and
> does not authorize M3 work.\
> **Date:** 2026-09-27\
> **Reviewed PR:** [#60](https://github.com/takh86/ai-engineering-lab/pull/60) —
> "docs(04): add voluntary app-blocking architecture decision".\
> **Reviewed head:** `81df2cb29d2879b68105a0639c7f50f24ea5db3f` (PR #60), against base `main`
> `8adad315`. 11 files changed, +1024 / −84, all under `projects/04-muslim-recovery-protection/`
> `docs/` and `README.md`. No `android/`, manifest, Gradle or `.github/workflows/` change (§A.1).\
> **Source of truth:** where this review and the approved documents differ, the approved documents
> win — [M2-01 H4–H12](../m2-01-approved-threat-model.md), the
> [M2-02 baseline](../m2-02-architecture-options.md), and [D1–D12](../decisions.md).

## How to read this report

**Evidence labels.** Every statement rests on one of these:

| Label | Meaning |
|---|---|
| **DIFF** | Read from PR #60's changed files at the reviewed head during this review |
| **API** | Read through the GitHub API during this review (PR/issue state, file contents) |
| **DOC** | Stated in an existing, merged Project 04 document; cited, not re-litigated |
| **INFERENCE** | A conclusion drawn during this review from the above |

**Severity.** Two columns, because the answer depends on how far the item travels:

- **Now** — severity at the current stage (a documentation decision on GitHub; no code authorized).
- **If built** — severity if the item reaches an implementation task contract unchanged.

| Severity | Meaning |
|---|---|
| **BLOCKER** | The Owner's decision, or the next task contract, cannot proceed honestly until resolved. |
| **HIGH** | Must be resolved before any claim about, or any build of, the affected behaviour. |
| **MEDIUM** | Should be resolved by the task contract that next touches the affected area. |
| **LOW** | Hygiene / traceability; fix when convenient. |

This review does not assign PASS/FAIL to the PR. It records findings for the Owner's decision.

---

## A. What PR #60 actually is

### A.1 Scope of the diff — DIFF / API

PR #60 is **documentation-only**. The 11 changed files are:

| File | Δ | What it carries |
|---|---|---|
| `docs/app-blocking-architecture-decision.md` | +164 (new) | AB1–AB7 boundary; proposes **D13** |
| `docs/recovery-first-product-baseline.md` | +563 (new) | Recovery-first baseline; **D14** and OD1–OD14 |
| `docs/decisions.md` | +91 / −1 | Adds D13 and D14 records |
| `docs/roadmap.md` | +134 / −48 | M2-04 discovery gate; M3 re-framing |
| `docs/m2-03-architecture-adr.md` | +40 / −25 | G0 wording reconciliation; D13/D14 pointers |
| `README.md`, `problem.md`, `requirements.md`, `architecture.md`, `recovery-support-brief.md`, `m2-02-architecture-options.md` | small | pointers / one-line addenda |

There is **no Android code, manifest, permission, Gradle or workflow change** (INFERENCE from the
file list; consistent with the PR body's assertion). Nothing here can, by itself, ship a behaviour,
request a permission, or authorize an M3 task.

### A.2 The PR bundles two distinct decisions — API / INFERENCE

The PR title names one decision (app blocking). The diff carries **two**:

- **D13 — voluntary app blocking (AB1–AB7).** Status **PROPOSED**, pending the Owner's explicit
  GitHub decision on PR #60 (DOC: the doc's own decision-state banner and PR #60's acceptance
  criteria).
- **D14 — recovery-first product baseline.** Status **APPROVED by the Owner on 2026-09-27** per
  [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68) (API). D14's baseline reached
  PR #60's branch through [PR #69](https://github.com/takh86/ai-engineering-lab/pull/69), which was
  **stacked on PR #60's branch and is now merged** (API: PR #69 `state=closed, merged=true`,
  base `docs/04-app-blocking-architecture`).

So a reviewer reading only PR #60's title/body will under-count what merging it lands. See
Finding G-1.

### A.3 Where `main` stands — API / DIFF

Neither `app-blocking-architecture-decision.md` nor `recovery-first-product-baseline.md` exists on
`main`, and `main`'s `decisions.md` ends at **D12** (DIFF: this review branch, cut from post-PR-59
history, contains neither file and no D13/D14). Therefore **nothing in AB1–AB7 or the recovery-first
baseline is in effect on `main` yet.** Merging PR #60 is the act that lands both D13 (proposed) and
D14 (approved) together.

---

## B. Alignment with the approved baseline (H4–H12, D1–D12, M2-02)

The strongest property of this PR is that it does **not** silently widen the approved envelope. The
following hold at the reviewed head (DIFF, cross-checked against DOC):

- **Recovery independence (H6, H12, H13).** AB1 and baseline L0 both state the recovery core works
  with every protection layer absent, revoked or failing. Consistent.
- **Owner-control boundary (H5).** AB3 restricts the commitment delay to the app's **own** in-app
  controls and states it "never blocks Android Settings, permission revocation, uninstall, emergency
  calling or essential system functions. No Device Owner, legacy Device Admin or root." The baseline
  §5 "Adapt" row repeats "Android Settings always stays available (H5)." Consistent with H5.
- **Privacy boundary (H9).** AB5 stores only selected package IDs and schedule locally; "No URL,
  screen text, thumbnails or browsing history is read or stored for app-level blocking"; optional
  aggregate counter off by default; no analytics, ad SDK or backend. Baseline P8 and the §5 "Reject"
  row keep third-party reporting prohibited. Consistent with H9 and D5.
- **Truthful state / no single "Protected" boolean (H7, H10, D8, AB4).** AB4 gives app blocking its
  **own** "App Blocking Active" state, independent of the DNS "Filter Active" state, with neither
  promoting the other. §4 forbids "cannot open", "unbreakable", "prevents uninstall". Consistent.
- **A8 untouched (H11, M2-02 §I).** AB4 and the baseline keep A8 a separate, verification-only
  candidate with its own AC/RJ; PR #60 does not approve Cloudflare for production or change the
  V0–V13 runbook. Consistent.
- **Accessibility stance (M2-02 A7b, H16).** M2-02 excluded **Accessibility as a URL detector**
  (A7b). AB6 proposes only **package-only** app blocking, tries Usage Access + overlay first, and
  makes any Accessibility use a conditional candidate requiring prominent disclosure, affirmative
  consent, accurate Play declaration and Play approval, with "no window-content retrieval". This is a
  genuinely narrower proposition than A7b, and the doc says so rather than assuming it. Reasonable —
  but see Finding AB-2.

**INFERENCE:** AB1–AB7 is internally consistent and well-aligned with the approved threat model. It
reads as a careful narrowing, not an expansion. The findings below are refinements and gates, not
reversals.

---

## C. AB1–AB7 findings (D13)

| ID | Finding | Now / If built |
|---|---|---|
| **AB-1** | **The AB3 "explained escape path" is the load-bearing safety invariant and is under-specified.** The entire non-coercion guarantee (H5/H8) rests on the commitment delay being genuinely reversible and never stranding the owner. The doc states the intent ("explained escape path", "a usable exit from a mistaken block", "must not own a hidden unlock trap") but defers exact semantics. **Recommend** pre-registering, before any task contract, three invariants as testable acceptance items: (a) the delay applies **only** to in-app policy edits; (b) OS-level uninstall, permission revocation and Settings are never delayed or intercepted; (c) a bounded maximum delay and a guaranteed exit exist, and a crash/interruption-loop cannot trap the user. The Safety/reliability gate in §5 already tests adjacent cases; this elevates the invariant so it cannot erode in specification. | LOW / **HIGH** |
| **AB-2** | **Even package-only Accessibility is a broad OS grant with rising platform restrictions.** AB6 correctly treats it as a fallback only, but the residual risk (Advanced Protection restricting non-accessibility-tool services; Play review of a recovery app requesting Accessibility; the standing rule not to misdeclare `isAccessibilityTool=true`) means the fallback may simply be unavailable. **Recommend** the AB-01 spike (#61) treat "Accessibility rejected/unavailable" as a first-class, truthful outcome ("App Blocking Unavailable"), not a degraded workaround, and that the mechanism claim never depend on it. Doc already leans this way; make it explicit in the spike's success criteria. | LOW / MEDIUM |
| **AB-3** | **"App Blocking Active" must be a computed runtime signal, not an intent flag, and must not be merged into `ProtectionState`/`ProtectionSignals`.** D8's recorded consequence explicitly warns future callers against merging new state into those types. AB4/§4 describe the right semantics but do not cite D8's separation rule. **Recommend** the future state model note that "App Blocking Active" is its own signals type, computed from observed grant + service-connected + policy-exists + tested-launch-paths-passed, mirroring D8, and never asserted from the toggle alone. | LOW / MEDIUM |
| **AB-4** | **App blocking has no coverage register analogous to the DNS layer's B1–B12 / COVERED-DETECTED-DISCLOSED taxonomy (H4).** §4/§5 acknowledge first-frame exposure, website/Lite-client/secondary-profile bypasses and unsupported OEM behaviour narratively, but there is no enumerated register the claim can map to (H10 requires every claim to map to a boundary + evidence + limitation list). **Recommend** adding a per-app-blocking coverage register (rows may all be UNKNOWN until AB-01), so "App Blocking Active" has an explicit, testable ceiling before any user-facing wording. | LOW / **HIGH** |
| **AB-5** | **The "at most one second, opaque, untappable" interruption is a pre-registered hypothesis, not a demonstrated capability, and the polling/foreground-service tension is real.** The doc is honest about this (UsageStatsManager is query-based; a persistent foreground service may be needed, with battery/OEM/Play cost; FGS type "not yet selected"). **Recommend** keeping #61's rule "do not relax the threshold after seeing results" as a hard pre-registration, and recording first-frame readability/tappability **separately** from elapsed time (as #61 already requires). No change needed beyond holding the line. | LOW / MEDIUM |
| **AB-6** | **App-list selection without `QUERY_ALL_PACKAGES` is an open, Play-sensitive design point.** The doc correctly refuses `QUERY_ALL_PACKAGES` and defers the picker mechanism to the spike. **Recommend** the spike record which package-visibility approach it uses and confirm it is Play-policy-safe and reflected in the manifest reviewed at the distribution gate. | LOW / MEDIUM |

None of AB-1…AB-6 blocks the Owner from recording a decision on the AB1–AB7 **boundary**; they are
conditions to attach to the *next* stage (the AB-01 spike and any task contract), which the PR
already gates.

---

## D. Recovery-first baseline findings (D14) — the sensitive scope items

D14 is **already Owner-approved** (§A.2). This section reviews the baseline for consistency and, in
particular, the three items that most enlarge the product's risk surface. The baseline handles them
with visible discipline; the recommendations below are about keeping that discipline binding.

### D.1 The §5 "Approved product scope, mechanism deferred" items — DIFF

The baseline §5 records, as **product intent only**, with **mechanism explicitly not approved**:
Web Guard (domain/website and keyword blocking), "screen reading for self-protection" (only where an
approved feature technically requires it), and an "uninstall-prevention **investigation**". For each,
the baseline itself:

- states the mechanism is UNKNOWN / not approved and routes it to a **new, explicit
  architecture / security / Play-policy decision** and its own task contract;
- names the conflict with the approved threat model rather than papering over it — for
  uninstall-prevention it cites H5 (uninstall is explicitly outside any guarantee) and Play's
  restriction on disabling/uninstalling via the Accessibility API, and states the investigation "is
  expected to report that finding unless a genuinely new approach surfaces"; for screen reading it
  states AB6's "no window-content retrieval" boundary is **not** overridden and that any need for
  window content "is exactly the conflict … that must be reconciled explicitly, not assumed";
- keeps third-party exfiltration in the **Reject** table (P8/H9), and keeps Device Owner / Device
  Admin / root / Settings-blocking rejected **as mechanisms** even for the approved intent.

This is the correct governance posture. PR #69's own acceptance criteria assert "No monitoring,
uninstall prevention, screen reading … is introduced" (API), i.e. these are recorded as *intents to
investigate under gates*, not as approved capabilities.

### D.2 Findings

| ID | Finding | Now / If built |
|---|---|---|
| **RF-1** | **Elevate the §5 items from "deferred" to an explicit hard gate that requires reopening the approved threat model.** "Screen reading" and "uninstall-prevention" are not merely new features; they touch H9 (no screen content) and H5 (owner keeps OS control, uninstall outside any guarantee), both **APPROVED and not reopened**. A product-scope approval recorded by GitHub comment (OD/#68) does **not** amend H5/H9. **Recommend** the baseline and `decisions.md` state plainly that **no design, spike or task contract for Web Guard keyword detection, screen reading, or uninstall-prevention may begin until the Owner records an explicit amendment to the affected H-decisions (H9 and/or H5) accompanied by its own security/privacy/Play-policy review.** The baseline gestures at this; making it a named precondition removes ambiguity. | **MEDIUM** / **BLOCKER** |
| **RF-2** | **Keep "uninstall-prevention" framed as an investigation with an expected-negative result, not a product commitment.** On current platform rules there is no known way to impede uninstall for an ordinary user on their own device without Device Admin/Owner/root or Accessibility abuse — all four already rejected here — and comparable accountability apps were removed from Play in 2022 for related reasons (DOC: baseline §5/§9, sources §13). **Recommend** the roadmap carry this as "investigate and most likely disclose as not-compliant", so it never hardens into an implied capability, and so no user-facing copy ever implies uninstall is prevented (§4 already forbids the claim). | LOW / **HIGH** |
| **RF-3** | **"Self-protection monitoring" (P8) is the item most easily misread as surveillance; bound it by construction.** P8 permits a layer to observe on-device signals **only** to power its own protective feature and prohibits sending activity/screen/browsing data anywhere. The dual-use risk is that the same on-device observation is, mechanically, what a coercive or third-party monitor would do — the distinguishing properties are consent, locality and the owner's guaranteed escape. **Recommend** any task contract under P8 pre-register, as acceptance items: genuine opt-in by the device owner; **no** network egress of observed signals (verifiable, e.g. no runtime networking in the observing component); no persisted raw content; and the owner's always-available revoke/uninstall path (H5). This keeps "self-protection" categorically separable from monitoring, in code and in review, not just in wording. | **MEDIUM** / **HIGH** |
| **RF-4** | **OD6 "HYBRID / emergency hard block" must inherit the AB3 escape invariants (AB-1), not weaken them.** OD6's emergency mode ("hard block during the active window") is, on inspection, a user-configured temporary block of **selected apps** during a **user-set window** on the **owner's own device**, with Settings/uninstall always available (DOC: baseline §4 L1, §5 Adapt). That is within H5/H8. The risk is only in specification drift. **Recommend** the L1 task contract state that the emergency mode adds **no** OS-level lock, has a defined maximum window and guaranteed exit, and that "hard" refers to in-app friction on the selected apps, never to impeding device control. The baseline flags OD6's exact timing/escape/failure semantics as pending AB-01/E3; this pins the direction of that resolution. | LOW / **HIGH** |
| **RF-5** | **OD4 (whole-app biometric lock) vs. fast Help-Now access is correctly flagged as unresolved; ensure "fail-open to help" is the default lean.** A lock in front of an urge-moment tool can delay the exact action the product exists to deliver. The baseline §12 and #68 already route this to the M3/M4 contract. **Recommend** the contract resolve it toward *help remaining reachable* under lock (the safety-relevant direction), and record the trade-off for the Owner. | LOW / MEDIUM |

---

## E. Governance & traceability findings

| ID | Finding | Now / If built |
|---|---|---|
| **G-1** | **PR #60's title/body describe D13 only, but its diff now lands D13 + D14 together.** Because PR #69 (D14 baseline) merged into PR #60's branch, approving/merging PR #60 also lands the entire recovery-first baseline. **Recommend** the Owner either (a) update PR #60's body to state it now lands both D13 (proposed) and the already-approved D14 baseline, or (b) confirm the bundling is intended. This is about an accurate merge record, not a code risk. | **MEDIUM** / — |
| **G-2** | **Several decisions in these docs are provenance-linked to GitHub comment IDs and to PR #69 / issues #63–#68, which are outside PR #60's diff.** A reader of PR #60 alone cannot verify OD1–OD14 wording or the D14 approval from the diff. This review confirmed by API that #68 records D14 = APPROVED and OD10/OD12/OD14 open, #61 is open/PROPOSED, and #69 is merged — but the audit trail depends on artifacts a future reader may not fetch. **Recommend** `decisions.md` D14 carry the canonical approval reference inline (issue #68 + the PR #69 decision comment) so the record is self-contained. | LOW / — |
| **G-3** | **The corrected R14 live-tracker incident is a positive governance signal; convert it into a standing rule.** The baseline self-reports that a prior revision edited 16 live GitHub trackers to reflect D14 before approval, and that this was reverted with a "proposed, not yet in effect" note (DOC: baseline §9 R14, §11, AI-contribution). **Recommend** adopting, in AGENTS.md or the roadmap, an explicit invariant: *no automated edit to a live tracker's operative gate text before the Owner records the corresponding decision.* This turns a one-off correction into a durable guardrail. | LOW / — |
| **G-4** | **G0 wording reconciliation in the ADR should be verified to not move any G0 semantics.** PR #60 states it corrects stale G0 status wording (H18 verification-only; H19a/H19b/H21 recorded; #40 pre-execution). **Recommend** the Owner confirm the ADR edit only re-states already-recorded G0 status and does not silently change what G0 requires; G0 sign-off (H18/H19a/H19b/H21) remains the Tech Lead's, unchanged by this PR. | LOW / — |

---

## F. Truthful-claim / state-model check (H7, H10, D8)

At the reviewed head, the claim discipline holds (DIFF): separate `Filter Active` (DNS) and
`App Blocking Active` (blocker) states; explicit reasons and repair actions for
Needs-setup/Unavailable/Stopped/Degraded; "a restored service does not inherit an old success
claim"; forbidden phrases ("cannot open", "unbreakable", "prevents uninstall"); and a requirement to
name tested apps, OEM/Android version, profile and launch paths in any user-facing claim. The one
gap is the missing enumerated coverage register (Finding AB-4), which H10 needs something to map to.

---

## G. Consolidated recommendations (all for the Owner's decision; none self-executing)

1. **On the AB1–AB7 boundary decision itself:** the boundary is sound and may be recorded as the
   Owner sees fit. Attach AB-1 (escape invariants) and AB-4 (coverage register) as conditions on the
   **AB-01 spike (#61)** and any L1 task contract, not on the boundary decision.
2. **Make RF-1 a named precondition:** no design/spike/contract for Web Guard keyword detection,
   screen reading, or uninstall-prevention until the Owner records an explicit **H9/H5 amendment**
   plus a dedicated security/privacy/Play review. Keep uninstall-prevention framed as an
   investigation expected to disclose non-compliance (RF-2).
3. **Bound P8 self-protection by construction (RF-3):** opt-in, no egress, no raw-content
   persistence, guaranteed owner escape — as acceptance items, so "self-protection" stays
   categorically distinct from monitoring in code and review.
4. **Fix the merge record (G-1):** state that PR #60 lands D13 + D14, or confirm the bundling.
5. **Self-contain the D14 provenance (G-2)** and **adopt the no-pre-approval-tracker-edit rule
   (G-3).**

## H. What this review verified, and what it did not

**Verified (API/DIFF during this review):** PR #60 file list and docs-only scope; AB1–AB7 and
baseline text at head `81df2cb`; #61 open/PROPOSED; #68 records D14 APPROVED with OD10/OD12/OD14
open; #69 merged into PR #60's branch; `main`/this branch contain neither new doc and end at D12.

**Not verified (out of scope for a documentation review):** the content of individual GitHub
comment IDs (OD wording was read from the baseline/issue bodies, not each comment); any device,
timing, permission or Play-policy behaviour (all deferred to #61 and later gates); competitor
claims (vendor descriptions, per the baseline's own §13 caveat); and anything requiring the Android
build (no code changed, nothing to build).

**This review records findings only. Every decision — recording AB1–AB7/D13, the merge of PR #60,
and whether to amend H5/H9 for the D14 scope items — remains the Tech Lead / Owner's.**

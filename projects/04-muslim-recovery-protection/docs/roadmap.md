# Project 04 — Delivery Roadmap

> **Project:** Muslim Recovery Protection  
> **Repository:** `takh86/ai-engineering-lab`  
> **Planning principle:** Human-led. AI-assisted. Test-verified.  
> **Status:** Planning baseline — no future architecture is authorized by this document.

## 1. Purpose

This roadmap turns the current Project 04 work into an outcome-based delivery plan with explicit
entry criteria, exit criteria, verification evidence, and human decision gates.

It does **not** pre-approve a protection architecture, bypass mitigation, backend, privileged Android
capability, production ruleset, telemetry, analytics, or release claim.

The project must continue to preserve the public product framing in `problem.md`: a privacy-first,
opt-in self-protection tool for consenting adults on their own devices. It is not a surveillance,
parental-control, or third-party-monitoring system.

## 2. Current source of truth — 2026-09-27

Checked against `main` at `6b0212f` (PR #59) and the GitHub issues, milestones and pull requests on
2026-09-27. GitHub remains the live tracker: if it disagrees with this section, GitHub wins and
this section needs an update.

**Product direction (D14 APPROVED):** the [recovery-first product baseline](recovery-first-product-baseline.md)
makes the urge moment, not the filter, the product. It adds a product discovery gate (M2-04)
before any build and turns M3 into Recovery Core V1. The Owner approved the direction in
conversation and explicitly approved by the Owner on GitHub on 2026-09-27.

### M1 — CLOSED

- The GitHub milestone "M1 — DNS Feasibility & Coverage Evidence" is closed. Tracker #14 and #16,
  #17 and #18 were closed as completed.
- #15 (M1-05A, one exact build under test) was closed as **not planned**. The historical mismatch
  between the tested build `1492c108` and the code PR #11 merged (`a292b6d`) was not reconstructed;
  it stays an accepted, documented limitation, and PR #30 stays closed unmerged.
- Merged: PR #11 (M1-05 experiment), PR #12 (M1-06 runbook), PRs #29 and #31 (M1-07 synthesis and
  the PR #30 decision), PR #32 (M-1 fix, D12).
- M-1 close-out, by evidence class (details in [M1-07](m1-07-evidence-synthesis.md) §5):
  - FACT: GitHub Actions passed `clean assembleDebug testDebugUnitTest lintDebug` on PR #32's head
    `5382a6c` and on `fd55932`. The Android code on `main` is identical to both.
  - HUMAN-REPORTED: the Tech Lead reported the Samsung close-out rows P, M, S, R, PD and X as PASS.
  - KNOWN LIMITATION: no automatic network handover. When the underlying network changes or becomes
    unusable, the experiment stops truthfully and the user restarts it manually.
- Tech Lead M1 → M2 decision: **continue to M2** (#14, #18). M1 approved no production
  architecture and widened no product claim.

### M2 — ACTIVE

- M2-01 threat model: complete (PR #33; #20 closed).
- M2-02 architecture options baseline: complete (PR #34; #21 closed).
- M2-03: G0 complete. #40 execution started on 2026-09-27 and is paused at V1-CELL. Parent #22
  is split into #39 → #40 → #41 → #42; their state is in the M2-03 section below.
- A8 is a verification candidate only. No production architecture is selected.
- D13 / AB1–AB7 is approved. AB-01 (#61) now validates the technical viability and truthful claim ceiling of L1 app interruption.
- M2-04 (#63) is the product discovery gate (E1–E3) approved by D14. Nothing in it has run.

### M3–M6 — BLOCKED

On GitHub today, #23 is still "Protection Core V1," blocked by the final M2 ADR (#42), and
#24–#26/#43–#54 are unchanged from their pre-D14 wording — an earlier revision of this PR had
already edited them to the D14 state before Owner approval; that was a human-gate violation
(§ below, and the baseline document §9/§11) and has been corrected by restoring their text. If
D14 is approved, M3 would be renamed to "Recovery Core V1" and re-gated on the M2-04 GO decision
and an approved M3-01 contract instead, with L1, L2 and L2b each joining only after their own
gate; M4–M6 would follow in sequence behind M3. Until that approval and sync, #23–#26/#43–#54
authorize no work under either their current or their proposed wording.

### Source-of-truth rule

Before M1-06 execution, record exactly one M1-05 build commit as the build under test.
The GitHub PR, local checkout, installed APK, M1-06 runbook, and evidence report must all refer to
that same reviewed commit. A branch name alone is not sufficient evidence.

How this rule was applied, and the accepted exception recorded in #15, are in
[M1-07](m1-07-evidence-synthesis.md) §3.

## 3. Delivery model

Every meaningful implementation task follows:

```text
Requirement
→ Design / decision discussion
→ Human approval
→ Bounded task contract
→ Implementation
→ Automated verification
→ Independent review
→ Human review
→ Merge
```

AI output is untrusted until verified.

### Definition of Ready

A task may enter implementation only when it has:

- a single clear outcome;
- an identified source of truth;
- explicit in-scope and out-of-scope boundaries;
- acceptance criteria;
- verification requirements;
- dependencies;
- unresolved human decisions called out explicitly;
- no hidden architecture expansion.

### Definition of Done

A task is done only when:

- acceptance criteria are satisfied;
- required tests/checks were actually run, or the missing evidence is explicitly recorded;
- no blocking review finding remains unresolved;
- relevant documentation/ADRs are updated;
- the PR describes AI contribution and human verification honestly;
- the Tech Lead approves the result.

### Git workflow

Preferred convention:

- Branch: `feat/04-mX-YY-short-name`, `fix/04-mX-YY-short-name`, or
  `docs/04-mX-YY-short-name`.
- One bounded concern per PR.
- PR links the task issue.
- No unrelated refactors in a milestone PR.
- No direct merge solely because an AI reviewer approved the change.

## 4. Milestone roadmap

| Milestone | Outcome | Status | Human gate |
|---|---|---|---|
| M1 | Establish real evidence for the DNS-only feasibility hypothesis and its bypass limits | **CLOSED** (2026-09-26) | Decide what the evidence permits us to claim and whether the project continues — decided: continue to M2 |
| M2 | Make explicit architecture, truthful-claim and product-validation decisions before any build | **ACTIVE** — M2-01, M2-02 and G0 complete; #40 in execution; AB-01 (#61) and M2-04 (#63) not started | Per layer: approve, narrow, investigate further or stop. For the product: GO, PIVOT or STOP (M2-04). |
| M3 | Implement and verify **Recovery Core V1** (L0), plus L1 and L2 only if their gates passed (D14) | CONDITIONAL — **BLOCKED** until the M2-04 GO decision and an approved M3-01 contract | Approve the recovery core and per-layer truthful states before productization |
| M4 | Build the German/Arabic MVP experience around the verified recovery core and approved layers | CONDITIONAL | Approve product usability and truthful user-facing states |
| M5 | Security, quality, compatibility, Play declarations and release engineering hardening | CONDITIONAL | Approve release candidate |
| M6 | Controlled pilot in Germany (DE/AR), evidence review, and portfolio/release decision | CONDITIONAL | Approve broader release or another iteration |

No calendar dates are committed until capacity and the previous gate are known.

---

# M1 — DNS Feasibility & Coverage Evidence

## Goal

Close the DNS-only hypothesis with reproducible evidence rather than implementation assumptions.

## Entry state

At planning time: M1-01 through M1-04 merged; M1-05 and M1-06 were open draft work.

**Current status (2026-09-26): M1 is CLOSED.** This section is kept as the historical work breakdown
and evidence contract. Outcomes:

- M1-05A (#15): closed as **not planned**. No single commit was frozen retroactively; the provenance
  difference is an accepted, documented limitation.
- M1-05B: recorded in M1-07 §4. The Gradle gate passed on the historical tested build `1492c108`;
  device results are human-reported.
- M1-06A (#16) and M1-06B (#17): completed. Every row is classified, with INCONCLUSIVE where
  detail was not preserved.
- M1-07 (#18): completed, including the M-1 fix (PR #32). Final report:
  [`m1-07-evidence-synthesis.md`](m1-07-evidence-synthesis.md).

## Required work

### M1-05A — Reconcile the build under test

- Review the one-commit difference between:
  - `feat/04-m1-05-dns-filtering`; and
  - `feat/04-m1-05-mobile-fixes`.
- Run the required local Android verification on the candidate commit.
- Integrate only after human review.
- Record the final tested commit in PR #11 and M1-06.

### M1-05B — Complete M1-05 verification

Required evidence includes:

- clean Android build;
- unit tests;
- lint;
- manual device acceptance for the M1-05 scope;
- confirmation of the human-review items documented in PR #11;
- no `ProtectionState.Protected` claim from the experiment.

### M1-06A — Finalize the validation gate

Before execution:

- freeze the test domains;
- freeze gating vs characterization scope;
- freeze architecture stop conditions;
- reconcile the M1-06 build reference with the actual M1-05 build under test;
- keep validation evidence separate from the final human architecture decision.

### M1-06B — Execute coverage and bypass validation

Run the approved matrix on the recorded device/browser/network configuration.

Evidence must preserve:

- exact app commit;
- browser versions;
- Android/device build;
- DNS/browser settings;
- controls;
- observed DNS / access outcome;
- truthful state;
- result classification;
- limitations and unexecuted cases.

### M1-07 — Evidence synthesis and gate close

Produce one final M1 evidence report that:

- summarizes M1-05 and M1-06 results;
- separates facts, assumptions, unknowns, and missing evidence;
- records every reproducible bypass and connectivity failure;
- states exactly what the tested system can and cannot claim;
- prepares architecture alternatives without choosing one automatically;
- records the Tech Lead decision separately.

## Exit criteria

M1 is closed only when:

- PR #11's reviewed build has passed its required verification;
- M1-06 has an approved, fixed test scope;
- required M1-06 cases have evidence or are explicitly classified unavailable/inconclusive;
- the evidence report is complete;
- any stop condition is visible;
- the Tech Lead has made the M1 → M2 continuation decision.

**Status (2026-09-26): met, with one recorded qualifier. M1 is closed.**

- The required verification passed on the tested M1-05 build `1492c108`, not on the code PR #11
  merged (`a292b6d`). This difference is kept as a documented limitation (#15 closed as not planned;
  M1-07 §3.3).
- M1-06 scope and H1–H3 were fixed before execution: the runbook is unchanged since `b565d04`,
  which predates the build under test. PR #12 merged it.
- Every M1-06 row is classified; rows whose detail was not preserved are INCONCLUSIVE
  ([results](m1-06-execution-results.md)).
- The evidence report is final ([M1-07](m1-07-evidence-synthesis.md)), including the M-1 close-out.
- Stop conditions and limitations stay visible, including the absence of automatic network handover.
- The Tech Lead decided to continue to M2 (#14, #18).

---

# M2 — Architecture & Truthful Product Claim

## Goal

Convert M1 evidence into an explicit product threat model and architecture decision **before**
additional protection implementation.

## M2-01 — Threat model and coverage claim

Define:

- the user and device ownership assumptions;
- what "protection" means in this product;
- what ordinary/default behavior must be covered;
- whether deliberate self-bypass is inside or outside the product threat model;
- unsupported configurations;
- wording the UI may and may not use.

Deliverable: reviewed threat-model / product-claim document.

Status: approved by the Tech Lead and merged (PR #33):
[`m2-01-approved-threat-model.md`](m2-01-approved-threat-model.md).

## M2-02 — Architecture options assessment

Compare only options justified by M1 evidence.

For every candidate evaluate:

- coverage;
- Android permission / API implications;
- Play policy / distribution implications;
- privacy impact;
- security risk;
- implementation complexity;
- testability;
- battery/performance impact;
- bypass surface;
- long-term maintainability.

Potential alternatives are research inputs, not pre-approved implementations.

Status: final architecture baseline merged (PR #34):
[`m2-02-architecture-options.md`](m2-02-architecture-options.md). It selects no production
architecture.

## M2-03 — Human ADR and M3 task contract

The Tech Lead records one explicit decision:

- continue with a narrowed DNS-based claim;
- approve a different architecture for a bounded prototype;
- require more investigation;
- change product/platform direction;
- stop the approach.

Only after that decision is accepted may M3 implementation tasks be decomposed.

**Scope under D14 (APPROVED):** M2-03 decides the DNS layer (L2). It no longer decides alone when
M3 starts: the Recovery Core V1 entry depends on the M2-04 GO decision and an approved M3-01
contract. The DNS layer joins M3 or a later milestone only after #42 PASS.

Status (2026-09-27): G0 complete; device verification in progress. Parent issue #22 is split into four steps, in order:

| Issue | Step | State |
|---|---|---|
| #39 | M2-03A — human gate / G0 | **Closed as completed.** The Tech Lead recorded M2-03A and approved H18 for verification only, H19a, H19b and H21 in [#39](https://github.com/takh86/ai-engineering-lab/issues/39). No production decision. |
| #40 | M2-03B — A8 verification V0–V13 | **In execution, paused by the Tech Lead at V1-CELL** (2026-09-27). Recorded in #40: V0 VALID; V1-WIFI NOT MET under the frozen rule, because `dumpsys dnsresolver` was unavailable. No row is PASS and V2 has not started. PR #62 proposes a read-only evidence collector. |
| #41 | M2-03C — T2 friction validation | Open; coordinate with #40 after the execution setup. No friction result recorded. |
| #42 | M2-03D — evidence synthesis + final architecture ADR | Blocked by #40 and #41. Under D14, it decides the DNS layer (L2) only. |

Decision package: [`m2-03-architecture-adr.md`](m2-03-architecture-adr.md). A8 is not approved for
production, and no production architecture is selected. The DNS layer stays out of any build until
#42 records the final ADR.

### Later product-scope decision — voluntary app blocking

On 2026-09-26 the Owner approved the bounded direction in the project conversation, and on
2026-09-27 formally approved D13 / AB1–AB7 after PR #60 was reconciled and merged. The
[`app-blocking architecture`](app-blocking-architecture-decision.md): selected-app
interruption plus local recovery help, separately from DNS. A physical-device permission and
latency spike must choose between the Usage Access/overlay and narrow Accessibility candidates;
Play review and truthful claims are required before release. This does not amend A8's AC/RJ
criteria or unblock the final production ADR. An app-blocking task contract must be approved
separately before code, without silently treating the historical M1 exclusions as current scope.
The exact architecture boundary is now approved as D13 / AB1–AB7. Mechanism selection remains evidence-gated.
The bounded product/technical validation is tracked separately in
[issue #61](https://github.com/takh86/ai-engineering-lab/issues/61); it does not block #40/#41.
AB-01's voluntary product check can run inside M2-04's E1 and E3, so participants are recruited
only once; the Owner decides.

## M2-04 — Product discovery gate (approved by D14)

Answer the questions that decide whether to build anything, cheaply and without code: do people
want a private, non-shaming companion, do they use it at the urge moment, and do they trust it?
Design, pre-registered thresholds and stop criteria are in
[`recovery-first-product-baseline.md`](recovery-first-product-baseline.md) §8. The Owner may adjust
thresholds **before** execution, never after results. Parent issue: #63.

| Issue | Step | State |
|---|---|---|
| #64 | M2-04A — E1 interviews and anonymous survey (DE/AR) | Not started |
| #65 | M2-04B — E2 landing pages: positioning and name test | Not started |
| #66 | M2-04C — E3 four-week no-code concierge | Not started; requires clinically reviewed materials and ethics safeguards (18+, consent, minimal data, crisis resources) |
| #67 | M2-04D — synthesis and Owner GO / PIVOT / STOP decision | Blocked by E1–E3 and AB-01 |

Open Owner decisions OD1–OD14 from the baseline are tracked in #68.

## Exit criteria

- Threat model approved.
- Truthful product claim approved.
- M2-04 decision recorded (GO / PIVOT / STOP) with the approved MVP scope.
- Per-layer decisions recorded: L2 through the #42 ADR, or L2 explicitly kept out of the MVP
  while its verification continues; L1 through the now-satisfied D13 approval plus the AB-01 result and its own approved task contract.
- M3 scope and non-goals approved.
- Verification strategy defined before implementation.

---

# M3 — Recovery Core V1 (Conditional)

> Renamed from "Protection Core V1" by approved D14. The GitHub milestone title needs the same
> rename.

## Goal

Implement the on-device recovery core (L0) that M2-04 validated, with truthful per-layer status.
Add app interruption (L1) and DNS guidance (L2) only if each passed its own gate, and establish
objective runtime criteria for when each layer may report itself as active.

## Entry (D14)

- M2-04 decision is GO, with an approved MVP scope.
- M3-01 task contract approved by the Tech Lead.
- L1 in scope only after the now-satisfied D13 approval, a passing AB-01 (#61) result and its own
  approved task contract.
- L2 in scope only after #42 records PASS for the claimed configuration.

## Planning constraints

No M3 issue may assume:

- packet inspection;
- TLS interception;
- browser modification;
- Device Owner;
- AccessibilityService; PR #60 considers a bounded package-level candidate, but **does not**
  authorize an M3 implementation until a mechanism is selected after the spike, Play review and
  an explicit task contract;
- root;
- backend;
- production rule distribution;
- Always-on behavior;
- a protection layer whose own gate has not passed;
- any feature on the baseline's reject list (§5);

unless the relevant M2 decision explicitly authorizes that capability.

## Expected work packages

After the M2-04 decision, decompose M3 into bounded issues for:

1. L0 recovery core: Help now, if–then plans, lapse reflection, weekly review, optional local
   notes;
2. per-layer runtime truth: Filter Active and App Blocking Active stay separate, and no
   undifferentiated Protected state;
3. L1 app interruption, only if approved;
4. L2 DNS guidance and check, only if approved;
5. lifecycle behavior required by the approved threat model;
6. automated tests;
7. physical-device tests for each included layer;
8. security/privacy review;
9. architecture documentation.

## Exit criteria

- The recovery core works with every protection layer absent, revoked or failing (H12).
- Each included layer works on its target matrix, and unsupported paths are represented
  truthfully.
- No false active or Protected state is reproducible in required scenarios.
- Automated and device verification pass.
- Architecture and decision records match the implementation.

---

# M4 — MVP Product Experience (Conditional)

## Goal

Turn the verified recovery core and approved layers into an understandable, honest, usable Android
MVP for German- and Arabic-speaking users (D14; first market per OD11).

## Expected work packages

- onboarding and consent flow, with setup in a calm state;
- Help now reachable from the home screen and, if L1 is approved, from the interruption;
- clear active / degraded / unsupported / error states for each included layer;
- local settings required by the approved MVP;
- user-facing limitation and privacy explanations;
- German and Arabic copy in a human, non-preaching voice;
- regional referral directory (L4);
- discreet presentation if OD2 is approved; optional faith content if OD9 is approved;
- accessible Compose UI (ordinary UI accessibility; this does **not** authorize Android
  `AccessibilityService`);
- product-level acceptance testing.

Backend, analytics, accountability, payments (OD10), and content-library features remain separate
decisions, not implicit M4 requirements.

## Exit criteria

- Core flows meet approved product requirements.
- UI language matches verified technical coverage.
- Error and degraded states are actionable and truthful.
- MVP acceptance tests pass.

---

# M5 — Security, Quality & Release Engineering

## Goal

Produce a reproducible, reviewable release candidate rather than a developer prototype.

## Expected work packages

- path-scoped CI under the repository-root `.github/workflows/`;
- build, unit-test and lint gates;
- integration/instrumentation tests where valuable;
- dependency and security review;
- Android permission / manifest review;
- Play declarations and in-app consent for the permissions that L1 actually selects (Usage
  Access, overlay, any foreground-service type, and Accessibility only if selected), tested on a
  closed-testing track before release;
- privacy and data-flow review; an open-source core and an independent data-flow review if OD7 is
  approved;
- compatibility matrix across the supported Android range, including OEM background limits and
  Advanced Protection for L1;
- lifecycle, battery, performance and resilience checks;
- reproducible release/signing process;
- release checklist and rollback criteria.

Any telemetry, crash reporting, or analytics requires a separate privacy/product decision before use.

## Exit criteria

- Required CI is green.
- No unresolved critical/blocking security finding.
- Privacy/data-flow documentation matches reality.
- Release artifact is reproducible.
- Known limitations are documented.
- Tech Lead approves the release candidate.

---

# M6 — Controlled Pilot & Portfolio Evidence

## Goal

Validate the product with controlled real-user feedback and publish engineering evidence without
overselling the system. Under D14 the pilot runs in Germany (German and Arabic). Its feasibility
and no-harm criteria (use at the urge moment, week-4 retention, no rise in shame or distress) are
pre-registered from E3 before recruitment. It makes no efficacy claim.

## Expected work packages

- controlled pilot plan;
- explicit consent and privacy boundaries;
- pre-registered feasibility and no-harm criteria, with a qualified clinical reviewer;
- structured feedback collection;
- issue triage and severity rules;
- pilot exit report;
- release/no-release decision;
- professional Project 04 README refresh;
- architecture diagrams;
- test/CI evidence;
- AI contribution vs human decisions;
- mistakes found by AI/human review;
- lessons learned and next iteration.

## Exit criteria

- Pilot findings are documented.
- Release blockers are resolved or explicitly accepted by the Tech Lead.
- Product claims remain within verified coverage.
- Portfolio documentation shows:
  problem → decisions → architecture → implementation → tests → CI → verification → AI role →
  human ownership.

---

## 5. Planning policy for future issues

Use progressive elaboration:

- M1 and M2 tasks are detailed now because they are actionable.
- M3–M6 stay as milestone trackers until their entry gates pass. D14 rewords the existing
  trackers (#23–#26, #43–#54) to match the recovery-first baseline; it adds no implementation
  issues.
- Do **not** create dozens of speculative implementation issues for an architecture that has not
  been approved yet.
- At each milestone gate, decompose only the next milestone into small reviewable tasks.

This prevents backlog noise, stale assumptions, and architecture-by-ticket.

## 6. Human authority

The Tech Lead owns:

- scope;
- threat model;
- product claim;
- architecture selection;
- security/privacy trade-offs;
- milestone acceptance;
- merge approval;
- release approval.

AI may research, draft, implement bounded tasks, generate tests, and review work, but cannot convert
an experiment result into a product/architecture decision on its own.

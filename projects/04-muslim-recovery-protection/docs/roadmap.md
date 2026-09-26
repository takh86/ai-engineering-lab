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

## 2. Current source of truth — 2026-09-26

Checked against `main` at `6e3349b` (PR #38) and the GitHub issues, milestones, pull requests and
Actions runs on 2026-09-26. GitHub remains the live tracker: if it disagrees with this section,
GitHub wins and this section needs an update.

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
- M2-03: pending human-gate and verification work. Parent #22 is split into #39 → #40 → #41 → #42;
  their state is in the M2-03 section below.
- A8 is a verification candidate only. No production architecture is selected.

### M3–M6 — BLOCKED

M3 (#23) is blocked by the final M2 ADR; M4–M6 (#24–#26) are blocked in sequence behind it. Their
child issues (#43–#54) are marked BLOCKED on GitHub and authorize no work.

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
| M2 | Make an explicit architecture + truthful product-claim decision from M1 evidence | **ACTIVE** — M2-01 and M2-02 complete; M2-03 (#39 → #42) pending | Approve one path, narrow scope, investigate further, or stop |
| M3 | Implement and verify the **approved** Protection Core V1 | CONDITIONAL — **BLOCKED** until the final M2 ADR | Approve verified protection semantics before productization |
| M4 | Build the MVP user experience around the verified protection core | CONDITIONAL | Approve product usability and truthful user-facing states |
| M5 | Security, quality, compatibility, and release engineering hardening | CONDITIONAL | Approve release candidate |
| M6 | Controlled pilot, evidence review, and portfolio/release decision | CONDITIONAL | Approve broader release or another iteration |

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

Status (2026-09-26): pending. Parent issue #22 is split into four steps, in order:

| Issue | Step | State |
|---|---|---|
| #39 | M2-03A — human gate / G0 | The Tech Lead recorded "M2-03A = APPROVE": M2-01 + M2-02 are the M2 decision baseline and A8 is a verification candidate only. PR #55 is merged and carries that decision package on `main`. G0 remains **incomplete**: H18, H19a, H19b and H21 are still pending Tech Lead decisions. No device verification is authorized until G0 is complete. |
| #40 | M2-03B — A8 verification V0–V13 | Blocked by M2-03A / G0. Not executed. |
| #41 | M2-03C — T2 friction validation | Blocked by M2-03A / G0. Not executed. |
| #42 | M2-03D — evidence synthesis + final architecture ADR | Blocked by #40 and #41. |

Decision package: [`m2-03-architecture-adr.md`](m2-03-architecture-adr.md). A8 is not approved for
production, no production architecture is selected, and M3 stays blocked until #42 records the final
ADR.

### Later product-scope decision — voluntary app blocking

On 2026-09-26 the Owner approved the bounded direction in
[`app-blocking-architecture-decision.md`](app-blocking-architecture-decision.md): selected-app
interruption plus local recovery help, separately from DNS. A physical-device permission and
latency spike must choose between the Usage Access/overlay and narrow Accessibility candidates;
Play review and truthful claims are required before release. This does not amend A8's AC/RJ
criteria or unblock the final production ADR. An app-blocking task contract must be approved
separately before code, without silently treating the historical M1 exclusions as current scope.

## Exit criteria

- Threat model approved.
- Truthful product claim approved.
- Architecture ADR accepted.
- M3 scope and non-goals approved.
- Verification strategy defined before implementation.

---

# M3 — Protection Core V1 (Conditional)

## Goal

Implement the architecture explicitly approved in M2 and establish objective runtime criteria for
when protection can be reported as operational.

## Planning constraints

No M3 issue may assume:

- packet inspection;
- TLS interception;
- browser modification;
- Device Owner;
- AccessibilityService beyond the bounded package-level candidate in
  [`app-blocking-architecture-decision.md`](app-blocking-architecture-decision.md);
- root;
- backend;
- production rule distribution;
- Always-on behavior;

unless the M2 ADR explicitly authorizes that capability.

## Expected work packages

After the M2 decision, decompose M3 into bounded issues for:

1. protection-core implementation;
2. runtime truth / `filteringOperational` semantics;
3. lifecycle and recovery behavior required by the approved threat model;
4. rule/configuration source required by the approved scope;
5. automated tests;
6. physical-device coverage tests;
7. security/privacy review;
8. architecture documentation.

## Exit criteria

- Approved protection behavior works on the target matrix.
- Unsupported paths are represented truthfully.
- No false Protected state is reproducible in required scenarios.
- Automated and device verification pass.
- Architecture and decision records match the implementation.

---

# M4 — MVP Product Experience (Conditional)

## Goal

Turn the verified protection core into an understandable, honest, usable Android MVP.

## Expected work packages

- onboarding and consent flow;
- start/stop/recovery UX;
- clear protection / degraded / unsupported / error states;
- local settings required by the approved MVP;
- user-facing limitation and privacy explanations;
- accessible Compose UI (ordinary UI accessibility; this does **not** authorize Android
  `AccessibilityService`);
- product-level acceptance testing.

Backend, analytics, accountability, payments, and content-library features remain separate decisions,
not implicit M4 requirements.

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
- privacy and data-flow review;
- compatibility matrix across the supported Android range;
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
overselling the system.

## Expected work packages

- controlled pilot plan;
- explicit consent and privacy boundaries;
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
- M3–M6 stay as milestone trackers until their entry gates pass.
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

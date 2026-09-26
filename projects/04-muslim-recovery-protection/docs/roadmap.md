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

## 2. Current source of truth — 2026-09-25

### Merged on `main`

- M1-01 — project scaffolding.
- M1-02 — truthful protection-state domain model.
- M1-03 — deterministic block-rules-only hostname matching engine.
- M1-04 — Android VPN lifecycle foundation with no filtering.

### Open work

- **PR #11 — M1-05 DNS-only filtering experiment**
  - Draft / open / not merged.
  - PR head: `feat/04-m1-05-dns-filtering`.
  - A separate branch, `feat/04-m1-05-mobile-fixes`, is currently one commit ahead of the PR head.
  - The extra commit must not be treated as part of PR #11 until it is deliberately reviewed and
    integrated by the Tech Lead.

- **PR #12 — M1-06 DNS coverage and bypass validation gate**
  - Draft / open / documentation only / not executed.
  - It must not execute until the M1-05 build under test is fixed to one exact reviewed commit and
    M1-05's own build, lint, and device acceptance gates pass.

### Source-of-truth rule

Before M1-06 execution, record exactly one M1-05 build commit as the build under test.
The GitHub PR, local checkout, installed APK, M1-06 runbook, and evidence report must all refer to
that same reviewed commit. A branch name alone is not sufficient evidence.

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
| M1 | Establish real evidence for the DNS-only feasibility hypothesis and its bypass limits | ACTIVE | Decide what the evidence permits us to claim and whether the project continues |
| M2 | Make an explicit architecture + truthful product-claim decision from M1 evidence | PLANNED | Approve one path, narrow scope, investigate further, or stop |
| M3 | Implement and verify the **approved** Protection Core V1 | CONDITIONAL | Approve verified protection semantics before productization |
| M4 | Build the MVP user experience around the verified protection core | CONDITIONAL | Approve product usability and truthful user-facing states |
| M5 | Security, quality, compatibility, and release engineering hardening | CONDITIONAL | Approve release candidate |
| M6 | Controlled pilot, evidence review, and portfolio/release decision | CONDITIONAL | Approve broader release or another iteration |

No calendar dates are committed until capacity and the previous gate are known.

---

# M1 — DNS Feasibility & Coverage Evidence

## Goal

Close the DNS-only hypothesis with reproducible evidence rather than implementation assumptions.

## Entry state

M1-01 through M1-04 merged. M1-05 and M1-06 are open draft work.

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

## M2-03 — Human ADR and M3 task contract

The Tech Lead records one explicit decision:

- continue with a narrowed DNS-based claim;
- approve a different architecture for a bounded prototype;
- require more investigation;
- change product/platform direction;
- stop the approach.

Only after that decision is accepted may M3 implementation tasks be decomposed.

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
- AccessibilityService;
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

# M2-01 — Approved Threat Model & Product Direction

> **Project:** Muslim Recovery Protection  
> **Milestone:** M2-01 — Threat Model + Truthful Product Claim  
> **Status:** **APPROVED by Tech Lead**  
> **Date:** 2026-09-26  
> **Nature:** Product/security decisions only. No M2 implementation is authorized by this document.

## 1. Purpose

M2-01 defines what the product is trying to protect, what it does not guarantee, how bypasses are classified, and how the product should be positioned before M2-02 compares protection architectures.

The product remains:

- for consenting adult users on devices they own;
- privacy-first and local-first;
- recovery-oriented rather than surveillance-oriented;
- truthful about technical coverage and failure states.

Core principle:

> **The user's long-term decision should be stronger than their short-term urge.**

The product must not imply that a user-owned Android device can be made impossible for its owner to bypass.

## 2. Approved decisions

### H4 — Threat scope

**APPROVED**

The primary threats are:

- **T0 — accidental exposure**
- **T1 — impulsive access through default configurations of tested browsers**

The product also addresses a named list of **T2 casual bypass actions**.

Every T2 action must be classified as one of:

- **COVERED** — the product prevents it within a defined, tested boundary;
- **DETECTED** — Android exposes a reliable signal and the runtime state changes truthfully;
- **DISCLOSED** — the product cannot reliably prevent or detect it, so the limitation is explicitly included in coverage wording.

Success is measured by the meaningful friction, steps and time added between an urge and access — not by claiming complete blocking.

### H5 — Device-owner guarantee boundary

**APPROVED**

OS-level actions that remove, replace or override the protection mechanism are outside the product guarantee.

Examples include:

- force-stop;
- uninstall;
- clearing app data;
- ADB/root;
- revoking the VPN;
- another VPN taking the active VPN slot;
- other user-controlled OS-level changes that bypass or remove the mechanism.

Where Android exposes a reliable signal, the app must reflect the loss of protection truthfully at the next available opportunity.

The app may add friction only to its **own** weakening/disable controls. It must not attempt to prevent the owner from controlling the device at OS level.

### H6 — Product positioning

**APPROVED**

The product is **recovery-first with a self-protection/filter layer**.

The recovery layer must provide meaningful value independently of whether filtering is available.

The filter layer:

- adds technical friction;
- is optional from the product-value perspective;
- has a clearly stated, tested coverage boundary;
- must never be marketed as complete or unbreakable protection.

The recovery layer must continue to work when filtering is unavailable, unsupported or intentionally disabled.

### H7 — Protection-state semantics

**APPROVED WITH IMPLEMENTATION DETAIL DEFERRED**

User-facing UX must not use **Protected** as a claim of safety or non-bypassability.

The intended user-facing meaning is **Filter Active**:

> All runtime conditions required by the approved filter boundary are currently observed to hold.

This state says nothing about traffic outside the approved boundary.

If required conditions are false or unavailable, the state must truthfully become a narrower state such as Degraded, Unavailable, Stopped or Error.

**Deferred:** whether the internal Kotlin enum/class name `ProtectionState.Protected` is renamed is an implementation/specification decision for a later milestone. M2-01 approves the semantics and user-facing vocabulary, not a code refactor.

### H8 — Commitment friction

**APPROVED**

The user may configure a delay or deliberate friction before weakening/disabling protection **inside the app**.

Requirements:

- configured while the user is in a calm state;
- clearly shown before it applies;
- no fake errors or hidden controls;
- no guilt/shame mechanics;
- no attempt to lock Android system controls;
- the delay itself may be used as a recovery/urge-intervention moment.

Exact timing, screens and interaction design are deferred to product specification.

### H9 — Privacy boundary

**APPROVED**

MVP privacy principles:

- local-first;
- no browsing-history database;
- no queried-hostname storage;
- no per-domain blocked-event history;
- no third-party analytics;
- no advertising SDK;
- no backend required for the MVP;
- recovery data is optional and local.

Recovery data must not become surveillance data.

**Deferred:** exact retention periods, database schema, encryption library and key-management implementation are later technical decisions and are not fixed by M2-01.

### H10 — Claim control

**APPROVED**

Every claim about filtering must map to:

1. a defined protection boundary;
2. evidence from an approved test matrix or verification artifact;
3. a known list of limitations.

Marketing copy may simplify wording but must never broaden the engineering claim.

Claims must be re-reviewed when architecture or coverage evidence changes.

### H11 — Private DNS stance

**APPROVED**

The app must never silently disable, bypass or downgrade Android Private DNS.

If the chosen filter architecture cannot operate while Private DNS is active:

- filtering becomes unavailable or stops truthfully;
- the user receives an explanation of the trade-off;
- the user decides whether to change the Android setting.

A privacy/security feature must not be silently weakened merely to improve filter coverage.

### H12 — Recovery without filtering

**APPROVED**

The MVP recovery layer must remain usable when the filter is unavailable.

This is an acceptance-level product principle, not an optional fallback.

The product must therefore preserve meaningful value if:

- Private DNS prevents filtering;
- the VPN is not active;
- the device/platform is unsupported;
- distribution policy prevents a VPN-based build;
- the user intentionally chooses not to enable filtering.

## 3. Approved threat-model structure

| Threat | Product response |
|---|---|
| T0 accidental exposure | Defend within tested coverage |
| T1 short-term impulse | Defend with filtering + recovery friction |
| T2 casual bypass | Explicit COVERED / DETECTED / DISCLOSED registry |
| T3 technically determined device owner | No guarantee; truthful state where signals exist |
| T4 competing VPN / platform interference | Detect where Android exposes a reliable signal |
| T5 privacy threat created by our own app | Prevent by architecture and data-minimisation rules |

The key dimensions are **effort/time to bypass** and **detectability**, not assumptions about the user's motivation.

## 4. Product direction

The product thesis approved for M2 is:

> **A private recovery and self-protection product that helps the user's deliberate long-term decision compete with short-term impulse, using meaningful recovery tools plus technical friction whose coverage is stated truthfully.**

The filter is not the entire product.

Potential recovery capabilities remain product hypotheses until specified and validated. Examples under consideration include:

- urge intervention flow;
- user-chosen commitment delay;
- if-then plans;
- user-defined high-risk windows;
- non-shaming lapse reflection;
- local trigger notes;
- optional curated religious motivation from approved sources.

None of these examples become implementation requirements merely by appearing here.

## 5. Truthful-claim boundary

M2-01 rejects absolute claims such as:

- full protection;
- cannot be bypassed;
- unbreakable;
- works in every browser/app;
- porn-free phone;
- complete pornography blocking.

The exact Engineering / User-facing / Marketing wording remains a product-copy deliverable to be finalized after M2-02 chooses the protection architecture and coverage boundary.

## 6. Decisions deliberately deferred

M2-01 does **not** decide:

- final protection architecture;
- DNS-only vs broader VPN vs guided Private DNS or another family;
- Always-on / lockdown product support;
- final minSdk for the filter layer;
- Play Store VpnService eligibility;
- exact `FilterActive` health probes or thresholds;
- storage retention periods;
- encryption library / persistence implementation;
- religious-content sources or whether religious content is in MVP;
- final Arabic copy;
- M3 implementation scope.

These belong to M2-02 or later Human Gates.

## 7. M2-01 exit

**M2-01 is CLOSED / APPROVED.**

The next milestone is:

> **M2-02 — Protection Architecture Options**

M2-02 must compare architecture families against the approved H4–H12 decisions before the Tech Lead selects a protection architecture.

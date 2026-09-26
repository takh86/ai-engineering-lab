# M2-03 — Architecture ADR: Verification Gate Record

> **Status: M2-03A RECORDED; G0 READY FOR TECH LEAD SIGN-OFF**
>
> **Project:** Muslim Recovery Protection\
> **Milestone:** M2 — Architecture & Truthful Product Claim ([issue #19](https://github.com/takh86/ai-engineering-lab/issues/19))\
> **Task:** M2-03 — Human architecture ADR ([issue #22](https://github.com/takh86/ai-engineering-lab/issues/22)); this file prepares step M2-03A only\
> **Date prepared:** 2026-09-26\
> **Decision provenance:** the Tech Lead directed adoption of the final baseline and expressed
> support for H18 verification-only in the project conversation on 2026-09-26. Codex prepared
> the exact G0 choices below for human review. Their checkboxes remain empty until the Tech Lead
> confirms each item. No device result is implied.

This record selects A8 as the verification candidate, but G0 is not yet complete. It does not
select a production architecture or authorize M3 work. Where it and its sources differ,
[M2-01][m2-01] and [M2-02][m2-02] win.

**Later product-scope addendum (2026-09-26):** The Owner separately approved a voluntary,
package-level [app-blocking architecture boundary](app-blocking-architecture-decision.md).
This does not change this ADR's A8 verification criteria, G0 decisions, or production status.
The H16/A7b exclusion of Accessibility for URL inspection is not a decision about the new
package-level candidate. The new permission and coverage gate remains conditional.

---

## 1. Inputs

### 1.1 M2-01 — approved threat model (H4–H12)

Approved by the Tech Lead and merged into `main` through PR #33 (`a0aba40`). Full wording:
[`m2-01-approved-threat-model.md`][m2-01] §2. Not reopened here.

| ID | Subject |
|---|---|
| H4 | Threat scope: T0, T1, and a named T2 list classified COVERED / DETECTED / DISCLOSED |
| H5 | Device-owner guarantee boundary |
| H6 | Product positioning: recovery-first with a self-protection/filter layer |
| H7 | Protection-state semantics: "Filter Active", not "Protected" |
| H8 | Commitment friction inside the app only |
| H9 | Privacy boundary |
| H10 | Claim control |
| H11 | Private DNS stance: never silently disabled, bypassed or downgraded |
| H12 | Recovery without filtering |

### 1.2 M2-02 — final architecture baseline

Issued as the final baseline at the Tech Lead's direction and merged into `main` through PR #34
(`4d1fe84`): [`m2-02-architecture-options.md`][m2-02]. Relevant sections:

- §A — candidate structure, decisions and the separate recommendation ("verify A8 first");
- §D — neutral comparison of A1–A8;
- §E — A8 verification plan: gate G0, oracle, matrix V0–V17, T2 register B1–B12, friction protocol;
- §F — filter state / coverage / freshness model, including `CHECK_TTL`;
- §G — privacy and trust decision H18;
- §I — acceptance criteria AC1–AC9, rejection conditions RJ1–RJ6, outcomes decided in advance;
- §L — ADR-M2-02, decision items H13–H21, "What recording this baseline means", sequence.

---

## 2. M2-03A decision — approved for verification

> **APPROVED FOR VERIFICATION ONLY — 2026-09-26**

- Adopt M2-01 and M2-02 as the M2 decision baseline.
- Approve A8 only as the next **verification candidate**.
- Do **not** approve A8 for production yet.
- Do **not** authorize M3 implementation yet.
- Execute the pre-defined verification gate before production architecture selection.

What adopting the baseline covers is defined in M2-02 §L, "What recording this baseline means": the
§A.1 structure, the §F state model (including `CHECK_TTL`), the §E verification protocol, the §I
outcomes, the §H dispositions (effective only after a PASS), decision items H13–H17, and H20 as
optional. It does not accept A8 for production.

**Tech Lead decision on M2-03A:**

- [x] APPROVE
- [ ] REJECT

Recorded from: Tech Lead's project-conversation direction, 2026-09-26. Transcribed by Codex.
Notes: A8 and Cloudflare Families are not approved for production. H20 remains optional.

### 2.1 Decision items carried by the proposal

Final wording is in M2-02 §L, "Decision items". The summaries below are pointers only.

| ID | Subject | State in this package |
|---|---|---|
| H13 | Recovery/filter separation | APPROVED BASELINE |
| H14 | A8 is the filter layer's verification candidate only | APPROVED FOR VERIFICATION |
| H15 | Mechanism + coverage + freshness state model | APPROVED BASELINE; unimplemented |
| H16 | Deferred / excluded architecture paths (A2, A3, A4a, A4b, A5, A6, A7a, A7b) | APPROVED BASELINE |
| H17 | Verification before the production decision (G0 → V0–V13 → friction runs → report → §I.3) | APPROVED SEQUENCE; unexecuted |
| H20 | Recovery also works without internet; optional and not an implementation precondition unless approved | OPTIONAL — pending Tech Lead acceptance |

H18, H19 and H21 are not part of M2-03A. They are gate G0 decisions (§3).

---

## 3. G0 — decisions prepared for Tech Lead sign-off

Source: M2-02 §E.1, §G and §L. The exact items below require separate recorded decisions
before the named scope is frozen or any device row begins. The broader direction to proceed
does not substitute for these checks.

### H18 — Verification privacy consent

- [ ] APPROVE
- [ ] REJECT

**Question:** For the verification phase only, do I approve routing the test device's DNS queries
through the filtering provider under test (Cloudflare Families / `family.cloudflare-dns.com`)?

- **Needed before:** V1 and every later device row (§E.1).
- **This is NOT production approval.** Production privacy acceptance is a separate decision, made
  through AC8 (§I.2). Rejecting it for production is RJ6 (§I.3).
- **Data flow and provider facts:** M2-02 §G.1–§G.3.
- **Proposed verification boundary, consistent with the Tech Lead's expressed intent:** use a
  dedicated, limited test window; avoid personal browsing.
  Other installed apps may still generate DNS queries. Record the as-found Private DNS setting,
  restore it immediately after the window, and verify the restored setting and connectivity.
  Never interpret this approval as consent to ongoing routing or production deployment.
- **If rejected:** M2-02 §G.1 lists the reject option as "A8 stops, and either A2 is reopened
  (§D.4) or the product ships recovery-only (H12)"; H18 rejection is also an A2 reopening trigger
  (§D.4). The choice between those follow-ups is a separate Tech Lead decision.

### H19a — Test names

- [ ] APPROVE
- [ ] REJECT

Policy exactly as defined in M2-02 §E.1 and §L H19(a), extending D3:

| Name | Role |
|---|---|
| `nudity.testcategory.com` | Category name. Oracle validity rests on its A answer only. |
| `malware.testcategory.com` | Informational only; recorded, never affects validity |
| `example.org` | Control (IANA) |
| `example.com` | Control (IANA) |

- **Needed before:** V0 (§E.1). V0 needs H19a only.
- **If rejected:** M2-02 defines no separate outcome for rejecting H19a. V0 cannot run without it,
  and AC1 rests on V0 (§I.2). The follow-up is a Tech Lead decision.

### H19b — Browser test-page access

- [ ] APPROVE
- [ ] REJECT

**Question:** May the approved test browsers open the provider's documented harmless test-category
page where the verification protocol requires it?

- **Needed before:** V3, V4, V7, V11–V13 and the browser-level friction runs (§E.1).
- **Safety evidence checked before recording this decision:** Cloudflare's
  [Families setup documentation](https://developers.cloudflare.com/1.1.1.1/setup/#test-1111-for-families)
  explicitly names this test URL. Its [currently served page](https://nudity.testcategory.com/)
  was opened read-only on 2026-09-26; the visible page identifies itself as a Cloudflare Gateway
  test site and contains no adult-content text. The device test still uses only this designated
  test name and the approved controls; page contents may change after this check.
- **If rejected** (M2-02 §E.1, §I.3):
  - no validated alternative currently gives equivalent browser evidence; a resolver-diagnostic
    page is an unvalidated candidate (U15);
  - V3 cannot produce COVERED, so AC4 cannot be met;
  - **no device row runs**, and the outcome is **NOT VERIFIABLE for the T1 claim — not accepted**;
  - each follow-up is a separate decision: approve navigation later; validate and approve the
    alternative; reopen A2; or amend H4 to drop browser claims (a product-scope change to M2-01).

### H21 — Browser verification scope

- [ ] APPROVE
- [ ] MODIFY
- [ ] REJECT

**Proposed scope** (M2-02 §I.1, §L H21), registered before V1:

| Browser | Modes |
|---|---|
| Chrome | normal, Incognito |
| Samsung Internet | normal, Secret |
| Firefox | normal, Private |

Each at the default DNS setting of the installed version in the tested region, current store
versions, on the Tech Lead's target Samsung device. Approval includes consent to switch a browser's
DNS setting to its default for the test and to restore the as-found setting afterwards.

**Protocol** (the §I.1 default-setting rule, applied before each browser's first V3 run):

1. Record the as-found DNS setting.
2. Record the browser version and the region.
3. Establish the documented default for that version and region from a recorded source (browser
   documentation, release notes, source, or a default marked in its settings screen). Remembered or
   assumed defaults do not count.
4. If the as-found setting differs, run it first as a separate **characterization** row; it never
   counts for AC4 and never enters the claim.
5. Test the default configuration only with the consent recorded here.
6. Restore the as-found setting afterwards and record the restore with a screenshot.

If the default cannot be established, or no consent is recorded, that browser's rows are NOT MET and
the outcome is INCOMPLETE (§I.1 step 3). The claim is scoped to the tested region.

- **Needed before:** V1 (§E.1).
- **If modified:** the modified set is what is registered. Changing the set after results is a
  separate scope decision followed by re-evaluation, never a pass (§L H21, §I.3).
- **If rejected:** M2-02 defines no separate outcome. Without a recorded H21, gate G0 is incomplete,
  so V1 cannot start (§E.1) and AC9 cannot hold (§I.2).

**G0 status:** PENDING human sign-off on H18, H19a, H19b and H21 as written above.
No device setting has been changed by this draft. The Tech Lead's expressed support for
verification-only H18 must be recorded explicitly here together with the other G0 items.

---

## 4. Next verification phase — prepared, NOT executed

Frozen sequence (M2-02 §L "Sequence", H17):

```text
G0 human approval
        ↓
V0
        ↓
V1–V13
        ↓
T2 friction runs
        ↓
classified evidence report
        ↓
M2 production architecture decision
```

- V0 needs H19a only; V1 and every later device row need all of G0 (§E.1).
- The rows, oracle, safety rules and evidence rules are in M2-02 §E.2–§E.6. They are not restated.
- V14–V17 are not part of this phase. They need a separate, approved prototype task (§E.4, H17).
- **Status:** G0 is pending; no V-row and no friction run has been executed. No A8 device evidence
  exists. After G0 sign-off, V0 is first, followed by device rows on the named Samsung test device
  and the friction protocol. Results belong in issue #40/#41's evidence report.

Possible outcomes are exactly those defined in M2-02 §I.3; they are not redefined here:

- **PASS**
- **FAIL** (candidate; any of RJ1–RJ6)
- **NOT VERIFIABLE**
- **INCOMPLETE**

A scope change after a FAIL or INCOMPLETE is a separate Tech Lead decision followed by
re-evaluation, and is never a pass (§I.3).

---

## 5. Final M2-03 ADR — deferred

The final ADR is not written in this document.

A8 becomes the production filter architecture only if all of the following hold:

- the predefined M2-02 acceptance criteria pass (AC1–AC9, outcome PASS under §I.3);
- the required evidence exists as a committed, classified results report (§E.3, §E.5);
- H18 for production is explicitly approved by the Tech Lead (AC8);
- the Tech Lead records the final ADR.

Otherwise, the final human decision may be, among others:

- investigate A2;
- narrow the product claim;
- investigate another approved option;
- require more evidence;
- change direction;
- stop the approach.

This document does not choose among them.

When the final ADR is written, issue #22 requires: context, options considered, chosen decision, why,
trade-offs, consequences, rejected alternatives, and AI contribution as input, not decision owner.

---

## 6. M3 remains blocked

Nothing in this document authorizes:

- implementing A8, the observation core, `FilterActive` or any change to `ProtectionState`;
- deleting or refactoring M1 VPN or DNS code;
- Cloudflare integration, DNS configuration logic or browser detection;
- a backend, analytics or permission changes;
- M3 task decomposition as if an architecture were approved.

`filteringOperational` stays `false`. Issue #22's exit criteria (accepted ADR, M3 scope and
non-goals, verification strategy before code) remain open.

---

## AI contribution

AI (Claude) prepared the original package from the merged M2-01 and M2-02 documents. Codex
transcribed the existing M2-03A decision, prepared the G0 wording and checked the test URL's
currently served page against Cloudflare's documentation. The Tech Lead owns each G0 choice;
AI has checked none of its boxes, run no device test, and changed no device setting.

[m2-01]: m2-01-approved-threat-model.md
[m2-02]: m2-02-architecture-options.md

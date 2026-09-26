# M1-07 — Evidence Synthesis & Gate Close

> **Project:** Muslim Recovery Protection  
> **Milestone:** M1 — DNS Feasibility & Coverage Evidence  
> **Status:** **FINAL — M1 CLOSED**  
> **Date:** 2026-09-26  
> **Purpose:** Synthesize M1 evidence, separate facts from assumptions/unknowns, record the M1 close-out verification, and preserve the human M1 → M2 decision without silently selecting an architecture.

## 1. Executive outcome

M1 established useful evidence for the bounded DNS-only experiment and its limits. The prototype can intercept and block selected **standard plaintext DNS** lookups under the tested configuration while keeping `ProtectionState.Protected` unreachable.

The final M1 reliability blocker, **M-1 stale-underlying-network handling**, was fixed narrowly in PR #32 and merged. The fix does not implement automatic network handover; instead, when the captured underlying network becomes unusable or is superseded, the experimental VPN session stops truthfully.

GitHub Actions subsequently built the Android app and ran the required Gradle gate on commit `fd559324ac5d655a7f8fb4c93ba471b6b391d9b5`:

```text
./gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon
```

The workflow completed successfully and produced the debug APK used for the final Samsung verification. Relative to `main` at `4d1fe84cb9123a2edca6dec5f87eccd1b7372eae`, that tested commit adds documentation only; the Android implementation is therefore the same M-1 code already merged through PR #32.

The Tech Lead then executed the approved Samsung close-out checks. The project record classifies the physical-device outcomes as **HUMAN-REPORTED PASS**: P (Wi-Fi loss), M (mobile → Wi-Fi transition), S (steady state), R (Start → Stop → Start), PD (Private DNS regression), and X (false-stop/configuration matrix). During the guided P run, screenshots also demonstrated truthful stop behavior and successful DNS recovery after the VPN stopped. No `Protected` state was reported.

**Mechanical M1 gate result: `PASS`. M1 is CLOSED.**

This closes the experiment evidence milestone only. It does **not** approve a production filtering architecture or broaden the product claim. Those remain M2 decisions.
---

## 2. Evidence policy

This report distinguishes:

- **FACT** — directly supported by repository state, GitHub checks, code, or recorded human execution evidence.
- **HUMAN-REPORTED** — the Tech Lead reported the test outcome during the project, but a repository-native evidence artifact is not currently preserved.
- **INFERENCE** — a conclusion derived from verified facts but not directly measured.
- **UNKNOWN / MISSING EVIDENCE** — required evidence is not available.
- **KNOWN LIMITATION** — deliberately out of scope or explicitly deferred by D11.

No missing row is converted into PASS. No AI review is treated as objective validation.

---

## 3. Build and source provenance

### 3.1 Key commits

| Commit | Role | Evidence status |
|---|---|---|
| `a292b6d58e3b86490781a61a951d8b9944d6f87f` | Original PR #11 M1-05 head | Merged through PR #11 |
| `ddabe8a0a9a6adfcb542d3c1edcfdb47654651ee` | Mobile-fix candidate | Adds `setUnderlyingNetworks(arrayOf(underlyingNetwork))` and guarded `setMetered(false)` |
| `0f13df6a2eb5c56e166327a8d4b3eb3268a7adcc` | Device-test workflow | CI infrastructure only |
| `c6e3a30fa3e4b5ea306ee216aaf7679ec0d7795c` | Full verification gate | Changes workflow command to include assemble + tests + lint |
| `1492c108d81d529f8f9b2a617fcef01a8f8f3e89` | Historical CI-verified M1-05 candidate | Adds lint suppression/comment only in manifest; GitHub check passed |
| `41376538bde3b9da3e6faa04e4f5ecbfc5996dc6` | PR #32 merge commit | M-1 stale-underlying-network fix merged to `main` |
| `4d1fe84cb9123a2edca6dec5f87eccd1b7372eae` | `main` at final Samsung close-out | Contains PR #32 plus documentation-only M2 merges |
| `fd559324ac5d655a7f8fb4c93ba471b6b391d9b5` | Final Samsung close-out APK build | GitHub Actions PASS; differs from `4d1fe84` only by documentation |

### 3.2 Verified ancestry

`1492c108` is exactly three commits ahead of `ddabe8a`:

```text
ddabe8a
  ↓
0f13df6   add M1-05 device-test workflow
  ↓
c6e3a30   enforce assemble + tests + lint gate
  ↓
1492c108  suppress VPN FGS lint false positive
```

The changes after `ddabe8a` are workflow configuration plus a manifest lint suppression/comment. They do not change the DNS packet pipeline or filtering rules.

### 3.3 Provenance mismatch — recorded, not reconciled

PR #11 was merged from `a292b6d`, not `ddabe8a`.

Current `main` does not contain:

- `Builder.setUnderlyingNetworks(arrayOf(underlyingNetwork))`
- API-29+ `Builder.setMetered(false)`

Those are runtime VPN-builder behavior changes. Therefore the tested candidate cannot be declared behaviorally identical to current `main`.

PR #30 explored a reconciliation path and its CI passed, but the Tech Lead intentionally closed PR #30 **without merge**. This was a deliberate project decision: no source reconciliation is required for M1 close. The verified/device-tested evidence remains attached to `1492c108` as historical evidence only, and no claim is made that current `main` is the exact tested build.

**Status:** **RECORDED / ACCEPTED PROVENANCE LIMITATION — PR #30 CLOSED UNMERGED BY TECH LEAD DECISION.**

This historical provenance limitation does not invalidate the later M-1 close-out. PR #32 was merged onto current `main`, and the final APK used for M-1 verification was built from `fd55932`. A Git comparison from the PR #32 merge commit through the tested commit contains documentation changes only, so the Android implementation exercised in the final Samsung close-out matches the merged M-1 implementation.

---

## 4. M1-05 evidence synthesis

### 4.1 Automated verification

#### Scratch/JVM phase

Before real Android CI was available:

- 170 unit tests passed in the scratch JVM harness.
- 0 failures / 0 errors / 0 skipped.
- 60,000+ deterministic malformed/mutated parser inputs were exercised.
- Android VPN sources type-checked against API-36 framework classes with 0 reported errors/warnings.
- This was useful engineering evidence but was **not equivalent** to the real AGP build.

#### Real GitHub verification

At commit `1492c108`, GitHub Actions check:

**`Verify and build M1-05 device-test APK` → SUCCESS**

The configured command was:

```text
./gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon
```

This satisfies the required real toolchain build/test/lint gate for that exact commit.

### 4.2 Physical Samsung device evidence

The project record contains human-reported M1-05 results on the mobile-fix candidate line:

- VPN start/consent flow worked.
- State remained Degraded / experimental and never `Protected`.
- DNS proxy reported running.
- `example.org` resolved and forwarded.
- `example.com` was blocked.
- `www.example.com` was blocked.
- After Stop, the blocked domain resolved again.
- Ordinary Internet traffic continued to work.
- Repeated lifecycle start/stop and system disconnect were exercised.
- Private DNS refusal behavior was exercised.
- Wi-Fi/mobile handling was exercised.
- Screenshots reported `upstream failures=0` during the M1-05 acceptance pass.

**Evidence classification:** HUMAN-REPORTED.  
The repository does not currently contain a dedicated M1-05 execution report with screenshots/logcat references tied to one commit.

### 4.3 Truthful-state invariant

FACT:

- `filteringOperational = false` remains hardcoded in the public protection-signal construction.
- `ProtectionState.Protected` therefore remains intentionally unreachable in M1-05.
- Experimental DNS proxy state is separate from the public protection claim.

No evidence recovered for M1 indicates a false `Protected` state.

### 4.4 Static/adversarial review outcome

Track B adversarial review found:

- no BLOCKER;
- no HIGH finding;
- one MEDIUM reliability/state finding;
- several LOW hardening/documentation findings.

The main MEDIUM finding is preserved below.

---

## 5. Known defect / reliability finding carried from M1-05

### M-1 — captured underlying network can become stale

**FACT from code review:**

The experiment captures the Android `Network` at startup and later checks that captured network. It does not prove that the captured network remains the current default network if another network becomes preferred while the old one remains connected.

**Possible consequences:**

- DNS may continue using a stale/degraded network.
- repeated 2 s upstream timeouts may leave the internal proxy status saying `running` while allowed DNS fails;
- when `setUnderlyingNetworks(...)` + `setMetered(false)` are present, network accounting/meteredness can also become stale after handover.

**Severity:** MEDIUM for this bounded experiment.  
**Architecture decision required:** No.  
**Merge/close decision required:** Yes — fix narrowly or explicitly accept/document and test it.

The later background code review independently rediscovered the same network-handover gap.

**M1-07 fix status: VERIFIED / CLOSED FOR M1.** PR #32 merged the narrow D12 fix. Underlying-network invalidation stops the experimental VPN session truthfully. Automatic network handover is intentionally **not** implemented.

The fix covers a lost network or one about to be lost (`onLosing`); loss of `INTERNET` or `VALIDATED`; a network kept only in the background or suspended (API 28+), or blocked for the app (API 29+); loss of a usable DNS server; Private DNS becoming active; and, on API 31+, another physical network becoming the best match. Each is handled by the existing truthful stop path.

Final verification evidence:

- **FACT — GitHub Actions:** commit `fd55932` passed `clean assembleDebug testDebugUnitTest lintDebug --no-daemon` and produced the APK.
- **FACT — source equivalence for the tested Android code:** from PR #32 merge `41376538` through tested commit `fd55932`, later changes are documentation only.
- **HUMAN-REPORTED PASS — Samsung:** P, M, S, R, PD and X close-out checks passed.
- **Guided P evidence:** while running, blocked names did not resolve and the allowed control resolved; after Wi-Fi loss the experiment stopped with a truthful Error/unavailable state; after stop both blocked and allowed controls resolved again, demonstrating no persistent DNS black hole.
- `ProtectionState.Protected` was not observed.

The remaining limitation is explicit: the experiment stops and requires a later manual Start after an underlying-network transition; it does not perform automatic handover.

---

## 6. Other post-review observations

The later code review raised several additional items. They are not treated as M1 blockers without stronger evidence.

### EDNS OPT record validation

The review labeled the OPT `RDLENGTH` handling as a security issue. The current codec does bound the record to the supplied message by requiring:

```kotlin
start + OPT_FIXED_LENGTH + rdLength == end
```

So the available evidence does **not** establish an out-of-bounds read, unbounded allocation, or memory-safety defect.

The narrower valid conclusion is:

- EDNS OPT validation is intentionally minimal;
- version/options are not fully interpreted/validated;
- this remains protocol-hardening / compatibility work if the architecture later requires broader EDNS support.

### Lower-severity hardening candidates

Examples include:

- shutdown cancellation counted with upstream failures;
- broad defensive `RuntimeException` catches;
- per-packet UI counter publication;
- repeated network-fact Binder IPC;
- minor documentation drift;
- duplicate helpers/constants.

These require separate triage if the DNS architecture survives M2. They do not currently change the M1 mechanical gate.

---

## 7. M1-06 validation-gate status

### 7.1 What is definitely complete

FACT:

- The M1-06 runbook is merged in PR #12.
- H1/H2/H3 human decisions are recorded.
- The harmless domains are frozen:
  - blocked: `example.com`
  - blocked subdomain: `www.example.com`
  - allowed: `example.org`
- Objective classifications and stop conditions are defined.
- The runbook contains the approved gating browsers/modes and Private DNS conditions.

### 7.2 Recoverable execution evidence

The recovered row-by-row evidence is now preserved in:

`docs/m1-06-execution-results.md`

Confirmed recoverable result:

**G7 — Samsung Internet Normal — Private DNS Off → PASS**

- proxy remained running;
- after browser reset/retest, `example.com` was blocked;
- `blocked` increased from 0 to 75;
- `example.org` and `wikipedia.org` opened;
- an earlier apparent page load was treated as stale cache/pre-existing connection state and was not accepted as a bypass.

Partially recoverable result:

**G8 — Samsung Internet Secret — Private DNS Off → UNRESOLVED / INCONCLUSIVE**

- proxy remained running;
- `blocked = 0`;
- `forwarded` increased 237→261 and later 261→305;
- later `upstream failures = 0`;
- the decisive browser observation for `example.com` is not recoverable, so the row cannot honestly be classified PASS or BYPASS.

### 7.3 M1-06 execution completion

The Tech Lead subsequently confirmed that the **complete M1-06 runbook was executed** on the physical Samsung device using build `1492c108`.

The row-by-row recovery file now records:

- deterministic successful rows as PASS / UNSUPPORTED / BYPASS according to the runbook;
- rows whose exact timing/network branch is no longer reconstructable as **INCONCLUSIVE**;
- no row is silently converted to PASS merely from a generic success statement.

This satisfies the M1 evidence rule that required cases either have a classification or are explicitly recorded as inconclusive/unavailable.

**M1-06 execution status: COMPLETE (human-confirmed).**

---

## 8. What M1 has actually established

### Verified / supported

Within the tested standard-DNS experiment:

1. A local Android `VpnService` can be configured with a narrow DNS-only route instead of a default route.
2. The app can parse selected IPv4/UDP DNS queries locally and apply the existing deterministic RuleSet.
3. A direct lookup for the controlled blocked domain can be answered with a synthetic NXDOMAIN.
4. Allowed standard DNS can be forwarded through a protected, network-bound upstream socket.
5. The public protection model can truthfully remain Degraded while experimental interception is running.
6. The system can refuse/stop rather than knowingly downgrade an underlying network that reports Private DNS active.
7. The implementation can pass the real Android assemble/unit-test/lint gate on the verified candidate line.

### Not established

M1 has **not** established that:

- the device is generally protected from pornography;
- all browsers are covered;
- DoH is blocked;
- browser Secure DNS is blocked;
- strict or automatic Android Private DNS is compatible;
- TCP DNS is covered;
- IPv6 DNS transport is covered;
- CNAME/DNAME/SVCB targets are filtered;
- automatic network handover is implemented or supported; the M1 fix instead performs a truthful stop and requires a later manual Start;
- deliberate self-bypass is prevented;
- reboot/Always-on behavior is supported;
- the exact code currently on `main` is the same code that passed the recorded device and CI evidence.

---

## 9. Truthful product-claim boundary

Based on the evidence currently preserved, the strongest safe engineering statement is approximately:

> The prototype demonstrated blocking of selected domains when their lookup traversed the tested standard plaintext-DNS path on the verified Android experiment configuration.

The evidence does **not** support claims such as:

- “the device is protected from pornography”;
- “cannot be bypassed”;
- “works in every browser”;
- “covers encrypted DNS”;
- “full protection”;
- “filtering is operational” in the D8 public-state sense.

Final user-facing wording belongs to M2-01 after the evidence gaps are closed.

---

## 10. M1 exit-criteria check

| Exit criterion | Status | Reason |
|---|---|---|
| M1-05 reviewed build passed required verification | **PASS — historical tested build** | CI passed at `1492c108`; the historical PR #11 provenance mismatch remains explicitly documented rather than rewritten. |
| M1-06 approved fixed scope | **PASS** | PR #12 merged; H1–H3 and decision rules recorded. |
| Required M1-06 cases have evidence or explicit unavailable/inconclusive classification | **PASS** | Full execution human-confirmed; row classifications are preserved in `m1-06-execution-results.md`, with unreconstructable branches explicitly INCONCLUSIVE. |
| M-1 close-out implementation merged | **PASS** | PR #32 merged the narrow truthful-stop fix. |
| Required M-1 Gradle gate | **PASS** | GitHub Actions on `fd55932` completed assemble, unit tests and lint successfully. |
| Required M-1 Samsung close-out | **PASS — HUMAN-REPORTED** | P, M, S, R, PD and X reported PASS by the Tech Lead; guided P screenshots demonstrate the core truthful-stop/no-black-hole behavior. |
| Final M1 evidence report exists | **PASS** | This document is the final M1 report. |
| Stop conditions and limitations visible | **PASS** | M1-06 stop policy is preserved; automatic network handover remains explicitly unsupported. |
| Tech Lead M1 → M2 decision recorded | **PASS** | Continue to M2, recorded below. |

### Mechanical gate

**M1 status: CLOSED — PASS**

The result means the M1 evidence milestone is complete. It is not a production-architecture approval and does not widen the filtering claim.
---

## 11. Completed close-out actions

1. M-1 was fixed narrowly in PR #32 using truthful session stop rather than automatic handover.
2. The required Gradle gate passed on the exact APK build commit `fd55932`.
3. The Tech Lead completed the Samsung close-out matrix and reported P / M / S / R / PD / X as PASS.
4. The historical `1492c108` / PR #11 provenance mismatch remains recorded as a limitation; PR #30 stayed intentionally closed without merge.
5. The final M1 report now distinguishes repository facts, CI evidence and human-reported physical-device evidence.
6. The Tech Lead chose to continue into M2 without treating M1 as approval of a production DNS architecture.
---

## 12. Architecture alternatives prepared for M2

This section intentionally does **not** rank or choose an option.

If M1 closes, M2-02 may compare at least:

- a deliberately narrow DNS-based product claim;
- a revised Android protection architecture justified by observed bypasses;
- additional bounded investigation before selecting a protection core;
- a product/platform direction change;
- stopping the protection approach.

Every option must be evaluated for:

- coverage;
- Android API/permission implications;
- Play/distribution policy implications;
- privacy;
- security;
- testability;
- battery/performance;
- bypass surface;
- complexity;
- maintainability;
- truthful product wording.

No M2 option is authorized by this M1 report.

---

## 13. Human gate

The Tech Lead records exactly one M1 → M2 decision:

- [x] **Continue to M2**
- [ ] **More investigation required**
- [ ] **Narrow the product claim before M2**
- [ ] **Change product/platform direction**
- [ ] **Stop this approach**

### Tech Lead decision record

**Decision:** Continue to M2  
**Date:** 2026-09-26  
**Rationale:** M1 produced enough verified and explicitly classified evidence to close the DNS feasibility experiment, including a narrow verified fix for M-1. The decision authorizes M2 analysis and human architecture selection only; it does not approve any production filtering architecture or broaden the product claim.

---

## 14. AI contribution and verification boundary

AI contributed:

- implementation under bounded M1 task contracts;
- test generation and scratch verification;
- research and validation-runbook drafting;
- adversarial code review;
- this evidence-synthesis draft.

Human contribution includes:

- architecture/task approvals;
- physical-device execution;
- acceptance decisions;
- merge approvals;
- final M1 → M2 decision.

AI review is not treated as independent validation. Objective gates remain the build/tests/lint/device evidence, and the Tech Lead retains final responsibility.

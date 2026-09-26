# M1-07 — Evidence Synthesis & Gate Close

> **Project:** Muslim Recovery Protection  
> **Milestone:** M1 — DNS Feasibility & Coverage Evidence  
> **Status:** **FINAL — M1 CLOSED** (GitHub milestone closed 2026-09-26)\
> **Date:** 2026-09-25 (draft); close-out reconciled 2026-09-26\
> **Purpose:** Synthesize M1-05, M1-06 and M-1 close-out evidence, separate facts from human reports, inferences, unknowns and limitations, and record the Tech Lead's M1 → M2 decision without selecting an architecture.

## 1. Executive outcome

M1 has produced useful evidence that the DNS-only experiment can intercept and block selected **standard plaintext DNS** lookups under a controlled configuration while keeping `ProtectionState.Protected` unreachable.

**M1 is closed.** The last close-out blocker, the **M-1 stale-underlying-network reliability finding**, was fixed narrowly in PR #32 (D12) rather than accepted as a limitation. When the captured underlying network becomes unusable or is superseded, the experiment now stops truthfully. Automatic network handover is **not** implemented: the user starts the experiment again manually (KNOWN LIMITATION).

M-1 close-out evidence, detailed in §5:

- **FACT:** GitHub Actions passed `clean assembleDebug testDebugUnitTest lintDebug` on PR #32's head `5382a6c` and on `fd55932`. The Android code is identical at those commits and on current `main` (§3.4).
- **HUMAN-REPORTED:** the Tech Lead reported the Samsung close-out rows P, M, S, R, PD and X as PASS, using the APK built from `fd55932`.
- **UNKNOWN:** per-row device detail was not preserved in the repository.

The build-provenance mismatch is still documented as a fact: the physical-device M1-05 work was performed on the mobile-fix line rooted at `ddabe8a`, and the full GitHub verification gate later passed at `1492c108`, while PR #11 was merged from `a292b6d`. PR #30 was created to test a possible source reconciliation path, but the Tech Lead intentionally closed it **without merge**. M1 therefore keeps `1492c108` as historical tested-build evidence and does **not** claim that current `main` is behaviorally identical to that build.

M1-06 execution is human-confirmed complete. The repository preserves a row-by-row execution report; rows whose exact timing/network branch cannot be reconstructed are explicitly classified `INCONCLUSIVE` rather than guessed.

**Mechanical M1 gate result: all exit criteria met, with the qualifiers in §10. M1 is CLOSED.** The Tech Lead decided to continue to M2 (§13). (Draft state on 2026-09-25: `INCOMPLETE`, due to M-1 only.)

This closes the M1 evidence milestone only. It is not an architecture verdict: it approves no production filtering architecture and does not widen the product claim (§9, §12).

---

## 2. Evidence policy

This report distinguishes:

- **FACT** — directly supported by repository state, GitHub checks, code, or recorded human execution evidence.
- **HUMAN-REPORTED** — the Tech Lead reported the test outcome during the project, but a repository-native evidence artifact is not currently preserved.
- **INFERENCE** — a conclusion derived from verified facts but not directly measured.
- **UNKNOWN / MISSING EVIDENCE** — required evidence is not available.
- **KNOWN LIMITATION** — deliberately out of scope or explicitly deferred by D11 or D12.

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
| `1492c108d81d529f8f9b2a617fcef01a8f8f3e89` | CI-verified candidate | Adds lint suppression/comment only in manifest; GitHub check passed |
| `58fda1af260d0e38a64ac7ccff406afd839db7ed` | Current `main` at M1-07 start | Contains merged PR #11 and PR #12 |
| `5382a6cfc3ea254ee20bdc3770e04d20e63d41e2` | PR #32 head (M-1 fix) | GitHub check `Verify M1-07 and build debug APK` passed (Actions run 36221541661) |
| `41376538bde3b9da3e6faa04e4f5ecbfc5996dc6` | PR #32 squash merge on `main` | Same Android code as `5382a6c` |
| `fd559324ac5d655a7f8fb4c93ba471b6b391d9b5` | M-1 close-out APK build, as reported by the Tech Lead | Same GitHub check passed (Actions run 36234044196); only documentation changed after `4137653` |
| `6e3349b2fc5eb07d0fd0edad838dbd84134ac734` | `main` at this close-out reconciliation | Same Android code as `5382a6c` and `fd55932` |

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

Issue #15 (M1-05A), whose acceptance criterion required one exact commit across PR, checkout, APK, runbook and evidence, was closed as **not planned** on 2026-09-26 for the same reason: the historical state was not reconstructed retroactively.

### 3.4 M-1 close-out build — Android code identical to current `main`

This is separate from the historical limitation in §3.3, which it does not change.

| Item | Class | Source |
|---|---|---|
| The Android tree (`projects/04-muslim-recovery-protection/android`) is identical at `5382a6c`, `4137653`, `fd55932` and `6e3349b`; so is `.github/` | FACT | git tree comparison |
| Both CI runs were pull-request runs whose base was an ancestor of the head, so they built exactly the head's Android code | FACT | PR #32 and PR #35 base/head ancestry |
| After `4137653`, `fd55932` changes documentation only (M2-01, M2-02, M2-03, roadmap) | FACT | `git diff --stat 4137653 fd55932` |
| The run on `fd55932` uploaded the artifact `muslim-recovery-protection-m1-07-debug-apk` (retained until 2026-10-03) | FACT | Actions run 36234044196 |
| That artifact is the APK installed for the Samsung close-out | HUMAN-REPORTED | Tech Lead close-out record (#14; PR #36, which PR #37 reverted only to repair merge order). No install record or APK hash is preserved in the repository. |
| The close-out device evidence therefore applies to Android code identical to current `main` | INFERENCE | From the rows above |

Unlike the M1-05/M1-06 evidence (build `1492c108`), the M-1 close-out evidence is not affected by the §3.3 mismatch, provided the reported build identity is correct.

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

**M1-07 fix status: DONE FOR M1 — merged in PR #32 and verified as below.** The narrow fix (branch `fix/04-m1-07-m1-network-handover-mobile`, started from `main` at `8238193`) is recorded as D12 and in `architecture.md` (M1-07). Underlying-network invalidation stops the experimental VPN session. Automatic network handover is not implemented. The fix covers a lost network or one about to be lost (`onLosing`); loss of `INTERNET` or `VALIDATED`; a network kept only in the background or suspended (API 28+), or blocked for the app (API 29+); loss of a usable DNS server; Private DNS becoming active; and, on API 31+, another physical network becoming the best match. Each is handled by the existing truthful stop path. The fix was built on `main`; it makes no claim about `1492c108`.

| Close-out evidence | Class |
|---|---|
| The Tech Lead merged PR #32 on 2026-09-26 (squash commit `4137653`) | FACT |
| The required Gradle gate (`clean assembleDebug testDebugUnitTest lintDebug --no-daemon`) passed on PR #32's head `5382a6c` (Actions run 36221541661) and on `fd55932` (run 36234044196) | FACT |
| The Android code is identical at those commits and on current `main` (§3.4) | FACT |
| JVM unit tests for the new policy (`CapturedNetworkWatchTest`, `UnderlyingNetworkInvalidationLifecycleTest`, `UpstreamDnsSelectorTest`) ran inside that gate | FACT |
| The Android glue (monitor registration, the service's identity guard, teardown order) has no automated test | KNOWN LIMITATION (`architecture.md` M1-07) |
| Samsung close-out rows from PR #32's device procedure — P (captured Wi-Fi lost), M (mobile → Wi-Fi), S (steady state, no false stop), R (Start → Stop → Start), PD (Private DNS activated mid-session) and X (no false stop across configurations): **PASS** | HUMAN-REPORTED (#14, #18) |
| Guided P run: while running, the blocked control did not resolve and the allowed control did; after Wi-Fi loss the session stopped with a truthful error / unavailable state; afterwards both controls resolved, so there was no persistent DNS black hole | HUMAN-REPORTED (Tech Lead close-out record, PR #36); the screenshots are not preserved in the repository |
| `ProtectionState.Protected` was not observed | HUMAN-REPORTED; also guaranteed by construction (`filteringOperational` is hardcoded `false`) |
| Device model, Android / One UI version, stop messages, time-to-detect, logcat lines, which X configurations were available (for example X5) and whether optional P2 ran | UNKNOWN — not preserved |
| No automatic handover and no debounce: a transient loss of `VALIDATED` or a suspended cellular network stops the session, and the user restarts it manually | KNOWN LIMITATION (D12) |

The exit conditions PR #32 set for M-1 are met as far as the record shows: the Gradle gate passed, the Samsung device test passed (human-reported), review findings were reconciled in PR #32, and the Tech Lead merged it. Reading that merge as acceptance of the stricter Start behaviour PR #32 flagged for Tech Lead acceptance (a network that is not validated or not usable is refused) is an INFERENCE.

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
8. When the captured underlying network becomes unusable or is superseded, the experiment stops truthfully instead of reporting `running` while allowed DNS fails (M-1 fix: code and CI are FACT; device behaviour is HUMAN-REPORTED, §5).

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
- automatic network handover works — it is not implemented; the M-1 fix stops the session truthfully and the user restarts it manually (KNOWN LIMITATION, D12);
- deliberate self-bypass is prevented;
- reboot/Always-on behavior is supported;
- the M1-05/M1-06 device and CI evidence (build `1492c108`) applies to the code currently on `main` (§3.3). The M-1 close-out evidence is different: see §3.4.

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

Final user-facing wording is governed by M2-01, approved by the Tech Lead (PR #33).

---

## 10. M1 exit-criteria check

| Exit criterion | Status | Reason |
|---|---|---|
| M1-05 reviewed build passed required verification | **PASS — TESTED BUILD ONLY** | CI passed at `1492c108`; device evidence is attached to that build. Current `main` is not claimed identical; PR #30 was intentionally closed unmerged, #15 was closed as not planned, and the provenance difference is retained as a documented limitation. |
| M1-06 approved fixed scope | **PASS** | PR #12 merged; H1-H3 and decision rules recorded |
| Required M1-06 cases have evidence or explicit unavailable/inconclusive classification | **PASS** | Full execution human-confirmed; row classifications preserved in `m1-06-execution-results.md`, with unreconstructable branches explicitly INCONCLUSIVE |
| M-1 resolved (§11 item 1) | **PASS** | Fixed narrowly in PR #32 and merged, not accepted as a limitation; only automatic handover stays out of scope (D12) |
| Evidence invalidated by the M-1 change re-verified (§11 item 2) | **PASS — CI FACT + HUMAN-REPORTED DEVICE** | Gradle gate passed on the same Android code as `main`; Samsung close-out P/M/S/R/PD/X reported PASS (§5) |
| Final M1 evidence report exists | **PASS** | This document (final) |
| Stop conditions visible | **PASS** | S0/S2/S3 policy remains in M1-06 runbook; M1 limitations remain listed in §8 |
| Tech Lead M1 → M2 decision recorded | **PASS** | Continue to M2, recorded by the Tech Lead on #18 and #14 (§13) |

### Mechanical gate

**M1 status: CLOSED — every exit criterion is met, with the qualifiers above.** The GitHub milestone was closed on 2026-09-26. (Draft state on 2026-09-25: INCOMPLETE.)

This conclusion is driven by evidence completeness/provenance, not by an AI preference for or against DNS filtering. It approves no production architecture.

---

## 11. Close-out actions before the human M1 → M2 gate — completed

1. **Resolve M-1** before declaring the DNS experiment a stable M1 baseline:
   - narrow fix + targeted test, or
   - explicit Tech Lead acceptance as a known limitation.

   **Done:** narrow fix in PR #32 (D12), with JVM tests and the Samsung close-out (§5).

2. **Re-run only the evidence invalidated by an M-1 code change.**
   Do not rerun unrelated rows mechanically. For the M1-07 M-1 fix, these are the network-change
   lifecycle rows (L5, L6, L8) and a basic Start/block/allow check (startup now also refuses a
   network that is not validated or not usable). The Private DNS stop path (G5/G6 family) is also
   affected, because Private DNS activation is now also reported by the network callback.

   **Done through PR #32's targeted procedure:** the Samsung rows P, M, S, R, PD and X were run and
   reported PASS (HUMAN-REPORTED). No record shows L5, L6, L8 or the G5/G6 rows re-run verbatim on
   the new build. That P and M cover the network-change rows, P steps 3 and 8 the Start/block/allow
   check, and PD the Private DNS stop path is an INFERENCE from the procedure text. The M1-06 rows
   themselves remain evidence for `1492c108` only.

3. Update this report from **DRAFT / INCOMPLETE** to the final gate state.

   **Done:** this revision (2026-09-26).

**Recorded Tech Lead decision:** PR #30 was intentionally closed without merge. The `1492c108` build remains historical M1 verification evidence; current `main` must not inherit claims that were only verified on `1492c108`. Issue #15 was closed as not planned on the same basis.

---

## 12. Architecture alternatives prepared for M2

This section intentionally does **not** rank or choose an option.

Status (2026-09-26): M1 is closed, and M2-02 has since compared the architecture options
([`m2-02-architecture-options.md`](m2-02-architecture-options.md), PR #34). The list below is the
original M1 input to M2 and is kept unchanged.

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

After sections 10–11 are closed, the Tech Lead records exactly one decision:

- [x] **Continue to M2**
- [ ] **More investigation required**
- [ ] **Narrow the product claim before M2**
- [ ] **Change product/platform direction**
- [ ] **Stop this approach**

### Tech Lead decision record

**Decision:** Continue to M2\
**Date:** 2026-09-26\
**Recorded by:** the Tech Lead, in the closing comments on #18 and #14 and by closing the M1 milestone. Transcribed here from that record; AI made no decision.\
**Rationale (Tech Lead, #18):** "M1-07 synthesis and the final human gate have been completed: the M-1 fix is merged, the required CI gate passed on the tested close-out build, the Samsung close-out matrix was human-reported PASS, limitations remain explicit, and the Tech Lead chose to continue to M2."\
**Boundary:** continuing to M2 approves no production architecture and does not widen the product claim (§9, §12).

---

## 14. AI contribution and verification boundary

AI contributed:

- implementation under bounded M1 task contracts;
- test generation and scratch verification;
- research and validation-runbook drafting;
- adversarial code review;
- this evidence-synthesis draft, and its 2026-09-26 close-out reconciliation against the GitHub
  record (first recorded in PR #36, which PR #37 reverted only to repair merge order; re-created
  here on current `main`).

Human contribution includes:

- architecture/task approvals;
- physical-device execution, including the Samsung M-1 close-out;
- acceptance decisions;
- merge approvals;
- final M1 → M2 decision.

AI review is not treated as independent validation. Objective gates remain the build/tests/lint/device evidence, and the Tech Lead retains final responsibility.

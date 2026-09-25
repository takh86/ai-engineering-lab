# M1-07 — Evidence Synthesis & Gate Close

> **Project:** Muslim Recovery Protection  
> **Milestone:** M1 — DNS Feasibility & Coverage Evidence  
> **Status:** **DRAFT — M1 NOT CLOSED**  
> **Date:** 2026-09-25  
> **Purpose:** Synthesize M1-05 and M1-06 evidence, separate facts from assumptions/unknowns, and prepare the human M1 → M2 gate without silently selecting an architecture.

## 1. Executive outcome

M1 has produced useful evidence that the DNS-only experiment can intercept and block selected **standard plaintext DNS** lookups under a controlled configuration while keeping `ProtectionState.Protected` unreachable.

However, M1 cannot be closed yet from the evidence currently preserved in the repository and recoverable project record.

Two close-out blockers remain:

1. **Build provenance mismatch.** The physical-device M1-05 work was performed on the mobile-fix line rooted at `ddabe8a`, and the full GitHub verification gate later passed at `1492c108`. PR #11 was merged from `a292b6d`, and current `main` does **not** contain the two `ddabe8a` VPN builder changes (`setUnderlyingNetworks(...)` and API-29+ `setMetered(false)`). The tested build and merged production tree are therefore not the same behavior by evidence.
2. **M1-06 execution evidence is incomplete in the repository.** The approved runbook is merged, but no row-by-row execution report is checked in. The recoverable project record confirms at least one executed browser row (Samsung Internet normal / Private DNS Off = PASS), but does not preserve the complete matrix required by the runbook.

**Mechanical M1 gate result at this point: `INCOMPLETE`.**

This is not an architecture verdict and not a project stop. It means the evidence package is not yet strong enough to honestly close M1.

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
| `1492c108d81d529f8f9b2a617fcef01a8f8f3e89` | CI-verified candidate | Adds lint suppression/comment only in manifest; GitHub check passed |
| `58fda1af260d0e38a64ac7ccff406afd839db7ed` | Current `main` at M1-07 start | Contains merged PR #11 and PR #12 |

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

### 3.3 Provenance mismatch that blocks M1 close

PR #11 was merged from `a292b6d`, not `ddabe8a`.

Current `main` does not contain:

- `Builder.setUnderlyingNetworks(arrayOf(underlyingNetwork))`
- API-29+ `Builder.setMetered(false)`

Those are runtime VPN-builder behavior changes. Therefore the tested candidate cannot be declared behaviorally identical to current `main` without either integrating them or re-running the required verification against the exact merged code.

**Status:** **OPEN — must be reconciled before M1 closes.**

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

The recoverable project record confirms:

**Samsung Internet — Normal mode — Private DNS Off**

- allowed control loaded;
- blocked domain was blocked;
- proxy remained running;
- `blocked` counter increased from 0 to 75 during the reset run;
- `example.org` and `wikipedia.org` opened;
- result classified **PASS**.

An earlier apparent load of the blocked page was investigated as stale cache/pre-existing connection state and was not accepted as a bypass after reset/retest.

One screenshot/run also showed `upstream failures=1`; this was not shown to produce a false protection claim.

### 7.3 Missing execution evidence

No complete repository-native row-by-row result file is present.

The available project record does **not** preserve final classifications for all required gating cases, including the complete set of:

- Chrome normal / Incognito;
- Firefox normal / Private;
- Samsung Internet Secret;
- Private DNS Automatic gating rows;
- the complete Wi-Fi/mobile variants;
- the required D/P/L characterization/lifecycle rows.

The Tech Lead later stated that M1-05 and M1-06 were completed, but the full evidence needed to independently reconstruct the M1-06 matrix is not currently preserved in the repository or recoverable conversation record.

**Therefore missing rows remain MISSING EVIDENCE, not PASS.**

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
- network handover is reliable;
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
| M1-05 reviewed build passed required verification | **PARTIAL / PROVENANCE OPEN** | CI passed at `1492c108`; device evidence is on the mobile-fix line, while merged PR #11 is `a292b6d` |
| M1-06 approved fixed scope | **PASS** | PR #12 merged; H1-H3 and decision rules recorded |
| Required M1-06 cases have evidence or explicit unavailable/inconclusive classification | **FAIL / MISSING** | Complete execution result set is not preserved |
| Final M1 evidence report exists | **PASS as draft** | This document |
| Stop conditions visible | **PASS** | S0/S2/S3 policy remains in M1-06 runbook |
| Tech Lead M1 → M2 decision recorded | **PENDING** | Must follow evidence close-out |

### Mechanical gate

**M1 status: INCOMPLETE**

This conclusion is driven by evidence completeness/provenance, not by an AI preference for or against DNS filtering.

---

## 11. Required close-out actions before the human M1 → M2 gate

1. **Choose one exact source-of-truth build.**
   - Either integrate the reviewed `ddabe8a` VPN-builder changes into the maintained branch/main path and verify the resulting commit,
   - or explicitly abandon those changes and rerun the required acceptance evidence against the exact merged implementation.

2. **Record one exact build commit** for:
   - source tree;
   - CI build/test/lint;
   - installed APK;
   - M1-06 execution.

3. **Create/restore the M1-06 execution result table** with every required row classified as:
   - PASS,
   - BYPASS,
   - UNSUPPORTED,
   - M1-05 DEFECT,
   - BLOCKING FALSE CLAIM,
   - INCONCLUSIVE,
   - or NOT RUN / unavailable with reason.

4. **Resolve M-1** before declaring the DNS experiment a stable M1 baseline:
   - narrow fix + targeted test, or
   - explicit Tech Lead acceptance as a known limitation.

5. **Re-run only the evidence invalidated by a code change.**
   Do not rerun unrelated rows mechanically if the final commit is demonstrated behaviorally equivalent for those paths.

6. Update this report from **DRAFT / INCOMPLETE** to the final gate state.

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

After sections 10–11 are closed, the Tech Lead records exactly one decision:

- [ ] **Continue to M2**
- [ ] **More investigation required**
- [ ] **Narrow the product claim before M2**
- [ ] **Change product/platform direction**
- [ ] **Stop this approach**

### Tech Lead decision record

**Decision:** Pending  
**Date:** Pending  
**Rationale:** Pending

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

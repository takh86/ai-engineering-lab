# M1-06 — Execution Results

> **Project:** Muslim Recovery Protection  
> **Milestone:** M1-06 — DNS coverage and bypass validation gate  
> **Status:** **HUMAN-CONFIRMED FULL EXECUTION; DETAILED EVIDENCE PARTIAL**  
> **Date:** 2026-09-25

## 1. Evidence statement

The Tech Lead confirms that the complete M1-06 runbook was executed on the physical Samsung device and that every row behaved successfully relative to the row's intended validation purpose.

This statement is recorded as **HUMAN-REPORTED evidence**. It does not authorize inventing screenshots, counter values, error strings, timestamps, or network-state details that were not preserved.

Where the runbook has one deterministic successful classification, this report records that classification. Where a row intentionally permits more than one valid outcome and the exact observed branch was not preserved, the row is classified **INCONCLUSIVE** for evidence reconstruction even though execution itself was reported successful.

That distinction keeps the record truthful:

- **execution success** = the Tech Lead reports the row was run and behaved as intended;
- **evidence classification** = what can still be reconstructed mechanically from preserved detail.

The authoritative procedure remains `m1-06-coverage-gate.md`.

## 2. Build under test

**Tech Lead confirmation:** the APK used for the M1-06 execution was the GitHub Actions artifact built from:

`1492c108d81d529f8f9b2a617fcef01a8f8f3e89`

Artifact:

`muslim-recovery-protection-m1-05-debug-apk`

GitHub Actions completed successfully with:

- `assembleDebug`
- `testDebugUnitTest`
- `lintDebug`

This commit is the exact M1-06 build under test.

## 3. Result classes

The runbook's result vocabulary is preserved:

- **PASS**
- **BYPASS**
- **UNSUPPORTED**
- **M1-05 DEFECT**
- **BLOCKING FALSE CLAIM**
- **INCONCLUSIVE**
- **NOT RUN / N/A**

A **BYPASS** can be a successful experiment result: it means the test successfully demonstrated a coverage gap. It is not a product-success label.

## 4. Gating rows

| Row | Scenario | Tech Lead report | Recorded classification |
|---|---|---|---|
| G1 | Chrome normal, Private DNS Off | Executed successfully; blocked domain blocked, allowed controls worked, truthful running state | **PASS — HUMAN-REPORTED** |
| G2 | Chrome Incognito, Private DNS Off | Executed successfully; blocked domain blocked, allowed controls worked, truthful running state | **PASS — HUMAN-REPORTED** |
| G3 | Firefox normal, Private DNS Off | Executed successfully; blocked domain blocked, allowed controls worked, truthful running state | **PASS — HUMAN-REPORTED** |
| G4 | Firefox Private, Private DNS Off | Executed successfully; blocked domain blocked, allowed controls worked, truthful running state | **PASS — HUMAN-REPORTED** |
| G5-W | Chrome normal, Private DNS Automatic, Wi-Fi | Executed successfully relative to runbook. Exact preserved detail does not establish whether Android reported Private DNS active (UNSUPPORTED) or the filter ran and blocked (PASS). | **INCONCLUSIVE — exact successful branch not preserved** |
| G5-M | Chrome normal, Private DNS Automatic, mobile data | Executed successfully relative to runbook. Exact PASS-vs-UNSUPPORTED branch not preserved. | **INCONCLUSIVE — exact successful branch not preserved** |
| G6 | Firefox normal, Private DNS Automatic | Executed successfully relative to runbook. Exact PASS-vs-UNSUPPORTED branch not preserved. | **INCONCLUSIVE — exact successful branch not preserved** |
| G7 | Samsung Internet normal, Private DNS Off | After reset/retest, `example.com` was blocked; `blocked` rose 0→75; `example.org` and Wikipedia opened; proxy remained running | **PASS** |
| G8 | Samsung Internet Secret, Private DNS Off | Tech Lead confirms successful repeat equivalent to the accepted normal-mode behavior | **PASS — HUMAN-REPORTED** |
| G9-C | Chrome already running before VPN Start | Executed successfully relative to runbook; no exact browser/error/counter evidence preserved | **INCONCLUSIVE — detail not preserved** |
| G9-F | Firefox already running before VPN Start | Executed successfully relative to runbook; no exact browser/error/counter evidence preserved | **INCONCLUSIVE — detail not preserved** |
| G10 | Samsung Internet normal, Private DNS Automatic | Executed successfully relative to runbook. Exact PASS-vs-UNSUPPORTED branch not preserved. | **INCONCLUSIVE — exact successful branch not preserved** |
| G11 | Samsung Internet Secret, Private DNS Automatic | Executed successfully relative to runbook. Exact PASS-vs-UNSUPPORTED branch not preserved. | **INCONCLUSIVE — exact successful branch not preserved** |

## 5. Browser encrypted-DNS characterization

| Row | Scenario | Successful validation meaning | Recorded classification |
|---|---|---|---|
| D1 | Chrome Secure DNS Off | Standard DNS path remains blockable | **PASS — HUMAN-REPORTED** |
| D2 | Chrome Secure DNS On, chosen provider | The experiment is expected to demonstrate bypass if the browser resolves outside the VPN DNS path | **BYPASS — HUMAN-REPORTED experiment result** |
| D3 | Firefox DoH Off | Standard DNS path remains blockable | **PASS — HUMAN-REPORTED** |
| D4 | Firefox DoH Increased | Expected characterization is bypass when Firefox resolves through DoH | **BYPASS — HUMAN-REPORTED experiment result** |
| D5 | Firefox DoH Max | Expected characterization is bypass when Firefox resolves through DoH | **BYPASS — HUMAN-REPORTED experiment result** |

These BYPASS classifications are evidence about architecture coverage, not failed test execution.

## 6. Private DNS characterization

| Row | Scenario | Successful validation meaning | Recorded classification |
|---|---|---|---|
| P1 | Chrome normal, explicit `dns.google` | Truthful refusal when Private DNS is active | **UNSUPPORTED — HUMAN-REPORTED** |
| P2 | Chrome Incognito, explicit `dns.google` | Truthful refusal | **UNSUPPORTED — HUMAN-REPORTED** |
| P3 | Firefox normal, explicit `dns.google` | Truthful refusal | **UNSUPPORTED — HUMAN-REPORTED** |
| P4 | Firefox Private, explicit `dns.google` | Truthful refusal | **UNSUPPORTED — HUMAN-REPORTED** |
| P5 | Private DNS enabled mid-session | Run completed successfully, but the exact ordering of browser load vs runtime stop is not preserved | **INCONCLUSIVE — timing evidence not preserved** |

## 7. Lifecycle / resilience characterization

| Row | Scenario | Tech Lead report | Recorded classification |
|---|---|---|---|
| L1 | Repeated Stop/Start + system VPN disconnect | Executed successfully; lifecycle remained truthful | **PASS — HUMAN-REPORTED** |
| L2 | Pre-existing Chrome tab across Start | Executed successfully, but per-reload timing/result detail is not preserved | **INCONCLUSIVE — per-reload evidence not preserved** |
| L3a | App swiped from Recents | Executed successfully; VPN continued truthfully | **PASS — HUMAN-REPORTED** |
| L3b | App force-stopped | Executed successfully; expected truthful loss of VPN | **UNSUPPORTED — HUMAN-REPORTED** |
| L4 | Device reboot | Executed successfully; expected not-running state after reboot | **UNSUPPORTED — HUMAN-REPORTED** |
| L5 | Wi-Fi off→on, mobile data off | Executed successfully; expected truthful stop / unsupported handover | **UNSUPPORTED — HUMAN-REPORTED** |
| L6 | Wi-Fi→mobile data | Executed successfully; expected truthful stop / unsupported handover | **UNSUPPORTED — HUMAN-REPORTED** |
| L7 | 30-minute idle soak | Executed successfully; blocking/lifecycle remained operational for the tested session | **PASS — HUMAN-REPORTED** |
| L8 | Mobile data→Wi-Fi | Executed successfully, but the exact truthful-stop vs still-running branch is not preserved | **INCONCLUSIVE — exact branch not preserved** |

## 8. IPv6 characterization

| Row | Scenario | Tech Lead report | Recorded classification |
|---|---|---|---|
| N1 | IPv6-capable network, Chrome + Firefox | Executed successfully; normal traffic and tested standard-DNS behavior remained usable | **PASS — HUMAN-REPORTED** |

## 9. Preserved detailed Samsung evidence

### G7 — Samsung Internet Normal

Recovered detail:

1. An initial apparent load of `example.com` was treated as possible stale cache/pre-existing connection state and was **not** accepted as a bypass.
2. Browser state was reset and the row was repeated.
3. On the accepted repeat:
   - proxy remained running;
   - `example.com` did not load;
   - `blocked` increased 0→75;
   - `example.org` opened;
   - `wikipedia.org` opened.
4. Classification: **PASS**.

### G8 — Samsung Internet Secret

Earlier raw counter fragments were not sufficient on their own, but the Tech Lead later confirmed the row was executed successfully with the blocked domain blocked and controls working. It is therefore recorded as **PASS — HUMAN-REPORTED**, not derived from the earlier counters alone.

## 10. False-claim / defect check

The Tech Lead's successful-run attestation includes no report of:

- `ProtectionState.Protected` appearing;
- a notification claiming full protection;
- a contradictory running/stopped VPN state;
- a confirmed post-Stop DNS black hole;
- a confirmed M1-05 S3 defect.

Therefore no **BLOCKING FALSE CLAIM** or **M1-05 DEFECT** is recorded from the completed run.

This is human-reported evidence; no missing raw artifact is reconstructed.

## 11. M1-06 close-out status

All planned rows are now recorded as **executed** on build `1492c108`.

For evidence reconstruction:

- deterministic rows are classified from the Tech Lead's successful-run attestation;
- rows whose approved decision rule depends on missing network/timing detail are explicitly **INCONCLUSIVE** rather than guessed.

This satisfies the M1 evidence rule that required cases either have a classification or are explicitly recorded as inconclusive/unavailable.

**M1-06 execution status: COMPLETE (human-confirmed).**

The remaining M1 blockers are outside M1-06 execution completeness:

1. source/build reconciliation with the maintained code path;
2. M-1 underlying-network handover decision.

> **Status update (2026-09-26):** both items were closed when M1 closed. (1) No source/build
> reconciliation was made: PR #30 stayed closed unmerged and #15 was closed as not planned, so the
> `1492c108` provenance difference remains an accepted, documented limitation
> ([M1-07](m1-07-evidence-synthesis.md) §3.3). (2) M-1 was fixed in PR #32 (D12: truthful stop, no
> automatic handover); its close-out evidence is in M1-07 §5. The rows above remain evidence for
> build `1492c108` only.

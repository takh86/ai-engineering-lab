# M1-06 — Recovered Execution Results

> **Project:** Muslim Recovery Protection  
> **Milestone:** M1-06 — DNS coverage and bypass validation gate  
> **Status:** **HUMAN-CONFIRMED EXECUTION COMPLETE; ROW CLASSIFICATION PARTIALLY RECOVERED**  
> **Date recovered:** 2026-09-25

## 1. Purpose

This file preserves the M1-06 execution evidence that can be recovered from the project conversation record.

It is intentionally conservative:

- no missing row is converted into PASS;
- no planned runbook step is treated as executed;
- no AI inference is treated as device evidence;
- where only counters are known but the browser outcome is missing, the row remains unresolved.

The authoritative runbook remains `m1-06-coverage-gate.md`.

## 2. Build under test

**Tech Lead confirmation (2026-09-25):** the APK currently installed on the physical Samsung device is the GitHub Actions artifact built from:

`1492c108d81d529f8f9b2a617fcef01a8f8f3e89`

Artifact: `muslim-recovery-protection-m1-05-debug-apk`

The corresponding GitHub Actions run completed successfully with:

- `assembleDebug`
- `testDebugUnitTest`
- `lintDebug`

This commit is now the exact build under test for the remaining M1-06 execution rows.

## 2. Evidence classes

- **HUMAN-OBSERVED** — the user supplied screenshots or reported the observed device/browser behavior during execution.
- **DERIVED CLASSIFICATION** — classification follows directly from the approved M1-06 rule using the recorded observation.
- **MISSING** — no final observation is recoverable.
- **UNRESOLVED** — some evidence exists, but not enough to classify the row mechanically.

## 3. Human confirmation of full execution

**Tech Lead confirmation (2026-09-25):** all remaining M1-06 rows were executed on the physical Samsung device using build `1492c108d81d529f8f9b2a617fcef01a8f8f3e89`, and the user reports that the tests succeeded as expected.

This is recorded as **HUMAN-REPORTED execution evidence**. It establishes that the rows were run, but for rows whose runbook has more than one valid outcome (for example PASS vs UNSUPPORTED depending on Private DNS state, or BYPASS vs UNSUPPORTED based on timing), the exact mechanical classification still requires the observed row detail. The report must not invent those details.

## 4. Recovered / classifiable rows

| Row | Browser / mode | Private DNS | Network | Recovered evidence | Classification |
|---|---|---|---|---|---|
| G7 | Samsung Internet — Normal | Off | Wi-Fi / normal test network | After browser reset/cache clearing, `example.com` was blocked while the proxy remained running. `blocked` increased from 0 to 75. `example.org` and `wikipedia.org` opened. An earlier apparent load of `example.com` was not accepted after the reset/retest. | **PASS** |
| G8 | Samsung Internet — Secret | Off | Wi-Fi / normal test network | Earlier counters alone were inconclusive. The Tech Lead later confirmed the row was actually executed successfully like the Samsung normal-mode row: blocked domain did not load, allowed controls worked, and the proxy remained truthful. | **PASS (HUMAN-REPORTED)** |
| G1 | Chrome — Normal | Off | Wi-Fi / normal test network | Tech Lead confirms executed successfully with the same expected behavior as the accepted Samsung normal-mode control: blocked domain blocked, allowed controls worked, truthful running state. | **PASS (HUMAN-REPORTED)** |
| G2 | Chrome — Incognito | Off | Wi-Fi / normal test network | Tech Lead confirms executed successfully with blocked domain blocked, allowed controls working, and truthful running state. | **PASS (HUMAN-REPORTED)** |
| G3 | Firefox — Normal | Off | Wi-Fi / normal test network | Tech Lead confirms executed successfully with blocked domain blocked, allowed controls working, and truthful running state. | **PASS (HUMAN-REPORTED)** |
| G4 | Firefox — Private | Off | Wi-Fi / normal test network | Tech Lead confirms executed successfully with blocked domain blocked, allowed controls working, and truthful running state. | **PASS (HUMAN-REPORTED)** |
| G10 | Samsung Internet — Normal | Automatic | — | Approved as gating scope, but no final execution result recoverable. | **MISSING** |
| G11 | Samsung Internet — Secret | Automatic | — | Approved as gating scope, but no final execution result recoverable. | **MISSING** |
| P1–P5 | Explicit Private DNS hostname `dns.google` characterization | hostname | — | M1-05 human testing established truthful refusal/stop behavior for Private DNS, but the complete M1-06 P-row evidence/classification set is not recoverable. | **MISSING as M1-06 row evidence** |

## 5. Samsung Internet Normal — G7 detail

The recovered execution sequence is:

1. Samsung Internet initially appeared able to open `example.com` while the VPN was visible.
2. That observation was treated as potentially contaminated by cache or a pre-existing connection and was **not** accepted as a bypass.
3. The browser state was reset / cache-cleared and the row was repeated.
4. On the repeat:
   - proxy status remained running;
   - `example.com` failed to load;
   - the blocked counter moved from 0 to 75;
   - `example.org` opened;
   - `wikipedia.org` opened.
5. Under the approved decision rule, this is **PASS**.

One earlier run showed `upstream failures=1`; the accepted G7 repeat did not establish a false protection claim from that counter.

## 6. Samsung Internet Secret — G8 detail

Recovered evidence:

- proxy running;
- `blocked = 0`;
- `forwarded` 237→261;
- follow-up `forwarded` 261→305;
- later `upstream failures = 0`.

The decisive browser observation — whether `example.com` actually opened or failed — is missing from the recoverable record.

Therefore:

- it cannot be classified BYPASS merely from forwarding counters;
- it cannot be classified PASS because the blocked counter did not show the required blocking evidence;
- the row remains **UNRESOLVED / INCONCLUSIVE**.

## 7. Classification gaps that still need exact observed detail

Execution completeness is now human-confirmed, but several special rows cannot be mechanically classified from the phrase “succeeded as expected” alone because the runbook deliberately allows different correct outcomes.

Exact observed detail is still needed for:

- **G5-W / G5-M / G6 / G10 / G11 — Private DNS Automatic:** PASS if the filter ran and blocked; UNSUPPORTED if Android reported Private DNS active and the experiment truthfully refused.
- **D2 / D4 / D5 — explicit browser encrypted DNS:** the expected experiment result may be BYPASS; “success” cannot be rewritten as PASS.
- **L2 — pre-existing browser state:** individual reloads may be BYPASS even if the final fresh SBA passes.
- **L8 — mobile-data → Wi-Fi handover:** PASS/UNSUPPORTED/BYPASS depends on whether the experiment stayed running, stopped truthfully, or kept running while the blocked name resolved.
- **P5 — Private DNS enabled mid-session:** UNSUPPORTED if the experiment stopped before the blocked page loaded; BYPASS if the page completed first; INCONCLUSIVE if ordering cannot be proven.

The following rows are still recorded as executed but await exact classification detail: G5-W, G5-M, G6, G9-C, G9-F, G10, G11, D1–D5, N1, L1–L8, P1–P5.

No row is converted to PASS merely because the overall run was described as successful.

## 8. Close-out requirement

To close M1 honestly, one of the following must happen:

1. recover the missing screenshots/notes/logcat and classify the remaining rows mechanically; or
2. rerun only the missing required rows against one exact reviewed build commit.

Until then, the M1-06 evidence set remains **INCOMPLETE**.

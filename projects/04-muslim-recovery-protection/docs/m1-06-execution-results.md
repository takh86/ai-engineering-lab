# M1-06 — Recovered Execution Results

> **Project:** Muslim Recovery Protection  
> **Milestone:** M1-06 — DNS coverage and bypass validation gate  
> **Status:** **PARTIAL / RECOVERED FROM PROJECT RECORD — NOT A COMPLETE EXECUTION LOG**  
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

## 3. Recovered rows

| Row | Browser / mode | Private DNS | Network | Recovered evidence | Classification |
|---|---|---|---|---|---|
| G7 | Samsung Internet — Normal | Off | Wi-Fi / normal test network | After browser reset/cache clearing, `example.com` was blocked while the proxy remained running. `blocked` increased from 0 to 75. `example.org` and `wikipedia.org` opened. An earlier apparent load of `example.com` was not accepted after the reset/retest. | **PASS** |
| G8 | Samsung Internet — Secret | Off | Wi-Fi / normal test network | Proxy remained running. Recovered counters show `blocked = 0`; `forwarded` moved 237→261 and later 261→305; upstream failures later showed 0. The final browser outcome for `example.com` is not recoverable. | **UNRESOLVED / INCONCLUSIVE** |
| Chrome normal | Chrome — Normal | Off | — | No final execution result recoverable. | **MISSING** |
| Chrome Incognito | Chrome — Incognito | Off | — | No final execution result recoverable. | **MISSING** |
| Firefox normal | Firefox — Normal | Off | — | No final execution result recoverable. | **MISSING** |
| Firefox Private | Firefox — Private | Off | — | No final execution result recoverable. | **MISSING** |
| G10 | Samsung Internet — Normal | Automatic | — | Approved as gating scope, but no final execution result recoverable. | **MISSING** |
| G11 | Samsung Internet — Secret | Automatic | — | Approved as gating scope, but no final execution result recoverable. | **MISSING** |
| P1–P5 | Explicit Private DNS hostname `dns.google` characterization | hostname | — | M1-05 human testing established truthful refusal/stop behavior for Private DNS, but the complete M1-06 P-row evidence/classification set is not recoverable. | **MISSING as M1-06 row evidence** |

## 4. Samsung Internet Normal — G7 detail

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

## 5. Samsung Internet Secret — G8 detail

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

## 6. What this file does not prove

This recovery file does **not** prove completion of the M1-06 matrix.

No complete final evidence is recoverable for all required browser/mode combinations, Private DNS Automatic gating rows, lifecycle/characterization rows, or explicit Private DNS hostname rows.

Accordingly, M1-06 cannot be reconstructed as complete from the preserved project record alone.

## 7. Close-out requirement

To close M1 honestly, one of the following must happen:

1. recover the missing screenshots/notes/logcat and classify the remaining rows mechanically; or
2. rerun only the missing required rows against one exact reviewed build commit.

Until then, the M1-06 evidence set remains **INCOMPLETE**.

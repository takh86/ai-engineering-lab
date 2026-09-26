# M2-03B — A8 Verification Runbook (V0–V13)

> **Status: PREPARED — NOT EXECUTED. G0, result/privacy mappings, Q-readings and C-choice rules are frozen; execution still waits for final review and row-specific environment evidence.**
>
> **Project:** Muslim Recovery Protection\
> **Milestone:** M2 — Architecture & Truthful Product Claim\
> **Task:** M2-03B — execute the A8 verification matrix V0–V13 ([issue #40](https://github.com/takh86/ai-engineering-lab/issues/40)); this file prepares the procedure only\
> **Date prepared:** 2026-09-26\
> **Nature:** an execution procedure prepared by AI for the Tech Lead. It records no decision, runs
> no test, and changes no device, service or repository setting. Every checkbox is empty. Only the
> Tech Lead fills them in.

This runbook turns rows V0–V13 of [M2-02][m2-02] §E.4 into step-by-step procedures. It does not
define or change any test criterion. M2-02 is authoritative for:

- the V0–V13 definitions;
- the oracle rules (§E.2);
- the G0 prerequisites (§E.1);
- the browser default-setting rule (§I.1);
- evidence classification (§E.5);
- the PASS / FAIL / NOT VERIFIABLE / INCOMPLETE outcomes (§I.3).

If this runbook and M2-02 differ, M2-02 wins. Report any difference as a defect in this runbook.

Each row in §7 quotes its M2-02 definition word for word before its procedure, so the two can be
compared line by line. A step marked **runbook reading (Qn)** applies an M2-02 rule to a case that
M2-02 leaves open. Every reading is listed in §15, and the Tech Lead confirms or changes it before
the affected row. A reading never produces a PASS or COVERED that M2-02's own wording would not
produce.

Evidence classes (FACT, HUMAN-REPORTED, EXPECTATION, †, ASSUMPTION, UNKNOWN) are used as in M2-02.

---

## 1. Purpose

Produce the evidence M2-02 §I.2 needs from rows V0–V13 (V0 on a desktop, V1–V13 on the Tech Lead's
target Samsung device), so that the outcome can later be decided under §I.3 exactly as M2-02 defined it before any
result existed.

**This runbook covers:** V0–V13 only (issue #40).

**This runbook does not cover:**

- the §E.6 T2 friction runs. They are issue #41 (M2-03C), and AC6 needs them;
- V14–V17. They need a separate, approved prototype task (§E.4, H17);
- the H18 production decision (AC8), which belongs to the Tech Lead;
- the committed, classified results report. That is issue #40's deliverable and is written after
  execution.

**How to use it:** interactively, one row at a time.

1. Read the row's M2-02 definition and prerequisites.
2. Run the setup and action steps, capturing the listed evidence.
3. Classify the row with its rule only.
4. Restore the row's settings.
5. Fill in the row's **CHECKPOINT** block. Check the stop conditions (§12). The Tech Lead ticks
   *continue*, *pause* or *stop*.

Never start a row before the previous row's checkpoint is ticked.

**Who runs it:** the Tech Lead, by hand, on the physical Samsung device (M2-02 §E). AI may help
read evidence, but it records no classification as final and makes no decision.

---

## 2. Preconditions / G0 checklist

### 2.1 Gate G0 (M2-02 §E.1)

This runbook records none of these decisions. For each one, the executor confirms that the Tech
Lead's record exists and notes where it is. At preparation (2026-09-26), `main` recorded none of
H18, H19a, H19b or H21, and the G0 boxes in M2-03 §3 were empty. Check the current record, not
this note.

| Item | Needed before | M2-02 content | Record location (commit / link / date) | Record exists |
|---|---|---|---|---|
| M2-03A baseline adoption | G0 | A8 is a verification candidate only (M2-03 §2) | | [ ] |
| H19a — test names | V0 | Category name `nudity.testcategory.com`; informational `malware.testcategory.com`; controls `example.org` and `example.com` | | [ ] |
| H19b — browser navigation | V3, V4, V7, V11–V13 and the browser-level friction runs. **If it is not approved, no device row runs** (§E.1). | Whether browsers may open the category test page | | [ ] |
| H18 — verification scope | V1 and every later device row | The test device's DNS goes to the provider while the tests run (§G) | | [ ] |
| H21 — T1 browser set | V1 | Chrome, Samsung Internet and Firefox, each in normal and private mode, at the default DNS setting of the installed version in the tested region. Includes consent to switch a browser's DNS setting to its default for the test and to restore the as-found setting afterwards. | | [ ] |

- **Registered H21 set.** Copy the set exactly as the Tech Lead recorded it, including any
  MODIFY, into §5 and §11 **before V1**. The V3 rows are that set, and nothing else.
- **Record conditions.** If the H18 record (or any other G0 record) sets conditions on the test
  window, those conditions apply and take precedence over this runbook's defaults. Example
  conditions: limits on personal use of the device, or a required restore time.
- **AC9 evidence.** Write down the date or commit of the G0 record and the timestamp of the first
  device row (V1). AC9 needs G0 to be recorded before the first device row.

### 2.2 If a G0 item is rejected or missing

Each outcome below comes from M2-02 or M2-03. This runbook adds none.

| Situation | Consequence | Source |
|---|---|---|
| H19b not approved, and no validated equivalent recorded (U15) | No device row runs. The outcome is **NOT VERIFIABLE for the T1 claim — not accepted**. Each follow-up is a separate Tech Lead decision. | M2-02 §E.1, §I.3 |
| H18 rejected (verification) | A8 stops. Either A2 is reopened (§D.4), or the product ships recovery-only (H12). The choice is a separate decision. | M2-02 §G.1; M2-03 §3 |
| H19a rejected | V0 cannot run, so AC1 cannot be met. M2-02 defines no separate outcome; the follow-up is a Tech Lead decision. | M2-03 §3 |
| H21 rejected or not recorded | G0 is incomplete, so V1 cannot start and AC9 cannot hold | M2-03 §3 |
| Any G0 item missing when a row needs it | Do not start that row (stop condition S-G0, §12) | M2-02 §E.1 |

### 2.3 Environment preconditions

These are not decisions. They are conditions to check and record.

| # | Precondition | If not met |
|---|---|---|
| E1 | Physical Samsung device, the Tech Lead's target device, on Android 9 or later (API ≥ 28) | Below API 28 the filter layer is Unsupported (M2-02 §A.2 item 3), and A8 cannot be verified on this device. Stop (S-ENV). |
| E2 | No work profile, MDM or device owner on the device. Chrome disables Secure DNS on managed devices (M1-06 P4). | Stop and record. The Tech Lead decides (S-ENV). |
| E3 | No other VPN, DNS, ad-block or "security" app is active. No Always-on VPN and no "Block connections without VPN". | Remove it, or stop (S-ENV). V11 is the only exception. |
| E4 | A desktop with `adb` and USB debugging authorized on the device. `adb` is used for read-only commands and `ping`-based name resolution only (§E). | The rows that need `adb` (V1, V2, V5, V6, V8, V9, V11; see §6.3) cannot be decided. They are NOT MET, and the outcome is INCOMPLETE. |
| E5 | A desktop with `dig` for V0 (M2-02 names `dig A`) | See choice C10 (§2.4) |
| E6 | Networks: N-W (normal Wi-Fi) and N-M (cellular data). Optional: N-6 (IPv6-capable), N-853 (Wi-Fi whose router can block TCP 853) and N-CP (captive portal). | Rows needing a missing network are NOT RUN, with the reason (V9, V10) |
| E7 | A raw-evidence folder **outside the repository** (§10). Screen recorder and clock visible in the status bar. | Do not start |
| E8 | The Tech Lead has checked the category page once before deciding H19b (M2-02 §E.1; U1) | That is part of the H19b record |

### 2.4 Tech Lead choices M2-02 leaves open (not G0)

M2-02 names these actions but not their exact subject. The Tech Lead approved the remaining
selection rules on 2026-09-26 before execution. Where a concrete environment/app cannot be known
until the row is prepared (C4, C6), the approved rule below governs the selection and the exact
subject is recorded before that row begins, never after its result.

| ID | Choice | Needed before | M2-02 wording | Runbook proposal (not a decision) | Tech Lead record |
|---|---|---|---|---|---|
| C1 | Browser for V7, and for "part of V3" in V8, V9 and V11 | V7 | Not named | Chrome, normal mode, at its V3 T1 (default) DNS setting. Precedent: M1-06 row L2. | **APPROVED AS PROPOSED — 2026-09-26** |
| C2 | V4 Chrome provider | V4 | "a chosen non-filtering provider" | Cloudflare standard non-filtering Secure DNS, verification only; short window; harmless registered names/controls only; no personal browsing; restore Chrome's as-found Secure DNS setting. | **APPROVED — 2026-09-26** |
| C3 | V5 "another host" | V5 | "another host" | `one.one.one.one` (Cloudflare standard non-filtering DoT), verification only; short window; harmless registered names/controls only; no personal browsing/unrelated app use; restore the required Private DNS state afterwards. | **APPROVED — 2026-09-26** |
| C4 | V10 networks: router access for a TCP 853 rule; a captive-portal location | V10 | "if available" | Use the available test router only if it can apply an outbound TCP/853 block, and use a lawful captive-portal network available to the Tech Lead. Record the exact environments before V10. If one is unavailable, mark that sub-row NOT RUN; AC7 remains INCOMPLETE under the frozen V10 mapping. | **APPROVED AS PROPOSED — 2026-09-26** |
| C5 | V11 VPN app | V11 | "a common VPN app that has its own DNS" | Proton VPN Free, verification only; short window; harmless registered names/controls only; no personal browsing; record app version and server/country; disconnect and verify restore afterwards; remove if installed only for V11. | **APPROVED — 2026-09-26** |
| C6 | V12 apps: one that opens links in Custom Tabs, one with a WebView in-app browser, and how the URL reaches them | V12 | "A Custom Tabs flow and a WebView in-app browser" | Prefer apps already installed on the test device: one confirmed Custom Tabs path and one confirmed WebView path. Record the exact apps/versions and confirm the UI/path before V12. Do not transmit the test URL through WhatsApp, Telegram, email or another third-party messaging service. If suitable installed paths are unavailable, pause rather than silently install/select a replacement. | **APPROVED AS PROPOSED — 2026-09-26** |
| C7 | V13 browser | V13 | "for example Edge or Brave" | Microsoft Edge, fresh store install, Normal mode, default settings, characterization only. Do not sign in, sync or browse personally. Record version/default evidence and remove after V13 if installed only for this test. | **APPROVED AS PROPOSED — 2026-09-26** |
| C8 | Clearing browsing data in the browser reset (§6.3 BR) | V3 | Not in M2-02 | Do not clear browsing data. Use the runbook's force-stop/reset procedure instead; avoid deleting personal history. | **APPROVED AS PROPOSED — 2026-09-26** |
| C9 | Accept or amend the runbook readings Q1–Q23 (§15) | Before each affected row | — | See §15.1: decision-critical readings approved as written; procedural-only defaults retained; Q18/Q20 resolved by frozen mappings. | **COMPLETE — 2026-09-26** |
| C10 | Desktop tool for V0 if `dig` is unavailable | V0 | "`dig A`" | `dig` preferred. If unavailable, use `nslookup -type=A <name> <server>` as a recorded deviation; it shows the answer/NXDOMAIN but not the full response header. | **APPROVED AS PROPOSED — 2026-09-26** |

### 2.5 Pre-execution freeze required after review

The runbook is **not execution-ready** until the following result-affecting points are frozen in the
authoritative M2 decision record. They are not decided by this runbook.

#### Outcome / classification semantics

Before any affected row runs, the Tech Lead must record the rule for:

1. **V7 failure semantics** — whether a cold-start/persistence miss makes AC6 not met → INCOMPLETE,
   or has another predefined consequence.
2. **V8 failure semantics** — the exact mapping from each V8 result to AC5 and the overall outcome.
3. **V9 mapping** — how the row's PASS / FAIL observations map to the M2-02 AC6 classes
   COVERED / DISCLOSED / NOT RUN.
4. **"Part of V3" in V8 / V9 / V11** — whether a browser BYPASS there is treated as RJ3,
   an AC6 contradiction/reclassification, or another predefined outcome.
5. **V10 partial availability** — how AC7 is judged when only one of the optional network sub-rows
   can be executed.

These rules must be recorded **before** the first affected result is observed. The runbook must not
invent or select a favorable rule afterwards.

#### Privacy / trust scope outside H18

H18 verification consent covers only the provider under verification unless the Tech Lead records a
broader decision. The following proposed rows can introduce additional third-party data flows:

- **V4** — the selected non-filtering Chrome DoH provider;
- **V5-OTHER** — the selected alternative public Private-DNS host;
- **V11** — the selected VPN provider/operator.

Before those rows run, one of the following must be recorded for each external provider/data flow:

- explicit Tech Lead consent for the named provider and test purpose;
- a redesigned procedure that avoids the unapproved third party; or
- NOT RUN / deferred, with the consequence evaluated under the authoritative M2 decision rules.

**H18 must not be treated as blanket consent for unrelated DNS or VPN providers.**

#### Q-readings: decision-critical vs procedural

The Q1–Q23 readings are proposals, not twenty-three automatic human gates. Before execution, the
Tech Lead (or the authoritative M2 amendment) must classify each reading as one of:

- **DECISION-CRITICAL** — can change PASS / FAIL / coverage / privacy / claim scope. Freeze it
  before the affected result is observed.
- **PROCEDURAL-ONLY** — evidence handling or restoration mechanics that cannot improve a result,
  suppress a bypass, or widen a claim. It may remain a documented runbook default.

When there is doubt, treat the reading as DECISION-CRITICAL. The split itself is recorded before V0.

---

## 3. Device / environment record template

Fill this in once, before V0 or V1. Re-record any value that changes between sessions. All
commands are read-only.

```text
DEVICE / ENVIRONMENT RECORD
Recorded by / date / time zone:
Device model:                        (Settings → About phone; or adb shell getprop ro.product.model)
Android version / API level:         (adb shell getprop ro.build.version.release / ro.build.version.sdk)
One UI version:                      (Settings → About phone → Software information; screenshot)
Security patch level:                (adb shell getprop ro.build.version.security_patch)
Build number:
Region — device setting country:     (record the Settings path used)
Region — SIM / carrier country:
Region — Wi-Fi location country:
Work profile / MDM / device owner:   none / present (details)          → E2
Other VPN / DNS / ad-block apps:     none / present (names)            → E3
Always-on VPN / Block without VPN:   off / on                          → E3
adb version / desktop OS:
dig version (or substitute, C10):
Raw-evidence folder (outside repo):
Screen recorder available:           yes / no
G0 record reference (§2.1):
H21 registered set (copied verbatim):
Tech Lead choices C1–C10 (refs):
```

---

## 4. Network and Private DNS baseline

This section only reads. It changes no setting and sends no test lookup, and it is not a V-row.
Issue #40 lists this record as a precondition. The V2 baseline with Private DNS Off is a device
row, so it runs inside V2, after G0.

### 4.1 As-found Private DNS

1. Open *Settings → Connections → More connection settings → Private DNS*. Record the as-found
   mode (Off / Automatic / Private DNS provider hostname = …) and take a screenshot. This is the
   primary record. If the path differs on the device, record the path you used.
2. Optional, read-only (M1-06 precedent): `adb shell settings get global private_dns_mode` and
   `adb shell settings get global private_dns_specifier`. `null` means "never changed"; it does
   not show Samsung's actual default, so the screenshot remains the primary record.
3. This as-found value is what every session end restores (§6.5).

### 4.2 Network inventory

| Network | Used by | Type | Country | IPv6 (yes / no; source) | Resolver operator (router / ISP / carrier / named provider; no addresses) | Notes |
|---|---|---|---|---|---|---|
| N-D (desktop) | V0 | | | — | | Known DNS interception or filtering on this network? (Q5) |
| N-W | V1–V8, V11–V13 | Wi-Fi | | | | |
| N-M | V1, V2, V8 | Cellular | | | | Carrier content filter known? (Q7) |
| N-6 | V9 | | | yes (required) | | Can be N-W or N-M |
| N-853 | V10-853 | Wi-Fi | | | | Router allows an outbound TCP 853 rule? (C4) |
| N-CP | V10-CP | Wi-Fi | | | | Captive portal |

For each device network, with it active: run `adb shell dumpsys connectivity` and save the full
output in the raw folder. From that output, record these lines as printed, redacted:

- `LinkAddresses` and `Routes`, for IPv6: a global IPv6 address and an IPv6 default route;
- `DnsAddresses`, for the address family only;
- the Private DNS lines.

Field names vary by Android version. Redact every address, SSID and carrier account detail.

---

## 5. Browser inventory template

Fill in one block per browser in the registered H21 set, plus the V13 browser. This template holds
the inputs and outputs of the default-setting protocol (§8).

```text
BROWSER INVENTORY — <Chrome / Samsung Internet / Firefox / V13 browser>
Package:                        (com.android.chrome / com.sec.android.app.sbrowser / org.mozilla.firefox / …)
Installed version:              (preferred: adb shell dumpsys package <package> | findstr versionName
                                 fallback: Settings → Apps → <browser> → version shown at the bottom; screenshot)
Store update checked (date):    ("current store version at test time", M2-02 §I.1)
Region (device / network):      (copy from §3; if they differ, see Q12)
DNS setting path used:          (Chrome: ⋮ → Settings → Privacy and security → Use secure DNS
                                 Firefox: ⋮ → Settings → Privacy and security → DNS over HTTPS
                                 Samsung Internet: ≡ → Settings → Privacy; record whether any secure-DNS option exists)
As-found DNS setting:           (exact wording; screenshot ID)
Documented default:             (value)
Default source:                 (browser docs / release notes / source for this version / default marked in the
                                 settings screen: URL or screenshot ID, and the date read)
                                 Remembered or assumed defaults do not count.
                                 No DNS setting exposed → "installed state is the default"; recorded.
Default established:            yes / no  (no → this browser's T1 rows are NOT MET → INCOMPLETE)
As-found equals default:        yes / no
Characterization rows needed:   yes / no  (yes when as found ≠ default)
Consent to switch (H21 ref):    (for V13: see C7 / Q22)
Switched to default at:         (time; screenshot ID)
Restored to as-found at:        (time; screenshot ID; after every row that switched it)
```

Candidate default sources used in M1-06 (Chrome Help on Secure DNS; Mozilla Support on Firefox DoH
levels) were read in September 2025. They must be re-read for the installed version and date
before they count here.

---

## 6. Execution sequence

### 6.1 Order

```text
G0 recorded (§2.1)
  → §3, §4, §5 records (read-only)
  → V0 (desktop; needs H19a)
  → V1 → V2 → V3 → V4 → V5 → V6 → V7 → V8 → V9 → V10 → V11 → V12 → V13
  → per-row results in §11 → outcome worksheet (§13), completed only after the #41 friction runs and AC8
```

- The numeric order is the documented order (issue #40: "Run V1–V13 in the documented order").
- **V1 starts only after V0 is VALID.** Every later DNS result is read through the V0 oracle
  (§E.2).
- If a row's environment is unavailable when its turn comes (V9: no IPv6; V10: no special
  network), record NOT RUN with the reason and continue. A later run of that row is recorded as an
  order deviation, approved at its checkpoint.
- Suggested sessions:
  - **D** (desktop): V0.
  - **1** (home; Wi-Fi and cellular): V1–V9.
  - **2**: V10, V11–V13.

  Each session starts and ends as in §6.5.

### 6.2 One row at a time

1. **Before the row:** check its prerequisites, the G0 items it needs, and its Tech Lead choices
   (§2.4). Write the evidence IDs you will use (§10).
2. **Run** the setup and action steps exactly. Record any deviation as it happens.
3. **Classify** each run with the row's rule only. If a run is INCONCLUSIVE, record the extra run
   **before** running it (§6.4).
4. **Restore** as the row says. At the checkpoint, the device state must match the state the row
   says it leaves.
5. **Checkpoint:** fill in the row's block, update §11, and check §12. The Tech Lead ticks one
   box. Nothing continues without a tick.

### 6.3 Common procedures

`<ID>` is the run's evidence ID (§10). The commands are shown for Windows PowerShell; on
macOS or Linux, use `grep -i` in place of `Select-String`.

**PDNS-SET(value)** — change Private DNS by hand.
*Settings → Connections → More connection settings → Private DNS* → choose Off, Automatic, or
"Private DNS provider hostname" and type the host exactly → Save. Take a screenshot of the saved
state. Values used here:

- `family.cloudflare-dns.com` (the "provider host", M2-02 §A.2);
- Off;
- Automatic;
- the C3 host (V5 only).

**NET-RESET** (V2 only; runbook reading Q8) — turn the network under test off and on once.
For Wi-Fi, use the quick-panel toggle; for cellular, the mobile data toggle. Wait until it is
connected, plus 10 s. This starts a fresh resolver state for the network, so that a V2 lookup
cannot be served from an answer cached under the previous Private DNS mode.

**SYS-SIG** — the system signal (M2-02 V1 and V5 method; `adb` required).

```powershell
adb shell dumpsys connectivity > <RAW>\<ID>_dumpsys-conn.txt
Select-String -Path <RAW>\<ID>_dumpsys-conn.txt -Pattern "PrivateDns","default network"
adb shell dumpsys dnsresolver > <RAW>\<ID>_dumpsys-dnsres.txt
Select-String -Path <RAW>\<ID>_dumpsys-dnsres.txt -Pattern "Private DNS","family.cloudflare-dns.com","validat"
```

Record, as printed and redacted:

- which network is the active default network;
- that network's Private DNS lines: in use or not, the server name, and any validated
  private-DNS addresses;
- the `dnsresolver` validation status for the provider host's servers on that network.

Field names vary by Android version. If the patterns miss the lines, search the saved file by eye
and record what you used.

**DNS-CHECK** — the V2 method (M2-02: "`adb shell ping -c 1 <name>`; read only the resolved IPv4
(A) address"; `adb` required).

```powershell
adb shell ping -c 1 nudity.testcategory.com
adb shell ping -c 1 example.org
adb shell ping -c 1 example.com
```

Record only the first line of each, for example `PING <name> (<address>) …`, and read it with the
§E.2 oracle (A answers only). Ignore any replies: pinging `0.0.0.0` may be answered locally. The
command may take a few seconds when no reply comes.

| First line | Reading (M2-02 §E.2) |
|---|---|
| Category name → `0.0.0.0` | Filtered on this path |
| Category name → any address other than `0.0.0.0` | Not filtered on this path |
| Category name → `unknown host` or another error | Not the provider's documented signal → INCONCLUSIVE |
| A control → `unknown host` or another error | Environment failure → INCONCLUSIVE, never PASS |
| A control → an address other than `0.0.0.0` | The control resolves |

**SC — session check before a browser block** (information; runbook reading Q10). Take a Private
DNS screenshot and run DNS-CHECK.

- The expected pattern is: category name `0.0.0.0`, controls real. If so, continue.
- If the category name resolves to a real address while the host is shown and the controls
  resolve, stop the block (S-PATH, §12).
- If a control fails, fix connectivity and repeat SC. Browser runs start only after a clean SC.

**BR — browser reset** (before every browser run).

1. In the browser, close every tab of the mode under test.
2. *Settings → Apps → \<browser\> → Force stop → OK.* This ends the browser's in-memory DNS cache
   and open connections.
3. Do not clear browsing data unless the Tech Lead chose to (C8). Record which was done.

**BA — browser attempt** (V3 and every row that says "part of V3").

1. Open the browser in the row's mode, and record the path you used:
   - normal mode: open the browser from the launcher;
   - Chrome Incognito: ⋮ → New Incognito tab;
   - Samsung Internet Secret: Tabs → Turn on Secret mode;
   - Firefox Private: the private-browsing (mask) button.
2. Type exactly `https://nudity.testcategory.com/?a8=<id>` and go. Here `<id>` is the run ID in
   lower case; the query string identifies the run in the URL bar and avoids reuse of an
   HTTP-cached copy. **ASSUMPTION** (as in M1-06): the test page and the controls ignore the
   query string. Wait up to 15 s for a page or an error to settle.
3. Take a screenshot showing the URL bar and the page or error. Write down the **exact** error
   text. If anything other than a browser error page or Cloudflare's test notice appears, apply
   the unexpected-content rule (§9) at once.
4. Open a new tab in the same mode, and load `https://example.org/?a8=<id>` (the control). Take a
   screenshot.
5. The attempt outcome is one of:

| Attempt outcome | Definition |
|---|---|
| **BLOCKED** | The category name ends on a browser error page with no content from the test page, **and** the control loads in the same attempt |
| **LOADED** | Cloudflare's test page (any of its content) is shown for the category name |
| **INCONCLUSIVE** | Any of these: the control does not load; there is no network; the screenshot is missing or the URL bar is not visible; the URL bar shows a different URL from the one typed; or any other outcome, such as a blank page without an error |

Each row maps BLOCKED and LOADED to its own M2-02 classes. BLOCKED is M2-02 V3's "Error page with
no content; control loads". The exact error text is recorded, but it does not change the outcome
(Q10).

### 6.4 Run rules

- **H21 T1 rows (V3), exactly as M2-02 §I.1:**
  - each row runs twice;
  - a row is COVERED only if both runs are COVERED;
  - a BYPASS in either run makes the row BYPASS, whether reproduced or intermittent;
  - an INCONCLUSIVE run allows one extra run, recorded before it happens;
  - a row that is still not COVERED after that is NOT MET.
- **Other browser-level rows** (runbook reading Q1): V3 characterization rows, V4, V7, the
  browser parts of V8, V9 and V11, V12 and V13.
  - Each uses the same two-run procedure.
  - A LOADED outcome in either run is that row's bypass result.
- **DNS-level and system-signal rows** (runbook reading Q1): V0, V1, V2, V5, V6, V10, and the DNS
  parts of V8, V9 and V11. Each runs once.
- **Every row** (runbook reading Q2, from §E.5 "INCONCLUSIVE handling follow[s] §I.1"):
  - missing required evidence makes the run INCONCLUSIVE, never a pass;
  - an INCONCLUSIVE run allows one extra run, recorded before it happens;
  - a row still unresolved after the extra run is **NOT MET**. That feeds INCOMPLETE (§I.3) unless
    an RJ condition holds.
- **Never overwrite a run.** An extra run gets its own ID (R3). A failed or INCONCLUSIVE run stays
  in the record (issue #40: "without rewriting failed rows").

### 6.5 Session start and session end

**Session start (every device session after V1):**

1. Confirm that the G0 record is unchanged.
2. Confirm that the device is on N-W and that no VPN is active.
3. Record the current Private DNS setting.
4. PDNS-SET(`family.cloudflare-dns.com`), then SYS-SIG, then DNS-CHECK. The expected pattern is
   the V1 and V2 PASS pattern. If it differs, pause (S-PATH).

**Session end (always, including after a stop):**

1. Restore Private DNS to the §4.1 as-found value, and take a screenshot. H18 covers DNS to the
   provider "while the tests run".
2. Confirm that every browser DNS setting is at its as-found value (screenshots in §5).
3. Disconnect the V11 VPN and handle the V11 and V13 apps as chosen (C5, C7). Remove any V10
   router rule and forget the captive network.
4. Confirm connectivity: `example.org` loads in a browser.
5. Record the session-end time.

---

## 7. Row procedures V0–V13

### 7.1 V0 — Oracle validity (desktop)

> **M2-02 §E.4 V0 (verbatim).** Setup: Desktop, no device; after H19a. Action: `dig A` for the
> category name and the controls at `1.1.1.3` and at `1.1.1.1`; record `malware.testcategory.com`
> the same way. Expected: **Validity rests on the category name's A answer only.** It gets
> `0.0.0.0` at `1.1.1.3` and a real address at `1.1.1.1`, and the controls get real addresses at
> both (Cloudflare docs). AAAA is left to V9. The malware name's result is recorded but never
> affects validity (†: a community report says the malware-only tier may not block it). Result
> classes: Oracle VALID / INVALID.

**Goal:** show that the DNS-level oracle (§E.2) works before any device row. Feeds AC1, RJ1.

**Prerequisites:**

- H19a recorded;
- the §3 record exists;
- the desktop network (N-D) is recorded in §4.2;
- C10, if `dig` is unavailable.

**Setup:** none on any device. Use a desktop terminal. Record the time.

**Action:** run each of the following once, and save the full output as
`A8_V0_R1_DESK_<time>_dig.txt`.

```text
dig A nudity.testcategory.com @1.1.1.3
dig A nudity.testcategory.com @1.1.1.1
dig A example.org @1.1.1.3
dig A example.org @1.1.1.1
dig A example.com @1.1.1.3
dig A example.com @1.1.1.1
dig A malware.testcategory.com @1.1.1.3
dig A malware.testcategory.com @1.1.1.1
```

**Evidence to capture:**

- For each query: the `status:` line, the ANSWER section, the `SERVER:` line, and the timestamp.
- **Preferred:** full `dig` output.
- **Substitute** (C10): `nslookup -type=A <name> <server>`, recorded as a deviation. Limitation: it
  shows the answer and names NXDOMAIN, but not the full response header or the TTL.
- No screenshot-only fallback exists. V0 is a DNS answer.

**Expected result:** as quoted above.

**Classification rule:**

| Class | Condition |
|---|---|
| **VALID** | Category name A = `0.0.0.0` at `1.1.1.3` **and** an address other than `0.0.0.0` at `1.1.1.1`, **and** both controls get addresses other than `0.0.0.0` at both servers |
| **INVALID** (RJ1) | With both controls resolving at both servers: the category name gets an address other than `0.0.0.0` at `1.1.1.3` (not blocked by the family tier), **or** `0.0.0.0` at `1.1.1.1` (also blocked by the unfiltered resolver) |
| **INCONCLUSIVE** (§E.2; Q2) | A control fails at either server, or the category name gets NXDOMAIN, SERVFAIL or a timeout. One extra run, recorded before it runs. If it is still INCONCLUSIVE, V0 is NOT MET. |

- The malware name's answers are recorded as information and **never** affect the class.
- AAAA is not decided in V0; it is decided in V9.
- If INVALID appears on a network that may intercept DNS, record INVALID. The Tech Lead decides
  whether a repeat is run from another network; the repeat is recorded before it runs and never
  erases the first result (Q5).

**Restoration:** none.

```text
CHECKPOINT V0
Result:                VALID / INVALID / NOT MET        Extra run used: yes / no
Category @1.1.1.3 / @1.1.1.1:      ____ / ____
Controls @1.1.1.3 / @1.1.1.1:      example.org ____ / ____   example.com ____ / ____
Malware name (information only):   ____ / ____
Evidence IDs:
Stop condition:        none / S-RJ1 / S-ORACLE (§12)
Tech Lead:             [ ] continue to V1 (full G0 recorded, §2.1)   [ ] pause   [ ] stop
```

### 7.2 V1 — Mechanism active (Wi-Fi, then cellular)

> **M2-02 §E.4 V1 (verbatim).** Setup: Device: Wi-Fi, then cellular; Private DNS = provider host.
> Action: Settings screenshot; `dumpsys connectivity` Private DNS lines; `dumpsys dnsresolver`
> validation. Expected: Strict mode active with the provider host. Result classes: PASS / FAIL.

**Goal:** show that strict Private DNS with `family.cloudflare-dns.com` is active on Wi-Fi and on
cellular. Feeds AC2, RJ2.

**Prerequisites:**

- full G0 recorded (§2.1), with H19b approved;
- V0 VALID;
- §3, §4 and §5 filled in;
- the E1–E4 checks pass.

Write down this row's start time as the first device row (AC9).

**Setup:**

1. Connect to N-W with mobile data on. No VPN key icon.
2. PDNS-SET(`family.cloudflare-dns.com`), and take a screenshot (`V1-WIFI … settings`).
3. Wait 30 s. If any system notification about Private DNS appears, take a screenshot of it.

**Action:**

1. **V1-WIFI:** run SYS-SIG with N-W as the active default network.
2. Turn Wi-Fi off, and wait until mobile data is connected, plus 30 s.
3. **V1-CELL:** take a Private DNS screenshot, then run SYS-SIG with cellular as the active
   default network.
4. Turn Wi-Fi back on, and wait until N-W is connected.

**Evidence to capture:**

- **Required (M2-02):** the Settings screenshot; the `dumpsys connectivity` Private DNS lines of
  the active network; the `dumpsys dnsresolver` validation lines, for each network.
- **Fallback:** Settings screenshots only. **Limitation:** they show what was typed, not whether
  strict mode is active or validated on the network. V1 is then **not decidable**: the sub-row is
  INCONCLUSIVE and, after its extra run, NOT MET (Q2).

**Expected result:** "Strict mode active with the provider host."

**Classification rule** (per sub-row):

| Class | Condition |
|---|---|
| **PASS** | Settings shows the provider host; `dumpsys connectivity` shows Private DNS in use on the active network with server name `family.cloudflare-dns.com`; `dnsresolver` shows successful validation for that host's servers |
| **FAIL** (RJ2) | With the host set, both `dumpsys` sources agree that strict mode with the provider host is not active on the active network: Private DNS not in use, a different or missing server name, or failed validation |
| **NOT MET — unclassified** (Q23) | The two `dumpsys` sources disagree. For example, `connectivity` shows the host in use while `dnsresolver` shows failed validation. Record both and pause (S-UNCL). |
| **INCONCLUSIVE** (Q2) | Required evidence is missing, or the active network is not the one under test. One extra run; if still unresolved, NOT MET. |

**V1 as a row** is PASS only if both V1-WIFI and V1-CELL pass, and FAIL if either fails. Whether a
failing network is a "normal network" in the sense of RJ2 is the Tech Lead's judgement (Q7).

**Restoration:** leave the provider host set. The device ends on N-W.

```text
CHECKPOINT V1
V1-WIFI: PASS / FAIL / NOT MET     V1-CELL: PASS / FAIL / NOT MET     Row: ____
First device row started at (AC9):
Evidence IDs:
State at checkpoint:   Private DNS = provider host; N-W
Stop condition:        none / S-RJ (RJ2) / S-ENV
Tech Lead:             [ ] continue to V2   [ ] pause   [ ] stop
```

### 7.3 V2 — System path, with an unfiltered baseline

> **M2-02 §E.4 V2 (verbatim).** Setup: As V1, plus a baseline with Private DNS Off. Action:
> `adb shell ping -c 1 <name>`; read only the resolved IPv4 (A) address. Expected: Host set:
> category name `0.0.0.0`, controls real. Private DNS Off: category name real, which also shows
> that the network's own resolver does not block it (needed by V5 and §E.6). Result classes:
> PASS / FAIL / INCONCLUSIVE.

**Goal:** on Wi-Fi and cellular, show that the system resolver path blocks the category name while
the controls resolve, and that the network's own resolver does not block it. Feeds AC3, RJ2. It
also selects the V5 network and the friction-run precondition (§E.6).

**Prerequisites:** V1 PASS.

**Setup and action,** on N-W first (V2-WIFI), then on N-M (V2-CELL). The two are interleaved:
each PDNS-SET and NET-RESET is setup, and each DNS-CHECK is the action.

1. **Baseline:**
   1. PDNS-SET(Off), and take a screenshot.
   2. NET-RESET (Q8).
   3. DNS-CHECK, and record the three first lines.
2. **Host:**
   1. PDNS-SET(`family.cloudflare-dns.com`), and take a screenshot.
   2. NET-RESET.
   3. Wait 30 s.
   4. SYS-SIG, as information; it confirms strict mode as in V1.
   5. DNS-CHECK, and record the three first lines.
3. After V2-WIFI, turn Wi-Fi off and repeat steps 1–2 on cellular. There, NET-RESET is the mobile
   data toggle. Then turn Wi-Fi back on.

**Evidence to capture:**

- **Required (M2-02):** the first `ping` line (name and address) for each name, in each state, on
  each network; timestamps; the Private DNS screenshots.
- **No fallback.** A browser is not the system-path check, and a DNS-lookup app is excluded (§E.3:
  "No other DNS or VPN apps"). Without `adb`, V2 is NOT RUN, and AC3 is not met (INCOMPLETE).

**Expected result:** as quoted above.

**Classification rule** (per network, using the §6.3 DNS-CHECK table):

| Class | Condition |
|---|---|
| **PASS** | Off baseline: category name real, both controls real. Host set: category name `0.0.0.0`, both controls real. |
| **FAIL** (RJ2) | Host set, with both controls resolving and SYS-SIG showing the host active: the category name gets a real address |
| **INCONCLUSIVE** | Any of these: a control fails in either state; the category name gets `unknown host` or another error; the **Off baseline** gives `0.0.0.0` or an error for the category name, so the network's own resolver blocks it and the host-set block cannot be attributed (Q7); or SYS-SIG does not show the host active |

**V2 as a row** is PASS only if both networks pass, and FAIL if either fails. Otherwise it is
INCONCLUSIVE: one extra run, then NOT MET. Record which network had a clean baseline; V5 uses it.

**Restoration:** leave the provider host set. The device ends on N-W.

```text
CHECKPOINT V2
V2-WIFI: PASS / FAIL / INCONCLUSIVE / NOT MET     V2-CELL: ____     Row: ____
Networks with an unfiltered baseline (for V5 / §E.6):
Evidence IDs:
State at checkpoint:   Private DNS = provider host; N-W
Stop condition:        none / S-RJ (RJ2) / S-UNCL
Tech Lead:             [ ] continue to V3   [ ] pause   [ ] stop
```

### 7.4 V3 — H21 browser rows at the default DNS setting (T1)

> **M2-02 §E.4 V3 (verbatim).** Setup: Host set; each H21 browser at its default DNS setting,
> following the §I.1 default-setting rule. The as-found setting is recorded, and if it differs it
> is tested as a separate characterization row. Action: Every H21 row (§I.1): Chrome normal and
> Incognito, Samsung Internet normal and Secret, Firefox normal and Private. Open the category
> name (H19b), then a control; two runs per row. Expected: Error page with no content; control
> loads. Chrome EXPECTATION: its DoH upgrade list maps `family.cloudflare-dns.com` to Cloudflare's
> family DoH endpoint, but that entry is disabled by default, so Chrome should use Android's
> resolver; if it were enabled, Chrome would still stay on the family tier. Result classes:
> COVERED / BYPASS / INCONCLUSIVE.

**Goal:** show that every registered H21 row is COVERED under the §I.1 run rules. Feeds AC4, RJ3,
and the B5 gate evidence (the private-mode rows).

**Prerequisites:**

- V1 and V2 PASS;
- H19b approved;
- the registered H21 set copied into §5 and §11 before V1;
- §5 filled in for each browser;
- the host set;
- N-W as the network (runbook reading Q9; V8 covers cellular).

**Rows** (the registered set; the proposed set is shown, and a MODIFY replaces it):

| Row | Browser | Mode |
|---|---|---|
| V3-CHR-N | Chrome | normal |
| V3-CHR-P | Chrome | Incognito |
| V3-SBR-N | Samsung Internet | normal |
| V3-SBR-P | Samsung Internet | Secret |
| V3-FFX-N | Firefox | normal |
| V3-FFX-P | Firefox | Private |

Work through the browsers in the order Chrome, Samsung Internet, Firefox. For each browser:

**Setup:**

1. **Default-setting protocol, §8 steps 1–3:** record the as-found setting, version and region,
   and establish the default.
   - If the default is not established, or H21 holds no consent, this browser's T1 rows are
     **NOT MET** (INCOMPLETE). Record this in the checkpoint line and continue with the next
     browser. Whether its as-found rows are run anyway as characterization is the Tech Lead's call
     (Q11).
2. **SC** (§6.3).

**Action:**

3. **If as found ≠ default (§8 step 5):** run the characterization rows first, as found:
   `V3-<B>-N-CH` and `V3-<B>-P-CH`. For each run, do BR, then BA. Use two runs per row (Q11).
   These rows are recorded separately and **never** count for AC4.
4. **T1 rows:**
   - if as found ≠ default, switch to the default (§8 step 5; consent from H21) and take a
     screenshot;
   - for each T1 row, run 1 is BR then BA, and run 2 is BR then BA.
5. **Restore** the as-found setting if it was switched, and take a screenshot (§8 step 6).

**Evidence to capture (per run):**

- **Required (§E.5):** a browser screenshot with the URL bar and the exact error; the control
  screenshot; the browser's DNS-setting screenshot for the configuration tested; the browser
  version and mode; the network type; timestamps.
- **Preferred, stronger:** a screen recording with the status-bar clock, covering BA steps 2–4. It
  shows that no content was drawn before the error.
- **Fallback:** screenshots only. **Limitation:** a still image cannot show whether test-page
  content flashed before the error page. The outcome is judged on the final screen only.

**Expected result:** as quoted above.

**Classification rule:**

| Level | Rule |
|---|---|
| Run | BA outcome BLOCKED → **COVERED**; LOADED → **BYPASS**; INCONCLUSIVE → **INCONCLUSIVE** |
| T1 row (§I.1) | COVERED only if both runs are COVERED. A BYPASS in either run → **BYPASS** (reproduced or intermittent) → RJ3. An INCONCLUSIVE run → one extra run, recorded before it happens; still not COVERED → **NOT MET**. |
| Characterization row | Recorded with the same run classes. Never counted for AC4 and never in the claim. A BYPASS here is **not** RJ3. |

**Restoration:** every browser DNS setting back to as found (screenshots). The provider host stays
set.

```text
CHECKPOINT V3 (fill one line per browser, then the row summary)
Chrome:           default source ____  as found = default? __  CH rows: ____  CHR-N: __/__  CHR-P: __/__  restored: __
Samsung Internet: default source ____  as found = default? __  CH rows: ____  SBR-N: __/__  SBR-P: __/__  restored: __
Firefox:          default source ____  as found = default? __  CH rows: ____  FFX-N: __/__  FFX-P: __/__  restored: __
Rows NOT MET (reason):
Evidence IDs:
Stop condition:        none / S-RJ (RJ3) / S-SAFE / S-PATH / S-REGION
Tech Lead:             [ ] continue to V4   [ ] pause   [ ] stop
```

### 7.5 V4 — Browser secure DNS switched on by the user

> **M2-02 §E.4 V4 (verbatim).** Setup: Host set. Action: Chrome Secure DNS with a chosen
> non-filtering provider; Firefox DoH Increased and Max. Expected: BYPASS expected (the browser's
> own DoH); Cloudflare's test page shows. Result classes: DISCLOSED (with evidence) / COVERED.

**Goal:** give gate evidence for B3. Feeds AC6.

**Prerequisites:**

- H19b approved;
- the host set;
- C2 recorded (the Chrome provider);
- normal mode (runbook reading Q13).

**Sub-rows:**

- **V4-CHR-DOH:** Chrome, "Use secure DNS" with the C2 provider.
- **V4-FFX-INC:** Firefox, DNS over HTTPS set to Increased Protection.
- **V4-FFX-MAX:** Firefox, DNS over HTTPS set to Max Protection.

For both Firefox sub-rows, record the DoH provider shown.

**Setup, per sub-row:**

1. SC.
2. Change the browser's DNS setting by hand, and take a screenshot with the provider visible.

**Action:** run 1 is BR then BA; run 2 is BR then BA.

**Evidence to capture:** as for V3, plus the DNS-setting screenshot showing the provider. The
preferred and fallback methods and their limitation are as in V3.

**Expected result:** as quoted above.

**Classification rule** (per sub-row, two runs, Q1):

| Class | Condition |
|---|---|
| **DISCLOSED (with evidence)** | LOADED in either run: the browser's own DoH went around the filter |
| **COVERED** | BLOCKED in both runs |
| **INCONCLUSIVE** | Otherwise. One extra run; if still unresolved, NOT MET. |

**Restoration:** set each browser back to its as-found DNS setting, and take a screenshot.

```text
CHECKPOINT V4
V4-CHR-DOH (provider ____): __/__ → ____     V4-FFX-INC (provider ____): __/__ → ____     V4-FFX-MAX: __/__ → ____
Browser settings restored (screenshot IDs):
Stop condition:        none / S-SAFE / S-UNCL
Tech Lead:             [ ] continue to V5   [ ] pause   [ ] stop
```

### 7.6 V5 — Android signal when Private DNS is changed

> **M2-02 §E.4 V5 (verbatim).** Setup: Host set, on a network whose own resolver the V2 baseline
> showed to be unfiltered. Action: Switch Private DNS to Automatic, to Off, and to another host;
> each time record `dumpsys connectivity`, then repeat V2. Expected: **Decided by the system
> signal:** `dumpsys` shows that the provider host is no longer in use. This is the Android signal
> a DETECTED class relies on. The V2 result is recorded as information only: another resolver may
> still block the name. Result classes: Signal PASS / FAIL; the app side is checked later (V15).

**Goal:** give the Android signal behind B1 (and B10, through B1) and B2. Feeds AC6. The DETECTED
class stays *expected* until V15.

**Prerequisites:**

- the host set;
- a network with a clean V2 baseline (from the V2 checkpoint);
- C3 recorded (the other host).

**Sub-rows** (runbook reading Q14: each starts from the provider host, which is restored between
sub-rows):

- **V5-AUTO:** host → Automatic.
- **V5-OFF:** host → Off.
- **V5-OTHER:** host → the C3 host.

**Setup, per sub-row:**

1. SYS-SIG. It must show the provider host active, as the start state. If it does not, restore
   the host first.

**Action, per sub-row:**

2. PDNS-SET(the target value), and take a screenshot. No NET-RESET: the signal is read as the
   device presents it after the change.
3. Wait 30 s, then run SYS-SIG.
4. DNS-CHECK. This is **information only**.
5. PDNS-SET(`family.cloudflare-dns.com`), then SYS-SIG to confirm that the host is active again.

**Evidence to capture:**

- **Required (M2-02):** the `dumpsys connectivity` Private DNS lines after each change; the
  Settings screenshots.
- **Information:** the DNS-CHECK first lines. The `dnsresolver` lines are optional.
- **Fallback:** Settings screenshots only. **Limitation:** they show the user's choice, not the
  system signal that V5 is decided on. The sub-row is then INCONCLUSIVE and, after its extra run,
  NOT MET.

**Expected result:** as quoted above.

**Classification rule** (per sub-row):

| Class | Condition |
|---|---|
| **Signal PASS** | After the change, `dumpsys connectivity` shows that the provider host is no longer in use on the active network. Examples: no strict server name; Private DNS shown as opportunistic or not in use; another server name. |
| **Signal FAIL** | After the change, `dumpsys` still shows `family.cloudflare-dns.com` in use |
| **INCONCLUSIVE** (Q2) | Required lines missing or unreadable. One extra run; if still unresolved, NOT MET. |

The DNS-CHECK results never change the class. Mapping (§E.6): V5-AUTO and V5-OFF give the B1 gate
evidence (and B10 through B1); V5-OTHER gives the B2 gate evidence.

**Restoration:** the provider host is set and active (step 5 of the last sub-row).

```text
CHECKPOINT V5
Network used (clean V2 baseline):
V5-AUTO: ____   V5-OFF: ____   V5-OTHER (host ____): ____
DNS-CHECK information (per sub-row):
Host restored and active (SYS-SIG ID):
Stop condition:        none / S-UNCL
Tech Lead:             [ ] continue to V6   [ ] pause   [ ] stop
```

### 7.7 V6 — Blocking persists after a reboot

> **M2-02 §E.4 V6 (verbatim).** Setup: Host set. Action: Reboot, then V2 before opening any app.
> Expected: Still blocked (EXPECTATION: no app is in the DNS path; during verification no A8 app
> exists). Force-stop and uninstall of the app are checked with the prototype (V14). Result
> classes: PASS / FAIL.

**Goal:** show that blocking survives a reboot with no app running. Feeds AC5, RJ4, and the B11
gate evidence.

**Prerequisites:**

- the host set, and V2 PASS on N-W;
- USB debugging stays authorized across a reboot. Check this before rebooting.

**Setup:**

1. SYS-SIG as the before record.
2. Note the time.

**Action:**

1. Restart the device from the power menu. Record the time.
2. Unlock. **Open no app** (runbook reading Q15: the Settings app is also left until after the
   check).
3. Wait until N-W is connected, plus 30 s.
4. DNS-CHECK from the desktop.
5. SYS-SIG. This is supporting evidence, and optional.
6. Only now, open the Private DNS screen and take a screenshot.

**Evidence to capture:**

- **Required (M2-02):** the DNS-CHECK first lines after the reboot, with the reboot time, the
  unlock time and the check time.
- **Supporting:** SYS-SIG and the Settings screenshot.
- **No fallback.** V2's method needs `adb`.

**Expected result:** "Still blocked."

**Classification rule:**

| Class | Condition |
|---|---|
| **PASS** | After the reboot, and before any app was opened: category name `0.0.0.0`, both controls real |
| **FAIL** (RJ4) | After the reboot, with both controls resolving: the category name gets a real address |
| **INCONCLUSIVE** (Q2) | A control fails, the network is not up, or an app was opened before the check. The extra run is one more reboot, recorded before it happens. If still unresolved, NOT MET. |

**Restoration:** none. The host stays set.

```text
CHECKPOINT V6
Reboot / unlock / check times:
Result: PASS / FAIL / NOT MET          Evidence IDs:
Stop condition:        none / S-RJ (RJ4)
Tech Lead:             [ ] continue to V7   [ ] pause   [ ] stop
```

### 7.8 V7 — Window from pre-existing browser state

> **M2-02 §E.4 V7 (verbatim).** Setup: Private DNS Off; the browser loads the category name (H19b)
> and stays open. Action: Set the host; reload at +0 s, +60 s and +5 min; then a cold start.
> Expected: A short window from cached answers or connections is possible; record it. Result
> classes: DISCLOSED window / PASS.

**Goal:** measure how long a page or connection opened before filtering stays reachable. This is
the B8 gate evidence, with its measured window. Feeds AC6.

**Prerequisites:**

- H19b approved;
- C1 recorded (browser and mode; proposed: Chrome normal at its V3 T1 setting);
- a network with a clean V2 baseline, because the first load needs an unfiltered resolver.

**Setup:**

1. If needed, switch the C1 browser to its V3 T1 (default) setting (§8; H21 consent), and take a
   screenshot.
2. PDNS-SET(Off), and take a screenshot.
3. BR.
4. Open the browser and load `https://nudity.testcategory.com/?a8=<id>`. **Expected: the test page
   loads.** If it does not, the run is INCONCLUSIVE (the precondition failed).
5. Leave the tab open. Do not close or force-stop the browser.

**Action:**

1. Start the screen recorder (preferred).
2. Go home, and PDNS-SET(`family.cloudflare-dns.com`). The moment of Save is **T0**; note it.
3. Return to the browser through Recents, not by relaunching it. Press **reload** on the same tab:
   - at +0 s (immediately);
   - at T0 + 60 s;
   - at T0 + 5 min.

   After each reload, take a screenshot with the URL bar and the status-bar clock.
4. **Cold start:** force-stop the browser (Settings → Apps), reopen it, and load the category URL
   in a new tab. Take a screenshot.
5. Load the control (`https://example.org/?a8=<id>`), and take a screenshot.
6. Stop the recording.

**Evidence to capture:**

- **Required (§E.5):** the screenshot per reload with the URL bar; the exact error text;
  timestamps; the browser version and DNS setting.
- **Preferred, stronger:** a screen recording covering T0 to the cold start. It gives timing to
  the second and shows whether content was served.
- **Fallback:** timestamped screenshots. **Limitation:** the status-bar clock shows minutes only,
  so the window is known only to about ±1 minute.

**Expected result:** as quoted above.

**Classification rule** (per run; two runs, Q1):

| Class | Condition |
|---|---|
| **PASS** | Every reload after T0 and the cold start show an error page with no test-page content, and the control loads |
| **DISCLOSED window** | One or more reloads after T0 still show the test page, and the cold start shows an error page with no content. Window = from T0 to the last reload that showed the page. Upper bound: the first reload that did not. |
| **NOT MET — unclassified** (Q16) | The cold start still shows the test page. That is not a window, and M2-02 gives it no class. Record it verbatim and pause (S-UNCL). |
| **INCONCLUSIVE** | The initial load failed with Private DNS Off, the control fails, the network changed during the run, or evidence is missing |

**Row:** DISCLOSED window if either run shows one, reporting the longer window. PASS only if both
runs pass.

**Restoration:** the provider host stays set. Set the browser back to its as-found DNS setting (§8
step 6; screenshot), and close the tabs.

```text
CHECKPOINT V7
Browser / mode / DNS setting (C1):
Run 1: +0 __ +60 __ +5min __ cold __ → ____      Run 2: ____      Row: ____   Window: ____
Browser setting restored (screenshot ID):
Stop condition:        none / S-UNCL / S-SAFE
Tech Lead:             [ ] continue to V8   [ ] pause   [ ] stop
```

### 7.9 V8 — Network changes

> **M2-02 §E.4 V8 (verbatim).** Setup: Host set. Action: Wi-Fi → cellular → Wi-Fi; V2 and part of
> V3 on each. Expected: Blocked on every network. Result classes: PASS / FAIL.

**Goal:** show that blocking holds across Wi-Fi ↔ cellular. Feeds AC5.

**Prerequisites:**

- the host set;
- N-W and N-M available;
- C1 recorded (the "part of V3" browser).

**Setup:** connect to N-W with mobile data on. SYS-SIG must show the provider host active. If
needed, switch the C1 browser to its V3 T1 setting, and take a screenshot.

**Action:** no NET-RESET. The network change is the subject.

1. **V8-WIFI1:** on N-W: DNS-CHECK, then SYS-SIG (supporting), then two BA runs (each preceded by
   BR).
2. Turn Wi-Fi off, and wait until cellular is connected, plus 30 s.
3. **V8-CELL:** the same checks as V8-WIFI1.
4. Turn Wi-Fi on, and wait until N-W rejoins, plus 30 s.
5. **V8-WIFI2:** the same checks as V8-WIFI1.

**Evidence to capture:** the DNS-CHECK first lines and BA screenshots at each point, and the time
of each network change. `adb` is required for the V2 part, and there is no fallback for it. For
the browser part, the preferred and fallback methods are as in V3.

**Expected result:** "Blocked on every network."

**Classification rule** (per point):

| Class | Condition |
|---|---|
| **PASS** | Category name `0.0.0.0` with both controls real, **and** the browser part is BLOCKED in both runs |
| **FAIL** | The category name gets a real address while the controls resolve, **or** the browser part is LOADED in either run |
| **INCONCLUSIVE** (Q2) | A control fails, the network is not up, or evidence is missing. One extra run; if still unresolved, NOT MET. |

**V8 as a row** is PASS only if all three points pass, and FAIL if any point fails. M2-02 has no RJ
row for a V8 FAIL. How it enters §I.3, and whether a browser LOADED here counts toward RJ3, is
decided in §13 by the Tech Lead (Q17, Q18).

**Restoration:** the device ends on N-W with the host set. Set the browser back to its as-found
setting (screenshot).

```text
CHECKPOINT V8
V8-WIFI1: ____   V8-CELL: ____   V8-WIFI2: ____   Row: ____
Browser setting restored (screenshot ID):
Stop condition:        none / S-UNCL / S-SAFE
Tech Lead:             [ ] continue to V9   [ ] pause   [ ] stop
```

### 7.10 V9 — IPv6

> **M2-02 §E.4 V9 (verbatim).** Setup: Host set; IPv6-capable network. Action: AAAA lookups
> (`ping6`) for the test name and a control; part of V3. Expected: Test name AAAA `::` or none;
> control usable. Result classes: PASS / FAIL / NOT RUN (no IPv6).

**Goal:** find the blocked AAAA answer (U2) and check the IPv6 path. Feeds AC6: "V9 is classified
COVERED or DISCLOSED, or NOT RUN only with a stated reason".

**Prerequisites:**

- N-6 identified in §4.2 (a global IPv6 address and an IPv6 default route). If there is none,
  record **NOT RUN (no IPv6)** with the §4.2 evidence, and go to the checkpoint.
- the host set;
- C1 recorded.

**Setup:** connect to N-6 with the provider host set. If needed, switch the C1 browser to its V3
T1 setting, and take a screenshot.

**Action on N-6:**

1. SYS-SIG (supporting).
2. DNS-CHECK (A answers, for context).
3. Run the AAAA lookups and record each first line. If `ping6` is missing on the device, use
   `adb shell ping -6 -c 1 <name>` and record the command used.

   ```text
   adb shell ping6 -c 1 nudity.testcategory.com
   adb shell ping6 -c 1 example.org
   ```

   Record whether the control ping got a reply, as information only.
4. Part of V3: two BA runs (each preceded by BR).

**Evidence to capture:**

- **Required:** the `ping6` first lines, the BA screenshots, and the §4.2 IPv6 evidence (redacted).
- **Limitation:** `ping6` prints `unknown host` both when there is no AAAA record and when the
  name does not exist. The A answer from step 2, on the same network, shows that the name exists.
- **No fallback** for the device path. A desktop `dig AAAA` against `1.1.1.3` may be recorded as
  information; it is not the device path.

**Expected result:** as quoted above.

**Classification rule:**

| Class | Condition |
|---|---|
| **PASS** | Category name AAAA is `::` or none, **and** the control resolves to a real IPv6 address (runbook reading Q19 of "usable"), **and** the browser part is BLOCKED in both runs |
| **FAIL** | The category name resolves to a real IPv6 address, or the browser part is LOADED in either run |
| **NOT RUN (no IPv6)** | No IPv6-capable network is available. The reason and the evidence are recorded. |
| **INCONCLUSIVE** (Q2) | The control gets no IPv6 address, so the IPv6 path is not shown, or evidence is missing. One extra run; if still unresolved, NOT MET. |

The AC6 wording (COVERED / DISCLOSED) is applied to this result in the report, after Tech Lead
confirmation (Q18).

**Restoration:** back to N-W. Set the browser back to its as-found setting (screenshot).

```text
CHECKPOINT V9
Network (N-6):          IPv6 evidence ID:
Category AAAA: ____   Control AAAA: ____ (reply: y/n)   Browser part: __/__   Result: ____
Stop condition:        none / S-UNCL / S-SAFE
Tech Lead:             [ ] continue to V10   [ ] pause   [ ] stop
```

### 7.11 V10 — DoT-blocking network and captive portal

> **M2-02 §E.4 V10 (verbatim).** Setup: Host set. Action: A network that blocks TCP 853 (router
> rule), and a captive-portal network, if available. Expected: DNS fails on that network. Record
> the system message and a recovery path: set Automatic, connect or log in, restore the host.
> Result classes: DISCLOSED with recovery documented / FAIL (no clear recovery).

**Goal:** document the behavior when the resolver is unreachable or behind a captive portal, with
a working recovery path through standard Settings. Feeds AC7, RJ5, the B9 gate evidence, and U7 and
U9.

**Prerequisites:**

- the host set;
- C4 recorded;
- for V10-853, the router's as-found configuration recorded with a redacted screenshot.

**V10-853 — setup:**

1. In the N-853 router's admin page, add a rule by hand that blocks outbound TCP port 853, and
   take a redacted screenshot.
2. **Rule check** (information, preferred): from a desktop on N-853, run
   `Test-NetConnection -ComputerName family.cloudflare-dns.com -Port 853` (PowerShell). The
   expected result is a failed TCP test. The **fallback** is the router screenshot only.
   **Limitation:** the screenshot does not show that the rule applies to the device's traffic.

**V10-853 — action:**

3. On the device, connect to N-853 (Wi-Fi off/on), and wait 60 s.
4. Record, with screenshots:
   - every system notification or message (for example about Private DNS or "no internet");
   - the Wi-Fi status text;
   - SYS-SIG (recommended: it resolves U9, what `isPrivateDnsActive()` reports when the strict
     host fails validation);
   - DNS-CHECK;
   - a control load in a browser, with the exact error.
5. **Recovery, standard Settings only:**
   1. PDNS-SET(Automatic).
   2. DNS-CHECK, and a control load in a browser.
   3. Write down each step taken.
6. Remove the router rule, and take a screenshot.
7. PDNS-SET(`family.cloudflare-dns.com`), then SYS-SIG, then DNS-CHECK. The expected result is the
   V2 PASS pattern.

**V10-CP — setup:** the provider host is set and active (SYS-SIG), and the device is near N-CP.

**V10-CP — action:**

1. Connect to N-CP.
2. Record, with screenshots: whether a sign-in notification or portal page appears; every system
   message; SYS-SIG; DNS-CHECK.
3. Try to log in to the portal with the host set, and record what happens.
4. If connectivity is blocked: PDNS-SET(Automatic), connect or log in, record each step, then
   check that a control loads.
5. PDNS-SET(`family.cloudflare-dns.com`) on the logged-in network, then SYS-SIG, then DNS-CHECK.
   Record the result.
6. Leave N-CP, and forget the network.

Portal safety: enter only what the portal requires. Do not record personal login data; redact the
SSID.

**Evidence to capture:** the system-message screenshots (required by M2-02); the recovery steps as
written; the before and after DNS-CHECK and SYS-SIG results; and the router screenshots. The
preferred and fallback methods for the rule check are in V10-853 step 2.

**Expected result:** as quoted above.

**Classification rule** (per sub-row):

| Class | Condition |
|---|---|
| **DISCLOSED with recovery documented** | The behavior on the network is recorded (messages, DNS results) **and** the standard-Settings path (Automatic, then connect or log in, then restore the host) restores connectivity, with its steps written down |
| **FAIL (no clear recovery)** (RJ5) | The device is left without connectivity, and the standard-Settings path does not restore it, or there is no clear path |
| **NOT RUN** | That network is not available. The reason is recorded (Q20). |
| **NOT MET — unclassified** (Q20) | DNS does **not** fail on N-853 with TCP 853 blocked (the rule check confirmed). M2-02 expects a failure and gives no class for this. Record it verbatim and pause (S-UNCL). |

**Restoration:** the router rule is removed (screenshot); the captive network is forgotten; the
device is back on N-W with the host set and active.

```text
CHECKPOINT V10
V10-853: ____  (rule check: ____)   V10-CP: ____
System messages recorded (IDs):
Recovery steps (853 / CP):
Router rule removed (screenshot ID):
Stop condition:        none / S-RJ (RJ5) / S-CONN / S-UNCL
Tech Lead:             [ ] continue to V11   [ ] pause   [ ] stop
```

### 7.12 V11 — Another VPN app

> **M2-02 §E.4 V11 (verbatim).** Setup: Host set. Action: Start a common VPN app that has its own
> DNS; V2 and part of V3. Expected: UNKNOWN. The DevicePolicyManager note says the resolver "must
> be reachable both from within and outside the VPN". Result classes: COVERED / DISCLOSED.

**Goal:** give the B6 gate evidence and resolve U5. Feeds AC6.

**Prerequisites:**

- the host set, on N-W;
- C5 recorded (the app, its version, and whether it advertises its own DNS);
- H19b approved;
- C1 recorded.

**Never** turn on Always-on or "Block connections without VPN" (§E.3).

**Setup:**

1. SYS-SIG must show the provider host active on N-W.
2. If needed, switch the C1 browser to its V3 T1 setting, and take a screenshot.
3. Install the C5 app if needed, and connect it. Take screenshots of the key icon, the app's DNS
   setting, and any split-tunnel or app-exclusion setting.

**Action:**

1. SYS-SIG: record the VPN network and the default network's Private DNS lines.
2. DNS-CHECK.
3. Part of V3: two BA runs (each preceded by BR).
4. Disconnect the VPN, and confirm that the key icon is gone.
5. SYS-SIG, then DNS-CHECK. The expected result is the V2 PASS pattern.

**Evidence to capture:**

- **Required:** the DNS-CHECK first lines with the VPN connected; the BA screenshots; the VPN
  status screenshots.
- **Limitation:** `adb shell` lookups run as the shell user. Whether the VPN routes them depends on
  the app's per-app settings. The browser part shows the browser's own path. Record the two
  separately.

**Expected result:** "UNKNOWN."

**Classification rule:**

| Class | Condition |
|---|---|
| **COVERED** | With the VPN connected: the category name gets `0.0.0.0` with both controls real, **and** the browser part is BLOCKED in both runs |
| **DISCLOSED** | With the VPN connected, a bypass appears in either part: the category name gets a real address, or the browser part is LOADED in any run. B6 then follows its register row (§E.6): DETECTED only if the check later shows Error (V14), otherwise DISCLOSED. The gate does not decide V14. |
| **INCONCLUSIVE** (Q2) | The VPN is not connected, the controls fail (the VPN broke connectivity), or evidence is missing. One extra run; if still unresolved, NOT MET. |

**Restoration:**

1. Disconnect the VPN, and uninstall it if C5 says so.
2. Confirm that *Settings → Connections → More connection settings → VPN* shows no active or
   Always-on VPN.
3. The host stays set. Set the browser back to its as-found setting (screenshot).

```text
CHECKPOINT V11
VPN app / version (C5):        split-tunnel setting:
DNS part: ____   Browser part: __/__   Result: ____
VPN disconnected / uninstalled (IDs):
Stop condition:        none / S-UNCL / S-SAFE
Tech Lead:             [ ] continue to V12   [ ] pause   [ ] stop
```

### 7.13 V12 — In-app browsers (Custom Tabs, WebView)

> **M2-02 §E.4 V12 (verbatim).** Setup: Host set. Action: A Custom Tabs flow and a WebView in-app
> browser. Expected: UNKNOWN. Result classes: COVERED / DISCLOSED.

**Goal:** give the B7 gate evidence and resolve U6. Feeds AC6.

**Prerequisites:**

- the host set;
- H19b approved;
- C6 recorded (the apps, their versions, how the URL reaches them, and which browser provides the
  Custom Tab).

**Sub-rows:** **V12-CT** (Custom Tabs) and **V12-WV** (WebView in-app browser).

**Setup, per run:**

1. SC.
2. Force-stop the host app. For V12-CT, also force-stop the browser that provides the Custom Tab.

**Action, per sub-row (two runs, Q1):**

3. Make the link `https://nudity.testcategory.com/?a8=<id>` available inside the app as C6 records,
   and tap it.
4. Confirm that it opened in the intended in-app browser, not in a full browser. Take a screenshot
   of the in-app browser UI and any menu that names it.
5. Take a screenshot of the result, with the URL or title if the UI shows one. Record the exact
   error text.
6. Close the in-app browser, open `https://example.org/?a8=<id>` the same way, and take a
   screenshot.

**Evidence to capture:**

- **Required:** the result screenshots and control screenshots, the app name and version, and how
  the link was opened.
- **Preferred, stronger** (optional, read-only):
  `adb shell dumpsys activity activities | Select-String -Pattern "ResumedActivity"`, taken while
  the in-app browser is showing. It names the component on screen, for example a Custom Tabs
  activity.
- **Fallback:** screenshots only. **Limitation:** they show the UI, not which engine rendered it,
  and some in-app browsers hide the URL.

**Expected result:** "UNKNOWN."

**Classification rule** (per sub-row):

| Class | Condition |
|---|---|
| **COVERED** | BLOCKED in both runs, with the link opened in the intended in-app browser |
| **DISCLOSED** | LOADED in either run |
| **INCONCLUSIVE** (Q2) | The control fails; the link opened in a full browser instead, so the sub-row did not test what it names; or evidence is missing. One extra run; if still unresolved, NOT MET. |

**Restoration:** close the apps. If the Tech Lead wants, delete any note or message created to hold
the link. Nothing else was changed.

```text
CHECKPOINT V12
V12-CT (app ____, provider browser ____): __/__ → ____     V12-WV (app ____): __/__ → ____
Stop condition:        none / S-UNCL / S-SAFE
Tech Lead:             [ ] continue to V13   [ ] pause   [ ] stop
```

### 7.14 V13 — One more browser (characterization only)

> **M2-02 §E.4 V13 (verbatim).** Setup: Host set. Action: One more browser at default settings
> (for example Edge or Brave), characterized outside the H21 set. Expected: UNKNOWN. Result
> classes: COVERED / DISCLOSED (characterization only; never part of the T1 claim).

**Goal:** inform the B4 wording. The result **never** adds a browser to the claim, and B4 stays
DISCLOSED (§E.6). Feeds AC6.

**Prerequisites:**

- the host set;
- H19b approved;
- C7 recorded;
- a §5 block for the browser, with its default source.

The browser must be at its default: for example a fresh install, where the as-found setting is
the installed default, or an as-found setting that matches a recorded default. H21's consent does
not cover switching a non-H21 browser (Q22).

**Setup:** SC. Take a screenshot of the browser's DNS setting, showing the default.

**Action:** normal mode (Q13); two runs, each BR then BA.

**Evidence to capture:** as for V3 (preferred and fallback methods included), plus the browser's
DNS-setting screenshot and its default source.

**Expected result:** "UNKNOWN."

**Classification rule:**

| Class | Condition |
|---|---|
| **COVERED** | BLOCKED in both runs |
| **DISCLOSED** | LOADED in either run |
| **INCONCLUSIVE** (Q2) | Otherwise. One extra run; if still unresolved, NOT MET. |

Either class is characterization only.

**Restoration:** uninstall the browser if C7 says so, or restore any changed setting. Then run the
session end (§6.5).

```text
CHECKPOINT V13
Browser / version / DNS setting / default source:
Runs: __/__ → ____ (characterization only)
Session end done (§6.5): yes / no
Stop condition:        none / S-UNCL / S-SAFE
Tech Lead:             [ ] V0–V13 complete → fill §11 and hand over to the report   [ ] pause   [ ] stop
```

---

## 8. Browser default-setting protocol

This is the M2-02 §I.1 default-setting rule as protocol steps (M2-03 §3, H21). Apply it to each
registered H21 browser before its first V3 run. Record every input and output in that browser's
§5 block.

| Step | What to do | Record |
|---|---|---|
| 1 | **Record the as-found setting:** open the browser's DNS setting (§5 paths) without changing it | Exact wording; screenshot ID; path used |
| 2 | **Record the version and region:** the installed version (§5), and the region as the country of the device settings **and** of the network used (§I.1). Browser defaults can depend on region (U3). | Version; device country; network country. If they differ, pause (S-REGION, Q12). |
| 3 | **Establish the documented default** for that version and region, from a source recorded with the result: the browser's documentation, release notes or source for that version, or a default marked in its own settings screen. Remembered or assumed defaults do not count. If the browser exposes no DNS setting, its installed state is its default. | Default value; source (URL or screenshot) and date read. **Not established, or no consent recorded in G0 → this browser's T1 rows are NOT MET → INCOMPLETE** (§I.1 step 3). |
| 4 | **As found equals the default:** run the T1 rows as found. No switch and no restore are needed. | "as found = default" |
| 5 | **As found differs:** (a) run the rows as found first, as **characterization rows** (`-CH`), recorded separately; they never count for AC4 and never enter the claim. (b) With the H21 consent, switch the setting to the default in the browser's settings screen. (c) Run the T1 rows. | Characterization results; switch screenshot ID and time |
| 6 | **Restore** the as-found setting afterwards (runbook reading Q3: before the checkpoint of every row that switched it) | Restore screenshot ID and time |

**Characterization row, when needed:** step 5(a) only. It uses the V3 procedure with the `-CH`
suffix and is never part of the T1 claim.

**The claim is scoped to the tested region.** A claim for another region needs its own V3 run
(§I.1).

**Later rows that use an H21 browser "at its V3 setting"** (V7, and the browser parts of V8, V9 and
V11) repeat step 5(b) before the row and step 6 after it. H21's consent covers switching to the
default "for the test" and restoring afterwards.

---

## 9. Safety rules

From M2-02 §E.3, with the runbook's operational additions marked.

1. Change settings **by hand in the Settings UI only**: Private DNS, browser DNS, VPN and the V10
   router. Never use `adb shell settings put`, `pm clear`, scripts or automation to change a
   setting.
2. Use `adb` **only for reads and `ping`-based name resolution**.
3. **Never use real adult domains.** Use only the H19a names. Browsers open only the category page
   (H19b) and the controls.
4. **Record the as-found settings and restore them.**
   - Every row restores what it changed before its checkpoint.
   - Every session ends with Private DNS back at its as-found value (§6.5), because H18 covers DNS
     to the provider only while the tests run.
5. **No Always-on and no Lockdown**, including in V11.
6. **No other DNS or VPN apps, except in V11.** The V11 app is used only for V11.
7. **Redact SSIDs and IP addresses.**
   - *Runbook reading Q4:* the answer address in a test-name or control `ping` or `dig` line is
     the oracle observation (§E.5: "the first `ping` line (name and address)"). It is kept, and
     it is always `0.0.0.0` or a public test-domain address.
   - Every other address is redacted: device, LAN, resolver, WAN and VPN addresses.
   - Also redact account names and other apps' notifications.
8. **Keep raw evidence outside the repository.** Commit one classified results document, as for
   M1-06. That is issue #40's deliverable, not this file.
9. **Unexpected content** (runbook addition). If the category page shows anything other than a
   browser error page or Cloudflare's test notice:
   1. close the tab at once, and take **no screenshot of the content**;
   2. write a text description without explicit detail;
   3. stop (S-SAFE).

   H19b's basis no longer holds, and the Tech Lead decides.
10. **Typing errors** (runbook addition). If the URL bar shows anything other than the URL typed:
    1. close the tab;
    2. record the run as INCONCLUSIVE;
    3. repeat it as a pre-recorded extra run.
11. **Nothing is fixed during verification** (runbook addition). No code change, no mitigation, no
    setting "tuned" to make a row pass, and no change of scope, test names, networks or criteria
    after a result (S-SCOPE).
12. **H18 record conditions** apply as recorded (§2.1). Example: whether the device may be used
    for other purposes while the provider host is set.

---

## 10. Evidence naming convention and records

**Folder** (outside the repository): `A8-evidence/<YYYYMMDD>/<ROW>/`

**File name:** `A8_<ROW>[-<SUB>]_R<run>_<NET>_<YYYYMMDD-HHMMSS>_<kind>.<ext>`

| Part | Values |
|---|---|
| `ROW` | `V0` … `V13` |
| `SUB` | V1, V2: `WIFI`, `CELL` · V3: `CHR-N`, `CHR-P`, `SBR-N`, `SBR-P`, `FFX-N`, `FFX-P`, and the suffix `-CH` for characterization · V4: `CHR-DOH`, `FFX-INC`, `FFX-MAX` · V5: `AUTO`, `OFF`, `OTHER` · V8: `WIFI1`, `CELL`, `WIFI2` · V10: `853`, `CP` · V12: `CT`, `WV` · V13: `X-<browser>` |
| `run` | `1`, `2`; `3` for the pre-recorded extra run |
| `NET` | `DESK`, `WIFI`, `CELL`, `IPV6`, `P853`, `CPORTAL` |
| `kind` | `settings`, `dumpsys-conn`, `dumpsys-dnsres`, `ping`, `ping6`, `dig`, `browser-cat`, `browser-ctl`, `browser-dns`, `notif`, `router`, `vpn`, `restore`, `rec` (screen recording), `note` |

- **Evidence ID** in the records: `A8-<ROW>[-<SUB>]-R<run>`, for example `A8-V3-FFX-P-R2`.
- **Query-string ID** in BA URLs: the same ID in lower case, for example `?a8=a8-v3-ffx-p-r2`.
- Raw text output (`dumpsys`, `dig`) is saved whole. Only redacted extracts go into records.
- Never rename or delete a file after classification. Corrections are new files with a `note`.

**Run record** (one per run):

```text
Evidence ID:
Date / time (TZ):
Device / Android / One UI / patch:
Network (N-W / N-M / N-6 / N-853 / N-CP; IPv6 y/n; resolver operator):
Private DNS (screenshot ID; SYS-SIG ID):
Browser / version / mode (browser rows):
Browser DNS setting (as found / default / other; §5 source ref):
Steps performed (deviations noted):
DNS-CHECK first lines (name → address):
Browser category attempt (URL bar; outcome; exact error text; screenshot ID):
Browser control (loaded y/n; screenshot ID):
Other evidence (dumpsys extract, recording, messages):
Run classification (row's own classes):
Extra run pre-recorded? (y/n; reason):
Notes:
```

---

## 11. Result table

Fill this in after each checkpoint. "Feeds" gives the §I.2 and §I.3 items and the §E.6 register
entries each row supplies. The table does not interpret them.

### 11.1 Row results

| Row / sub-row | M2-02 classes | Run 1 | Run 2 | Extra | Row result | Evidence IDs | Feeds |
|---|---|---|---|---|---|---|---|
| V0 | Oracle VALID / INVALID | | — | | | | AC1, RJ1 |
| V1-WIFI | PASS / FAIL | | — | | | | AC2, RJ2 |
| V1-CELL | PASS / FAIL | | — | | | | AC2, RJ2 |
| V2-WIFI | PASS / FAIL / INCONCLUSIVE | | — | | | | AC3, RJ2 |
| V2-CELL | PASS / FAIL / INCONCLUSIVE | | — | | | | AC3, RJ2 |
| V3-CHR-N | COVERED / BYPASS / INCONCLUSIVE | | | | | | AC4, RJ3 |
| V3-CHR-P | COVERED / BYPASS / INCONCLUSIVE | | | | | | AC4, RJ3, B5 |
| V3-SBR-N | COVERED / BYPASS / INCONCLUSIVE | | | | | | AC4, RJ3 |
| V3-SBR-P | COVERED / BYPASS / INCONCLUSIVE | | | | | | AC4, RJ3, B5 |
| V3-FFX-N | COVERED / BYPASS / INCONCLUSIVE | | | | | | AC4, RJ3 |
| V3-FFX-P | COVERED / BYPASS / INCONCLUSIVE | | | | | | AC4, RJ3, B5 |
| V3-…-CH (each, if any) | recorded; characterization only | | | | | | never AC4 |
| V4-CHR-DOH | DISCLOSED (with evidence) / COVERED | | | | | | AC6, B3 |
| V4-FFX-INC | DISCLOSED (with evidence) / COVERED | | | | | | AC6, B3 |
| V4-FFX-MAX | DISCLOSED (with evidence) / COVERED | | | | | | AC6, B3 |
| V5-AUTO | Signal PASS / FAIL | | — | | | | AC6, B1, B10 |
| V5-OFF | Signal PASS / FAIL | | — | | | | AC6, B1, B10 |
| V5-OTHER | Signal PASS / FAIL | | — | | | | AC6, B2 |
| V6 | PASS / FAIL | | — | | | | AC5, RJ4, B11 |
| V7 | DISCLOSED window / PASS | | | | | window: | AC6, B8 |
| V8-WIFI1 | PASS / FAIL | | | | | | AC5 |
| V8-CELL | PASS / FAIL | | | | | | AC5 |
| V8-WIFI2 | PASS / FAIL | | | | | | AC5 |
| V9 | PASS / FAIL / NOT RUN (no IPv6) | | | | | | AC6 |
| V10-853 | DISCLOSED with recovery documented / FAIL (no clear recovery) | | — | | | | AC6 (B9), AC7, RJ5 |
| V10-CP | DISCLOSED with recovery documented / FAIL (no clear recovery) | | — | | | | AC6 (B9), AC7, RJ5 |
| V11 | COVERED / DISCLOSED | | | | | | AC6, B6 |
| V12-CT | COVERED / DISCLOSED | | | | | | AC6, B7 |
| V12-WV | COVERED / DISCLOSED | | | | | | AC6, B7 |
| V13 | COVERED / DISCLOSED (characterization only) | | | | | | AC6, B4 |

### 11.2 T2 register: gate evidence from V0–V13 (M2-02 §E.6)

The expected classes and evidence sources are taken from §E.6, with the action names shortened.
This runbook fills in only the "Gate result" column.

- AC6: if the gate evidence contradicts the expected class, the action is reclassified before the
  §I.3 decision. That happens in the report, not here.
- DETECTED classes, and the COVERED classes of B11 and B12, stay *expected* until V14–V15.

| ID | T2 action | Expected H4 class | Gate evidence | Gate result | Final evidence |
|---|---|---|---|---|---|
| B1 | Private DNS to Off or Automatic | DETECTED (expected) | V5 (AUTO, OFF) | | V15 |
| B2 | Replace the provider host | DETECTED (expected) | V5 (OTHER) | | V15 |
| B3 | Browser's own secure DNS | DISCLOSED (expected) | V4 | | V4 |
| B4 | A browser outside the H21 set | DISCLOSED (expected) | V13 | | V13 |
| B5 | Private mode in an H21 browser | COVERED (expected) | V3 private-mode rows | | V3 |
| B6 | Another VPN app | COVERED (expected; ASSUMPTION) | V11 | | V11; if it shows a bypass: DETECTED only if V14 shows Error, otherwise DISCLOSED |
| B7 | In-app browser | COVERED (expected; ASSUMPTION) | V12 | | V12 |
| B8 | Page or connection opened before filtering | DISCLOSED (expected), with the measured window | V7 | | V7 |
| B9 | Private DNS off on a DoT-blocking network | DETECTED (expected), as B1 | V10 | | V15 |
| B10 | Optional in-app "how to turn off" guidance | DETECTED (expected), through B1 | V5 | | V15 |
| B11 | Force-stop or clear the app's data | COVERED (expected) | V6 | | V14 |
| B12 | Uninstall the app | COVERED (expected) | — | — | V14 |

The steps-and-time measurements for B1–B4 and B6–B9 are the §E.6 friction runs (issue #41). They
are not part of this table.

---

## 12. Stop conditions

Check this table at every checkpoint. **STOP** means that no further row runs until the Tech Lead
decides. **PAUSE** means the same, with the row recorded as it stands. After any stop or pause, run
the session end (§6.5) unless the Tech Lead continues at once.

| ID | Trigger | Action | Basis |
|---|---|---|---|
| S-G0 | A G0 item the next row needs is not recorded | STOP. Do not start the row. | §E.1 |
| S-NV | H19b not approved, and no validated equivalent recorded | STOP. Outcome **NOT VERIFIABLE**; no device row runs. V0 may still run on H19a alone, but cannot change this outcome (Q6). | §E.1, §I.3 |
| S-RJ1 | V0 INVALID | STOP. Outcome **FAIL — candidate (RJ1)**. No device row starts, because every device row is read through the V0 oracle. Follow-up (a separate decision): a new V0 with another provider, or reopen A2. | §I.3, §E.2 |
| S-ORACLE | V0 NOT MET (still INCONCLUSIVE after its extra run) | STOP before V1. Without a valid oracle no DNS result can be read (INCOMPLETE). | §E.2, §I.3 |
| S-RJ | RJ2 (V1 or V2 FAIL), RJ3 (an H21 row BYPASS), RJ4 (V6 FAIL) or RJ5 (V10 FAIL) | PAUSE. The outcome for the registered scope is **FAIL — candidate**, and no later row can change it. The Tech Lead decides whether the remaining rows run as evidence only, and records that before any of them runs. | §I.3 |
| S-PATH | During SC, session start or any DNS-CHECK: the category name resolves to a real address while the host is shown and the controls resolve | PAUSE. Record it as evidence; it may be V2-type evidence of a system-path failure. The Tech Lead decides. | §E.2 |
| S-UNCL | An observation fits none of the row's M2-02 classes (for example: V7 cold start LOADED; V10 DNS works with 853 blocked) | PAUSE. Record it verbatim. The row is NOT MET until the Tech Lead decides. The runbook does not invent a class. | §I.3 |
| S-SAFE | Unexpected content (§9 rule 9); a real adult domain typed; Always-on or Lockdown turned on; a DNS or VPN app used outside V11; a setting changed by automation | STOP. Restore the settings. Record without explicit detail. Tech Lead review. | §E.3 |
| S-CONN | The device is left without connectivity and the standard-Settings recovery does not work | Restore Private DNS to the as-found value at once, and record. In V10 this is also the RJ5 evidence. | §E.3, V10 |
| S-SCOPE | Any wish to change the H21 set, the networks, the test names or any criterion after a result | STOP. This is a separate Tech Lead scope decision, followed by re-evaluation, and never a pass. | §I.3, §L H21 |
| S-ENV | API < 28; a work profile, MDM or device owner; `adb` lost; another VPN or DNS app found | PAUSE or STOP as the Tech Lead decides. Affected rows are NOT RUN or NOT MET, with the reason. | §A.2, §E.3 |
| S-REGION | Device country ≠ network country (§8 step 2) | PAUSE before V3. The Tech Lead decides which region the claim names (Q12). | §I.1 |

---

## 13. Final classification

M2-02 §I.3 decides the outcome. This section is a worksheet for the Tech Lead. The runbook, and AI,
record no outcome.

### 13.1 Where each criterion comes from

| AC | Criterion (M2-02 §I.2) | Rows | From this runbook? |
|---|---|---|---|
| AC1 | The oracle is valid, judged on the category name only | V0 | Yes |
| AC2 | The mechanism is active on Wi-Fi and on cellular | V1 | Yes |
| AC3 | The system path is blocked on Wi-Fi and cellular, and the controls resolve | V2 | Yes |
| AC4 | Every H21 row is COVERED under the §I.1 run rules | V3 | Yes |
| AC5 | Blocking persists after a reboot with no app running, and across Wi-Fi ↔ cellular | V6, V8 | Yes |
| AC6 | *Summary; the full wording is in M2-02 §I.2:* T2 register classes supported by gate evidence; friction runs for B1–B4 and B6–B9; V9 classified | V4, V5, V7, V9–V13; §E.6 friction runs | **Partly.** The V-row part is from here. The friction runs are issue #41. DETECTED classes, and B11 and B12 COVERED, stay *expected* until V14–V15. |
| AC7 | Behavior when the resolver is unreachable or behind a captive portal is documented, with a working recovery path through standard Settings | V10 | Yes |
| AC8 | H18 is accepted for production | — | **No.** A Tech Lead decision. |
| AC9 | Gate G0 (H18 verification scope, H19, H21) was recorded before the first device row | — | Yes: the §2.1 record time and the V1 start time |

**Consequence (from M2-02 §I.3; not a runbook rule).** V0–V13 alone cannot produce PASS. AC6 also
needs the friction runs, and AC8 needs the Tech Lead's H18 production decision. If no RJ condition
holds, the outcome stays **INCOMPLETE** until both exist. §I.3 names "H18 for production is not
yet decided" as an INCOMPLETE cause.

### 13.2 Outcome worksheet (apply in order; M2-02 §I.3)

```text
A8 OUTCOME WORKSHEET — filled in by the Tech Lead only

Step 1 — NOT VERIFIABLE?
  H19b approved: yes / no      Validated equivalent recorded (U15): yes / no
  H19b not approved and no validated equivalent → OUTCOME = NOT VERIFIABLE (A8 not accepted; no device row runs). Stop here.

Step 2 — Any rejection condition?
  RJ1 V0 oracle invalid:                                   yes / no   (evidence: )
  RJ2 V1 or V2 fails on the target device, normal networks: yes / no
  RJ3 any H21 row BYPASS (V3):                             yes / no   (Q17: BYPASS in a "part of V3" run: ____)
  RJ4 blocking does not survive a reboot (V6):             yes / no
  RJ5 V10 leaves the user without connectivity or recovery: yes / no
  RJ6 H18 rejected for production:                         yes / no / not decided
  Any yes → OUTCOME = FAIL — candidate (RJ: ____). Follow-up per the RJ table; each is a separate decision.

Step 3 — All acceptance criteria?
  AC1 __  AC2 __  AC3 __  AC4 __  AC5 __  AC6 __  AC7 __  AC8 __  AC9 __
  All hold → OUTCOME = PASS.

Step 4 — Otherwise → OUTCOME = INCOMPLETE.
  Causes (for example: row NOT MET after its extra run; default not established; friction runs missing; AC8 not decided):
  Rows to re-run once the cause is removed (same registered scope):
  Note: a BYPASS found on any run stays a FAIL.

Outcome: PASS / FAIL — candidate / NOT VERIFIABLE / INCOMPLETE
Recorded by (Tech Lead): ______________   Date: ________   Report commit: ________
```

### 13.3 The four outcomes and the rejection conditions (M2-02 §I.3, verbatim)

| Outcome | When | Result |
|---|---|---|
| **PASS** | AC1–AC9 all hold | A8 is accepted as the production filter architecture. The ADR can be accepted, and M3 task contracts follow. |
| **FAIL — candidate** | Any of RJ1–RJ6 | A8 is not accepted for the registered scope. The follow-up comes from the RJ row below. |
| **NOT VERIFIABLE** | H19b not approved and no validated equivalent exists (§E.1) | A8 is not accepted, and no device row runs |
| **INCOMPLETE** | An AC is not met and no RJ condition holds: for example, an H21 row is NOT MET because it is still INCONCLUSIVE after its extra run, a browser's default could not be established (§I.1), or H18 for production is not yet decided | A8 is not accepted yet. The cause is recorded, and only the affected rows are run again once it is removed, under the same registered scope. A BYPASS found on any run stays a FAIL. |

| ID | Rejection condition | Follow-up (each a separate decision) |
|---|---|---|
| RJ1 | Oracle invalid: the category name is not blocked by the family tier, or is also blocked by the unfiltered resolver (V0) | A new V0 with another provider that meets §G.6, or reopen A2 (§D.4) |
| RJ2 | The mechanism or the system path fails on the target device on normal networks (V1, V2) | Reopen A2 |
| RJ3 | Any H21 row is BYPASS (V3) | Reopening A2 does not help, because A2 has the same browser-level gap. A scope change is possible (below). |
| RJ4 | Blocking does not survive a reboot (V6) | Reopen A2 |
| RJ5 | V10 shows the user can be left without connectivity and without a clear standard recovery path | Reopen A2, or narrow the supported networks through a scope change |
| RJ6 | H18 is rejected for production | A2 or recovery-only (H12) |

**A scope change is not a pass** (§I.3). After a FAIL or an INCOMPLETE, the Tech Lead may record a
separate scope decision, for example removing a browser from H21 or narrowing the supported
networks. The record then shows, in order:

1. the original outcome;
2. the scope decision;
3. the re-evaluation, re-running only the affected rows.

After a PASS, the claim covers only COVERED rows (H10), and DISCLOSED rows become its stated
limitations.

---

## 14. A8 remains a verification candidate only

**A8 remains a verification candidate only.**

- This runbook does not approve A8 for production, and it does not record G0, H18, H19, H21 or
  any other decision.
- No V-row starts until G0 is complete **and** the §2.5 decision-critical outcome/privacy rules are
  frozen in the authoritative M2 record.
- No outcome exists until the rows are executed and the Tech Lead applies §13 to a committed,
  classified report.
- Even then, only an M2-02 §I.3 PASS, together with H18 accepted for production and the Tech
  Lead's final ADR (M2-03 §5), makes A8 the production filter architecture.
- M3 remains blocked (M2-03 §6), and `filteringOperational` stays `false`.

---

## 15. Ambiguities found in M2-02 and the runbook readings

M2-02 leaves these points open. Each reading is the runbook's proposal, chosen so that it can never
yield a PASS or COVERED that M2-02's own wording would not yield.

**Review rule added after independent review:** the table below is not a list of twenty-three
automatic human gates. Before V0, each Q-reading must be marked **DECISION-CRITICAL** or
**PROCEDURAL-ONLY** under §2.5. Decision-critical readings are frozen before the affected result is
observed. Procedural-only readings may remain runbook defaults only when they cannot improve a
result, suppress a bypass, change privacy exposure, or widen the claim.

The five outcome-mapping questions and the three extra-provider privacy flows in §2.5 remain
explicit execution blockers until their authoritative decision record exists.

### 15.1 Tech Lead classification freeze — 2026-09-26

The Tech Lead approved the following split before execution:

- **DECISION-CRITICAL:** Q1, Q2, Q5, Q7, Q8, Q9, Q10, Q11, Q13, Q14, Q16, Q17, Q19, Q21, Q22, Q23.
- **PROCEDURAL-ONLY:** Q3, Q4, Q6, Q12, Q15.
- **RESOLVED BY SEPARATE FROZEN MAPPINGS:** Q18 and Q20.

**Tech Lead decision (2026-09-26): all remaining DECISION-CRITICAL Q-readings are APPROVED AS WRITTEN.**
The PROCEDURAL-ONLY readings remain the runbook defaults under the guardrail below.

Clarifications already frozen:
- Q16's V7 cold-start outcome semantics are governed by the approved V7 mapping; only the remaining
  browser/configuration choice stays decision-critical.
- Q17's "part of V3" outcome semantics are governed by the approved V8/V9/V11 mapping; only the
  remaining C1 browser/mode choice stays decision-critical.
- Q18 is covered by the approved V7, V8, V9 and embedded-"part of V3" mappings.
- Q20 is covered by the approved V10 partial-availability → AC7 mapping.

Procedural-only readings may be followed as defaults only if they do not improve a result, suppress
a bypass, change privacy exposure, or widen the claim.

| Q | Where | Gap in M2-02 | Runbook reading | Tech Lead |
|---|---|---|---|---|
| Q1 | §E.5, §I.1 | §E.5 says runs and repeats "follow §I.1", but §I.1 defines run rules only for T1 rows | T1 rows exactly as §I.1. Other browser-level rows: two runs, and a bypass in either run counts. DNS-level and signal rows: one run. (§6.4) | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q2 | §E.4 V0, V1, V5, V6, V8, V10–V13 | These rows list no INCONCLUSIVE class, and missing evidence has no class | Apply §E.2 ("control fails → INCONCLUSIVE, never PASS") and the §I.1 extra-run rule. A row still unresolved is NOT MET, which feeds INCOMPLETE. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q3 | §I.1 step 5, §E.3 | When "afterwards" is, for restoring a browser setting | Before the checkpoint of every row that changed it, and at every session end | [ ] accept / amend: |
| Q4 | §E.3, §E.5 | "Redact … IP addresses" versus "the first `ping` line (name and address)" | Keep the answer address for test names and controls; redact every other address | [ ] accept / amend: |
| Q5 | V0 | A desktop network that intercepts or filters DNS could produce a false RJ1. `dig` may not be installed. | Record the desktop network. An INVALID stands as recorded. The Tech Lead decides on a pre-recorded repeat from another network. `nslookup` is a recorded substitute (C10). | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q6 | §E.1, §L Sequence | Whether V0 runs if H19b is refused | V0 may run (it is not a device row and needs H19a only). It cannot change NOT VERIFIABLE. | [ ] accept / amend: |
| Q7 | V1, V2, RJ2 | What a "normal network" is. A network resolver (for example a carrier filter) that already blocks the category name. | V2 on that network is INCONCLUSIVE, because the block cannot be attributed; the Tech Lead judges "normal network" for RJ2. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q8 | V2 | Whether the system resolver cache is cleared between the Off baseline and the host-set lookup (UNKNOWN) | Off baseline first; after each Private DNS change in V2, reconnect the network before the lookups. V5 and V7 do not reconnect, because they measure the device as the user leaves it. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q9 | V3 | The network for V3 is not named | N-W (V8 covers cellular) | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q10 | V3 | "Error page with no content" does not require the error to come from the provider's block | Apply as written. Record the exact error text, and run an SC (DNS-CHECK) before each browser block as information. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q11 | §I.1 step 5 | The run count of characterization rows. Whether as-found rows run when a default cannot be established. | Two runs, never counted. Without an established default, no substitute rows run unless the Tech Lead decides. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q12 | §I.1 step 1 | The region is "the country of the device settings and of the network used", with no rule if the two differ | Record both. If they differ, pause before V3 (S-REGION). | [ ] accept / amend: |
| Q13 | V4, V13 | The browser mode is not stated | Normal mode (as M1-06 D2, D4, D5) | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q14 | V5 | The start state for each Private DNS change | Each change starts from the provider host, restored between sub-rows. V5-AUTO and V5-OFF give B1; V5-OTHER gives B2. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q15 | V6 | Whether "before opening any app" includes the Settings app | `adb` checks first; the Settings screenshot after them | [ ] accept / amend: |
| Q16 | V7 | The browser and its DNS setting are not named. A cold start that still loads the page has no class. | C1 browser at its V3 T1 setting. A cold start that still loads is NOT MET (S-UNCL). | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q17 | V8, V9, V11 | "Part of V3" is not defined. Whether a BYPASS there counts toward RJ3, which names V3. | C1 browser, one mode, two runs. The row records the result; the RJ3 question is answered in §13 by the Tech Lead. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q18 | V7, V8, V9; AC6 | These rows have no RJ condition, so under §I.3's wording an evidenced failure gives INCOMPLETE rather than FAIL. V9 is recorded as PASS / FAIL, but AC6 asks for COVERED / DISCLOSED. | Record the §E.4 classes only. The §I.3 mapping, and V9 PASS→COVERED and FAIL→DISCLOSED, are applied in the report after Tech Lead confirmation. | [ ] accept / amend: |
| Q19 | V9 | "Control usable" | The control resolves to a real IPv6 address. Whether the ping got a reply is recorded as information. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q20 | V10, AC7 | "If available" and AC7's "or": whether one sub-row is enough. No class if DNS keeps working with TCP 853 blocked; whether the installed Android reaches the provider only over TCP 853 is not established in M2-02. | An unavailable sub-row is NOT RUN with the reason, and the Tech Lead decides AC7. "DNS keeps working" is NOT MET (S-UNCL). | [ ] accept / amend: |
| Q21 | V12 | How to open a Custom Tab or WebView without new apps, and how to tell them apart | Installed apps chosen in C6. Confirm the in-app browser UI; `dumpsys activity` as optional stronger evidence. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q22 | V13 | "At default settings" for a non-H21 browser. H21's consent does not cover switching it. | A fresh install, or an as-found setting equal to a recorded default. Otherwise the Tech Lead's consent is recorded in C7. | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |
| Q23 | V1 | Which `dumpsys` output shows "strict mode active". No class if `connectivity` and `dnsresolver` disagree (U9 is open). | PASS needs both sources, because M2-02 names both as V1's evidence. FAIL needs both to agree that it is not active. A disagreement is NOT MET (S-UNCL). | **ACCEPTED AS WRITTEN — Tech Lead, 2026-09-26** |

**Data flows outside H18** (noted with C2, C3 and C5, not a reading). H18 covers sending the test
device's DNS to the provider under verification only. V4 (Chrome's DoH provider), V5-OTHER (the
other Private DNS host) and V11 (the VPN operator) send some traffic to other parties while those
rows run. M2-02 requires these actions but does not cover these flows in H18.

---

## Sources

- [M2-02 — Protection Architecture Baseline][m2-02]: §E.1–§E.6, §I.1–§I.3, §K, §L (authoritative)
- [M2-03 — Architecture ADR: Human Decision Package][m2-03]: §2, §3 (G0), §4, §5, §6
- [M2-01 — Approved Threat Model][m2-01]: H4, H5, H10
- [M1-06 coverage gate][m1-06]: the runbook format, and precedent for the browser paths, force-stop
  resets and query-string IDs
- [Issue #39](https://github.com/takh86/ai-engineering-lab/issues/39) (M2-03A and G0),
  [issue #40](https://github.com/takh86/ai-engineering-lab/issues/40) (this task),
  [issue #41](https://github.com/takh86/ai-engineering-lab/issues/41) (friction runs)

[m2-01]: m2-01-approved-threat-model.md
[m2-02]: m2-02-architecture-options.md
[m2-03]: m2-03-architecture-adr.md
[m1-06]: m1-06-coverage-gate.md

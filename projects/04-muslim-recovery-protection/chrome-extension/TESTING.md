# Tabsira 1.1.0 verification

The current feature contract is [docs/final-features/CONTRACT.md](docs/final-features/CONTRACT.md). Historical feature results are recorded in [docs/final-features/REVIEW.md](docs/final-features/REVIEW.md); subsequent local corrections and limits are in [docs/final-features/FOLLOWUP-REVIEW.md](docs/final-features/FOLLOWUP-REVIEW.md). Neither certifies this integration.

Unit tests exercise strict schemas, sender capabilities, schedules including weekly wrapping, password encryption/recovery, commitment concurrency and storage fencing. They use simulated browser adapters; they do not prove browser integration. Static checks examine packaged module imports, CSP, locale coverage, approved tokens, the licensed snapshot and reproducible ZIPs.

`tests/e2e/final-features.mjs` extracts the actual Chromium release ZIP, launches an installed extension, and checks core enforcement, extra domains, schedules, all three UI languages, password/private-data gates, recovery invariance, help-page capabilities and logged errors. Test sites resolve to a local server; real adult sites are never requested. Results are in `test-evidence/final-features-chromium.json`. Failure to launch is `NOT_RUN`, with a nonzero exit code. Permission activation and actual delivered prayer notifications still require explicit browser coverage; pure calculations and notification lifecycle tests are reported separately.

```sh
npm ci
npm test
npm run build
npm run verify-reproducible
node node_modules/playwright-core/cli.js install --with-deps chromium
node tests/e2e/final-features.mjs
```

The dedicated GitHub workflow runs those checks. It does not merge the PR or publish to a store.

Older `tests/e2e/suite.mjs`, Firefox suites and `test-evidence/SUMMARY.md` are historical 1.0.0 evidence. Some older assertions (optional core, core exceptions and old onboarding DOM) contradict the owner's final requirements. They are not the 1.1.0 acceptance suite and their old results must not be represented as current verification.

## Integrated tree: verification pending

The imported frozen 1.0.1 branch ends at `efc7357`; the feature follow-up branch ends at `1817d0a`. Integrated source, dependency graph, regression suites and packaged browser behavior must be rechecked. Historical 112/112, 161/161, 184 browser checks and 57 feature checks belong to their respective earlier trees. A browser launch failure is NOT_RUN, not PASS.

## Historical frozen 1.0.1 / 1.0.0 register

The following register is preserved from the imported branch. Its package fingerprints and results refer only to those frozen packages. Its manual steps describe older behavior: switching off or exempting the core is no longer supported, commitment duration/early exit has changed, and additional optional permissions/private features require new checks. Do not use the historical steps as the integrated release acceptance checklist.


## 1.0.1 status (pre-release review) — read this first

Package under test: `tabsira-chromium-1.0.1.zip` SHA-256 `61942949005aa35c07b7cff1ad90ffd735812618234c8a545146d9489712b700`, `tabsira-firefox-1.0.1.zip` SHA-256
`82d1e64ebf8c90da85e57257a6f20877b433a558c9a20eb7f3c45d79bc6ea47b`, built byte-identically three times from clean archives of the frozen commit `f57bc8c` (later commits change tests/docs/evidence only; verified by rebuilding).
Real-browser runs on those packages after unzipping (Linux x64, headless): Chromium 141.0.7390.37, Chrome for Testing 154.0.8037.97 (not branded stable Chrome), Edge 154.0.4258.53: **184 PASS · 0 FAIL · 2 NOT_RUN** each
(S7.14 clock change, S8.5 dropping a required permission); Firefox 157.0: 44 PASS · 1 NOT_RUN (F1.3b); Firefox 157.0 private windows: 11 PASS. Unit: 112/112. Evidence: `test-evidence/e2e-*.json`, `SUMMARY.md`, review material in `test-evidence/review-1.0.1/`.
**Incomplete (not PASS):** `test-evidence/incomplete-f57bc8c/` — three runs that crashed at S16c (outdated test premise) before writing a summary.
Everything below this section describes 1.0.0 and earlier evidence; hashes and counts there are **historical** for those packages. Full register: `docs/RELEASE-REVIEW-1.0.1.md`.

Three layers, kept separate on purpose:

1. **Unit / static (`npm test`, no browser).** Pure logic, the controller against a *test double* of the browser API
   (fault injection, restarts, races), message validation, locale parity, manifest/CSP/permission checks, byte-reproducible build.
   **A test double is not evidence of how a real browser behaves**; it only exercises our own logic.
2. **Real-browser acceptance** (`tests/e2e/`). The built extension is loaded into a real browser and driven through real
   navigations, real `declarativeNetRequest`, real storage, real extension pages. Evidence: `test-evidence/e2e-*.json` and the
   generated `test-evidence/SUMMARY.md` (browser, version, OS, date, every check with PASS / FAIL / NOT_RUN).
3. **Manual device checks** (below) — not done here; needed before relying on a release.

No check was relaxed to turn a result green. Where a browser could not do something, the check is `NOT_RUN` with the reason.

## Environment used for the real-browser runs

**The browsers ran the built release ZIPs, extracted with the system `unzip`** (`tests/e2e/package.mjs`). Variants are derived from the release package by
editing `manifest.json` only, and the harness fails if any other file differs: `release` (unmodified; most checks), `test` (+ `declarativeNetRequestFeedback`, only for
the checks calling `testMatchOutcome`: base-list sampling S3 and match timing S11), `optional` (host access optional, for the "permission missing" state S8),
`live` (a copy whose manifest version is raised in place for the update test S7.11–S7.13). Evidence files record the ZIP path and SHA-256.

Package under test (frozen code commit `608251e` (logic identical to `f6b0eb6`; only brand assets, icons and the image sizes in five HTML files changed); later commits change only documentation and evidence — verified by rebuilding):
`tabsira-chromium-1.0.0.zip` SHA-256 `2e1c886f2e0318855213ec5d8b49fadb971bc2f4b79ab028bb44ab0a6ac56460`,
`tabsira-firefox-1.0.0.zip` SHA-256 `2a022b1529d1400a6cfa3d0b466a6c828ea2431428e0241a94c75d70818ca68e`.

**Name change (display name «تبصرة Tabsira», commit after `969e482`).** Only the `extName` string in the three locale files changed, so the packages above are the **current** ones. The full real-browser run was repeated **for Chromium 141 only** on this package (155 PASS, 2 NOT_RUN = S7.14, S8.5 as before; `test-evidence/e2e-chromium.json`). The Chrome for Testing, Edge, Firefox and Firefox-private evidence files, and `SUMMARY.md`, still record the previous SHA-256 values (`c58ecb74…`, `c5dade24…`); they were **not** re-run for the name change.

Linux x64 sandbox, headless (`--headless=new` for Chromium-family). Test sites resolve to a local server (`--host-resolver-rules` for Chromium-family, a local HTTP proxy
for Firefox); no real website — and no listed adult domain — was ever contacted. The base list is exercised with `testMatchOutcome` (never sends a request) and the reserved safe-test domain.

| Browser | Exact build | Source |
|---|---|---|
| Chromium | 141.0.7390.37 | Playwright build (open-source Chromium — **not** "Google Chrome") |
| **Google Chrome for Testing** | 154.0.8037.97 | Google's official Chrome-for-Testing download (`storage.googleapis.com/chrome-for-testing-public`), ZIP SHA-256 `487c3b0e…c7a2`. It is Google's official build for automation, **not the branded stable Chrome** installer (`dl.google.com` was not reachable). |
| Microsoft Edge | 154.0.4258.53 | Linux .deb from packages.microsoft.com, unpacked |
| Mozilla Firefox | 157.0 | conda-forge repackaging of the Mozilla release; geckodriver 0.37.1; add-on installed temporarily |

## Requirement matrix → checks

| Required test | Where |
|---|---|
| Fresh install, default list, clear status | S1.*, S2.4 · F1.*, F2.* |
| Blocked domain and its subdomains | S4.1, S3.1–S3.2 · F3.1 |
| Similar-looking domain not blocked | S4.1, S3.3–S3.4, S3.5 (140 known-benign sites) · F3.1 |
| List = the two licensed sources only, enforced in the real ruleset | S1.4/F1.2 (exactly 242,750 domains), S3.5b (names from the previous snapshot that the licence-only rule removed are NOT matched), S3.5c/S3.5d/S3.5e (ShadowWhisperer-only, Sinfonietta-only and in-both samples ARE matched); unit test pins commits, blobs, hashes, licence texts and notices |
| Exception precedence | S3.9, S4.2–S4.3 · F3.2–F3.3 |
| Arabic/English phrases, encodings, engines, boundaries | S5.* · F4.* |
| Normal vs private window, permission granted / not granted | S9.* (Chromium-family) · **F9.\* (Firefox private windows, both cases)** |
| **Concurrent normal + private instances, real storage, paused real worker** | **S16.1–S16.4** |
| **Terminated worker after a stale RULE write (review of 516a4ff): recovery without opening any extension page** | **S16d.1–S16d.4**, Firefox **F10.1**, `watchdog.test.mjs` |
| **Late DELETE (review of 0b46c1d): cleanup frozen at the real `storage.remove`, expired session key re-used by a new session, real normal + private instances** | **S16c.1–S16c.4** (simulation: `lock-cleanup.test.mjs`) |
| **Late write (review of 7294cd6): frozen save resumed after lease expiry + newer save + session start, real normal + private instances** | **S16b.1–S16b.4** (simulation: `late-writes.test.mjs`) |
| Restart / update / service-worker restart | S7.8–S7.13 · F6.* |
| Permission missing / withdrawn | S8.1–S8.4 · S8.5 NOT RUN (Chromium refuses to drop a *required* permission) · F6b |
| DNR / storage failure and rollback | S13.1–S13.4 + unit tests |
| Commitment — every settings path | S7.1–S7.7, S9.7–S9.8, F5.*, F9.6 |
| Redirects, no loops | S6.1–S6.2, S2.8 |
| No sensitive logging; no URL/search text left in extension storage | S10.1–S10.2, **S17.4** |
| Realistic-list performance | S11.* (and F8) |
| Keyboard, focus, RTL, contrast | S12.* |
| **Identity: fonts, colours, lime action, mark, no safety claims, no "stop protection" action** | **S15.3** (5 pages × ar/de/en × light/dark) |
| **Layout: no scroll/clipping at normal size, 200 % text, 320 px width** | **S15.4** |
| **State by text + icon, not colour alone** | S15.1–S15.2 + `tokens.test.mjs` |
| Import/export | S14.* + unit tests |
| Concurrency, sender boundary, CSP, malformed messages | S13.5–S13.9 + unit tests |
| **Hostile page cannot reach the extension; no leakage** | **S17.1–S17.4** |

## Results (final run on the frozen packages, 2026-10-02)

| Browser | Version / OS | PASS | FAIL | NOT RUN |
|---|---|---|---|---|
| Chromium | 141.0.7390.37 · Linux x64 | 155 | 0 | 2 |
| **Google Chrome for Testing** | 154.0.8037.97 · Linux x64 | 155 | 0 | 2 |
| Microsoft Edge | 154.0.4258.53 · Linux x64 | 155 | 0 | 2 |
| Mozilla Firefox (temporary add-on) | 157.0 · Linux x64 | 44 | 0 | 1 |
| **Mozilla Firefox — private windows** | 157.0 · Linux x64 | 11 | 0 | 0 |

NOT RUN, with reasons: **S7.14** device-clock change (the OS clock cannot be changed here; behaviour documented); **S8.5** dropping a *required* host permission
(Chromium refuses: "You cannot remove required permissions"; the missing-permission state itself is covered by S8.1–S8.4); **F1.3b** Arabic UI inside Firefox (needs the Arabic language pack;
Arabic/RTL rendering is verified in the three Chromium-family browsers).
Every check, result and detail: [`test-evidence/SUMMARY.md`](test-evidence/SUMMARY.md) and the JSON files beside it.
Unit/static: `npm test` → 86 tests, 0 failures (core, controller with fault injection, concurrency, late-write, late-delete (`lock-cleanup`), records and watchdog tests, adversarial inputs, tokens/contrast, messages, locales, manifest/CSP/permissions, list provenance, byte-reproducible ZIPs).

### Regression evidence (tests that fail before the fix)

| Test | Failing output on the old code |
|---|---|
| `concurrency.test.mjs` (paused save vs session start, 9 tests) | `tests/unit/regression-on-d662632.expected-failure.txt` (8 of 9 fail on `d662632`) |
| `concurrency.test.mjs` "repair paused BEFORE its rule write" | `tests/unit/regression-stale-repair-before-fix.expected-failure.txt` |
| **real-browser S16d against the `516a4ff` package** | `tests/unit/regression-s16d-real-browser-on-516a4ff.expected-failure.txt` — S16d.3 fails: rules stay EMPTY and the newer sites stay unblocked for the whole 170 s observation (no Popup/Options/GET_STATUS/REPAIR); only opening an extension page repairs them |
| `lock-cleanup.test.mjs` (review of `0b46c1d`: frozen cleanup of an expired / extended session key, of epoch entries; late lock/epoch writes; mutex entries) | `tests/unit/regression-lock-cleanup-on-0b46c1d.expected-failure.txt` (3 of 7 fail on `0b46c1d`: new session wiped, session shortened 120 → 90 min, epoch entry lost) |
| **real-browser S16c against the `0b46c1d` package** | `tests/unit/regression-s16c-real-browser-on-0b46c1d.expected-failure.txt` — S16c.3/S16c.4 fail: the new 120-minute session is gone, the save that deletes every site is **accepted**, sites `[]`, nothing blocked |
| `late-writes.test.mjs` (review of `7294cd6`: frozen write at the config write, import, rollback, rule write, record removal) | `tests/unit/regression-late-writes-on-7294cd6.expected-failure.txt` (6 of 9 fail on `7294cd6`; the other 3 are guards or check the new layout) |
| **real-browser S16b against the `7294cd6` package** | `tests/unit/regression-s16b-real-browser-on-7294cd6.expected-failure.txt` — S16b.3 fails: stored sites `[]`, state `not_configured`, nothing blocked, session still active, the late save reports `ok` |
| real-browser S16 against the old package | `tests/unit/regression-s16-real-browser-on-d662632.expected-failure.txt` (4 of 5 fail; the real browser shows a different failure mode, see `tabsira-security-review.md` F1) |

### Measured browser limits and cost of the 242,750-domain list (ShadowWhisperer ∪ Sinfonietta)

| Measurement | Chromium 141 | Chrome for Testing 154 | Edge 154 | Firefox 157 |
|---|---|---|---|---|
| Rules the list uses (one rule, `requestDomains` array) | 1 of 329,999 available static rules | same | same | no such limit reported |
| Documented constants read from the API | dynamic 30,000 · unsafe dynamic 5,000 · **regex rules 1,000** · guaranteed static 30,000 · rulesets 100 / enabled 50 | same | same | not exposed the same way |
| Time to enable the list | ≈ 0.11 s | ≈ 0.06 s | ≈ 0.07 s | ≈ 1.5 s (onboarding + enable) |
| Median navigation, list off → on (25 loads, local server) | 32 → 28 ms | 33 → 35 ms | 44 → 44 ms | 96 ms with list on (15 loads, local proxy) |
| Per-URL match cost (`testMatchOutcome`) list / phrase rules | 0.42 / 0.37 ms | 0.49 / 0.33 ms | 0.37 / 0.45 ms | n/a |
| Browser memory, list off → on (sum of resident set of all browser processes) | 868 → 876 MB | 1076 → 1084 MB | 1003 → 1016 MB | 1113 → 1351 MB (whole browser, noisy) |
| Extension ready after cold start | ≈ 0.8 s | ≈ 1.1 s | ≈ 1.0 s | not measured |

Interpretation: on Chromium-family browsers the list is cheap (a memory-mapped index built on install). Firefox needs about one to two seconds and a few hundred MB (whole-browser, noisy) to enable it —
acceptable on a desktop, a reason to offer a smaller list for Firefox/Android if the Owner wants one. Numbers come from a headless Linux sandbox and a loopback server:
relative evidence, not a real-world benchmark. Contrast measured on the real pages (light/dark): text 14.3/14.9, hints 7.7/8.4, primary button 7.0/9.2, secondary 10.3/18.4 (all ≥ 4.5).
The phrase-length limits (Arabic ≈ 12–14 letters per whole-word rule in Chromium, much higher in Firefox) are unchanged from the first release candidate.

## Real-browser findings that changed the code (not visible to mocks)

1. **Regex memory:** one Arabic phrase of 60 letters cannot compile in Chromium (2 KB regex memory); the prototype would have refused
   or mis-saved it. Packing is now per search parameter, boundary alternatives were minimised (word-mode capacity ≈ 12–14 Arabic letters), and a
   test asserts every starter phrase compiles in a real browser. Firefox accepts much longer phrases.
2. **`chrome.storage` returns objects with sorted keys.** A naive JSON compare after writing reported false conflicts; comparison is now structural
   (and the test double sorts keys too).
3. **Private windows (Chromium):** with the default `spanning` incognito mode Chromium *redirects but cannot display* the stop page in a private window
   (`ERR_BLOCKED_BY_CLIENT`). `incognito: "split"` shows it, and the two instances were verified to share `storage.local`, so the commitment holds.
4. **`web_accessible_resources`:** not needed in Chromium (removed → no fixed-ID fingerprint); **required in Firefox** for the redirect (added for
   `blocked.html` only; Firefox hosts are random per-profile UUIDs).
5. **The browser keeps the blocked address in its own history** (S17 note): not under the extension's control, now stated in the privacy policy and README.
6. **Text-zoom layout:** at 200 % text size plus a 320 px viewport the help page timer ring (fixed 11 rem) overflowed; it is now `min(11rem, 100%)` (found by S15.4).
7. **A terminated worker leaves stale rules until something wakes the extension** (review of `516a4ff`): measured in real Chromium — empty rules, no recovery for 170 s; fixed with the `alarms` watchdog (32 s in the tests; see README "Recovery" for the exact conditions). **A delayed removal could wipe a newer session that re-used its storage key** (independent review of `0b46c1d`): state keys are now write-once under unique names and cleanup removes only entries dominated for ever (S16c, `lock-cleanup.test.mjs`). **A frozen write could replace the whole configuration** (independent review of `7294cd6`): re-checking ownership before a non-atomic write cannot prevent it, so storage became append-only and fenced by a lock epoch (S16b, `late-writes.test.mjs`). **A paused repair past its lease could leave stale rules** (unit regression, fixed); **a paused real worker** in the normal window and a START_SESSION from the private window
   behave as designed in a real browser (S16).
8. A service-worker deadlock (status repair queued behind itself) was found by the unit suite before any browser run.

## Known harness limits (reasons for NOT_RUN or manual steps)

- `chrome.runtime.reload()` / toggling "Allow in Incognito" in `chrome://extensions` break a **command-line-loaded** unpacked extension in headless
  Chromium; the update path is therefore tested by relaunching the same profile with a higher version, and the incognito permission by setting the
  profile preference the toggle writes (the status report `incognitoAllowed` is checked before and after).
- Native permission prompts cannot be answered by automation, so the "user grants website access" flow is **NOT RUN**; the missing-permission *state* is.
- The OS clock cannot be changed here → clock-change effect **NOT RUN** (behaviour documented).
- **Branded stable Google Chrome**, Windows/macOS, Brave, Opera, real devices: **NOT TESTED** (Chrome *for Testing* 154 was tested instead and is labelled as such).
- **Recovery time is measured once per browser** (32 s Chromium/Chrome for Testing/Edge via S16d, 63 s Firefox via F10 in the final run; 53 s in the previous run); it depends on the phase of the 1-minute alarm and on the browser's timer coalescing, so treat it as "about a minute", not as a guarantee. A computer that sleeps fires the alarm on wake. In S16d the worker is terminated with CDP `ServiceWorker.stopAllWorkers` and the stale write is landed by releasing a gate in the real `declarativeNetRequest.updateDynamicRules`; the continuation after the write is made to hang so the reconcile path provably never runs.
- Firefox: add-on installed *temporarily* (restart = reinstall into the same profile); Arabic UI needs the Arabic language pack (NOT RUN here).
- Windows/macOS-specific store prompts and the signed AMO build: not testable here.
- **What is simulation and what is a real browser (concurrency).** `tests/unit/*` use a test double of the browser API: they pin the *logic* (every freeze point:
  config write, rule write, rollback rule restore, record removal, import, chain of three frozen writers) deterministically. S16/S16b/S16c use the **real** Chromium-family
  storage, rules, and two real worker instances (normal + private window); the "freeze" is a gate injected into the real worker's `chrome.storage.local.set` / `.remove` (not an OS-level
  suspension of the process), and the 20 s lease is waited out in real time. S16c cannot wait 60 real minutes for a session to end, so the test **ages the session entry in storage** (rewrites its end time to the past) to represent the ended session — a test-only fabrication of expiry, stated here. Firefox runs a single shared background for normal and private windows, so the two-instance
  scenarios (S16–S16c) do not arise there; Firefox concurrency is covered by the simulation only.

## Manual steps before relying on a release (Owner / device)

Run on your real Chrome and Edge (Windows/macOS) and on Firefox release with the **signed** build:

1. Install the ZIP (or unpacked folder). Onboarding opens; finish it with defaults. Status says rules installed.
2. Open `https://tabsira-selftest.test/` → the Tabsira stop page appears. Reload it: no loop.
3. Add `example.com` → open `https://example.com` and `https://www.example.com` → blocked; `https://example.org` → loads. Remove it afterwards.
4. Add the phrase `tabsira test`; search it on Google/Bing/YouTube → blocked; an ordinary search → loads. Repeat with an Arabic phrase ≤ 12 letters.
5. With the built-in list on, add an exception for the reserved `tabsira-selftest.test` (it is covered by the list) → it loads instead of the stop page; remove the exception afterwards. (Never open a real listed site to test this.)
6. Start a 60-minute session. Try: delete a site, switch off the list, add an exception, import a weaker file, reset → each refused with a clear message.
   Add a new site → allowed. Close and reopen the browser → session and rules persist.
7. Enable the private-window switch; repeat steps 2–6 in a private window (Chrome/Edge show the stop page; Firefox too).
8. Disable then re-enable the extension and restart the browser → popup shows rules installed again (nothing silently lost).
9. In `chrome://extensions` withdraw site access ("on click") → popup/badge show the permission problem.
10. Check the extension error page shows no errors; keyboard-only navigation of settings; Arabic RTL and German display.
11. Clock (documented limit): with a session active, set the clock back 30 min → remaining time grows by about 30 min; set it forward past the end → the session ends early and expired entries are cleaned at the next write operation (moving the clock back again does not revive it).
12. Sleep/wake with a session active → settings, session and rules intact; any rules mismatch is rebuilt by the watchdog within about a minute.

A step-by-step version with a results table: [`docs/OWNER-HANDOVER.md`](docs/OWNER-HANDOVER.md).

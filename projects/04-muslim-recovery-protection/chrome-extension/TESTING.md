# Testing — what ran, where, and what did not

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

Package under test (frozen code commit `89a2905`; later commits change only documentation and evidence — verified by rebuilding):
`tabsira-chromium-1.0.0.zip` SHA-256 `4c75a9e22f5e2295802c735469640fca05a66ea75f66b7fe68de3386293fcde5`,
`tabsira-firefox-1.0.0.zip` SHA-256 `94bf51ab86da823c235dd2718868a8512386eec4310d27d00d8c2f26ff0f94dc`.

Linux x64 sandbox, headless (`--headless=new` for Chromium-family). Test sites resolve to a local server (`--host-resolver-rules` for Chromium-family, a local HTTP proxy
for Firefox); no real website — and no listed adult domain — was ever contacted. The base list is exercised with `testMatchOutcome` (never sends a request) and the reserved safe-test domain.

| Browser | Exact build | Source |
|---|---|---|
| Chromium | 141.0.7390.37 | Playwright build (open-source Chromium — **not** "Google Chrome") |
| **Google Chrome for Testing** | 154.0.8037.97 | Google's official Chrome-for-Testing download (`storage.googleapis.com/chrome-for-testing-public`), ZIP SHA-256 `487c3b0e…c8a2`. It is Google's official build for automation, **not the branded stable Chrome** installer (`dl.google.com` was not reachable). |
| Microsoft Edge | 154.0.4258.53 | Linux .deb from packages.microsoft.com, unpacked |
| Mozilla Firefox | 157.0 | conda-forge repackaging of the Mozilla release; geckodriver 0.37.1; add-on installed temporarily |

## Requirement matrix → checks

| Required test | Where |
|---|---|
| Fresh install, default list, clear status | S1.*, S2.4 · F1.*, F2.* |
| Blocked domain and its subdomains | S4.1, S3.1–S3.2 · F3.1 |
| Similar-looking domain not blocked | S4.1, S3.3–S3.4, S3.5 (140 known-benign sites) · F3.1 |
| List provenance enforced in the real ruleset | S3.5b (domains removed for unclear licence are NOT matched), S3.5c (ShadowWhisperer-only domains ARE matched) |
| Exception precedence | S3.9, S4.2–S4.3 · F3.2–F3.3 |
| Arabic/English phrases, encodings, engines, boundaries | S5.* · F4.* |
| Normal vs private window, permission granted / not granted | S9.* (Chromium-family) · **F9.\* (Firefox private windows, both cases)** |
| **Concurrent normal + private instances, real storage, paused real worker** | **S16.1–S16.4** |
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
| Chromium | 141.0.7390.37 · Linux x64 | 149 | 0 | 2 |
| **Google Chrome for Testing** | 154.0.8037.97 · Linux x64 | 149 | 0 | 2 |
| Microsoft Edge | 154.0.4258.53 · Linux x64 | 149 | 0 | 2 |
| Mozilla Firefox (temporary add-on) | 157.0 · Linux x64 | 43 | 0 | 1 |
| **Mozilla Firefox — private windows** | 157.0 · Linux x64 | 11 | 0 | 0 |

NOT RUN, with reasons: **S7.14** device-clock change (the OS clock cannot be changed here; behaviour documented); **S8.5** dropping a *required* host permission
(Chromium refuses: "You cannot remove required permissions"; the missing-permission state itself is covered by S8.1–S8.4); **F1.3b** Arabic UI inside Firefox (needs the Arabic language pack;
Arabic/RTL rendering is verified in the three Chromium-family browsers).
Every check, result and detail: [`test-evidence/SUMMARY.md`](test-evidence/SUMMARY.md) and the JSON files beside it.
Unit/static: `npm test` → 85 tests, 0 failures (core, controller with fault injection, concurrency, late-write, late-delete (`lock-cleanup`) and records tests, adversarial inputs, tokens/contrast, messages, locales, manifest/CSP/permissions, list provenance, byte-reproducible ZIPs).

### Regression evidence (tests that fail before the fix)

| Test | Failing output on the old code |
|---|---|
| `concurrency.test.mjs` (paused save vs session start, 9 tests) | `tests/unit/regression-on-d662632.expected-failure.txt` (8 of 9 fail on `d662632`) |
| `concurrency.test.mjs` "repair paused BEFORE its rule write" | `tests/unit/regression-stale-repair-before-fix.expected-failure.txt` |
| `lock-cleanup.test.mjs` (review of `0b46c1d`: frozen cleanup of an expired / extended session key, of epoch entries; late lock/epoch writes; mutex entries) | `tests/unit/regression-lock-cleanup-on-0b46c1d.expected-failure.txt` (3 of 7 fail on `0b46c1d`: new session wiped, session shortened 120 → 90 min, epoch entry lost) |
| **real-browser S16c against the `0b46c1d` package** | `tests/unit/regression-s16c-real-browser-on-0b46c1d.expected-failure.txt` — S16c.3/S16c.4 fail: the new 120-minute session is gone, the save that deletes every site is **accepted**, sites `[]`, nothing blocked |
| `late-writes.test.mjs` (review of `7294cd6`: frozen write at the config write, import, rollback, rule write, record removal) | `tests/unit/regression-late-writes-on-7294cd6.expected-failure.txt` (6 of 9 fail on `7294cd6`; the other 3 are guards or check the new layout) |
| **real-browser S16b against the `7294cd6` package** | `tests/unit/regression-s16b-real-browser-on-7294cd6.expected-failure.txt` — S16b.3 fails: stored sites `[]`, state `not_configured`, nothing blocked, session still active, the late save reports `ok` |
| real-browser S16 against the old package | `tests/unit/regression-s16-real-browser-on-d662632.expected-failure.txt` (4 of 5 fail; the real browser shows a different failure mode, see `tabsira-security-review.md` F1) |

### Measured browser limits and cost of the 714,093-domain list

| Measurement | Chromium 141 | Chrome for Testing 154 | Edge 154 | Firefox 157 |
|---|---|---|---|---|
| Rules the list uses (one rule, `requestDomains` array) | 1 of 329,999 available static rules | same | same | no such limit reported |
| Documented constants read from the API | dynamic 30,000 · unsafe dynamic 5,000 · **regex rules 1,000** · guaranteed static 30,000 · rulesets 100 / enabled 50 | same | same | not exposed the same way |
| Time to enable the list | ≈ 0.09 s | ≈ 0.10 s | ≈ 0.12 s | ≈ 6 s (onboarding + enable) |
| Median navigation, list off → on (25 loads, local server) | 27 → 28 ms | 33 → 35 ms | 44 → 43 ms | 99 ms with list on (15 loads, local proxy) |
| Per-URL match cost (`testMatchOutcome`) list / phrase rules | 0.54 / 0.40 ms | 0.49 / 0.34 ms | 0.43 / 0.49 ms | n/a |
| Browser memory, list off → on (sum of resident set of all browser processes) | 867 → 886 MB | 1078 → 1096 MB | 1012 → 1029 MB | 1113 → 1607 MB (whole browser, noisy) |
| Extension ready after cold start | ≈ 1.9 s | ≈ 2.1 s | ≈ 2.1 s | not measured |

Interpretation: on Chromium-family browsers the list is cheap (a memory-mapped index built on install). Firefox needs about six seconds and a few hundred MB to enable it —
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
7. **A delayed removal could wipe a newer session that re-used its storage key** (independent review of `0b46c1d`): state keys are now write-once under unique names and cleanup removes only entries dominated for ever (S16c, `lock-cleanup.test.mjs`). **A frozen write could replace the whole configuration** (independent review of `7294cd6`): re-checking ownership before a non-atomic write cannot prevent it, so storage became append-only and fenced by a lock epoch (S16b, `late-writes.test.mjs`). **A paused repair past its lease could leave stale rules** (unit regression, fixed); **a paused real worker** in the normal window and a START_SESSION from the private window
   behave as designed in a real browser (S16).
8. A service-worker deadlock (status repair queued behind itself) was found by the unit suite before any browser run.

## Known harness limits (reasons for NOT_RUN or manual steps)

- `chrome.runtime.reload()` / toggling "Allow in Incognito" in `chrome://extensions` break a **command-line-loaded** unpacked extension in headless
  Chromium; the update path is therefore tested by relaunching the same profile with a higher version, and the incognito permission by setting the
  profile preference the toggle writes (the status report `incognitoAllowed` is checked before and after).
- Native permission prompts cannot be answered by automation, so the "user grants website access" flow is **NOT RUN**; the missing-permission *state* is.
- The OS clock cannot be changed here → clock-change effect **NOT RUN** (behaviour documented).
- **Branded stable Google Chrome**, Windows/macOS, Brave, Opera, real devices: **NOT TESTED** (Chrome *for Testing* 154 was tested instead and is labelled as such).
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
5. Add an exception for a site covered by the built-in list → it loads.
6. Start a 60-minute session. Try: delete a site, switch off the list, add an exception, import a weaker file, reset → each refused with a clear message.
   Add a new site → allowed. Close and reopen the browser → session and rules persist.
7. Enable the private-window switch; repeat steps 2–6 in a private window (Chrome/Edge show the stop page; Firefox too).
8. Disable then re-enable the extension and restart the browser → popup shows rules installed again (nothing silently lost).
9. In `chrome://extensions` withdraw site access ("on click") → popup/badge show the permission problem.
10. Check the extension error page shows no errors; keyboard-only navigation of settings; Arabic RTL and German display.
11. Change the device clock forward by an hour while a session is active → the session ends early (documented limit).

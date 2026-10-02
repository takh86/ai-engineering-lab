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

The browsers ran the **test build** (`node scripts/build.mjs --test`). `diff -r` against the release build (`dist/`) shows exactly one difference in each
manifest: the extra test-only permission `declarativeNetRequestFeedback` (needed for `testMatchOutcome`). All other files are byte-identical.
The permission-missing checks use a second test build (`--optional-hosts`) whose host access is not granted at install.

Linux x64 sandbox, headless (`--headless=new` for Chromium-family). Chromium 141.0.7390.37 (Playwright build), Microsoft Edge
154.0.4258.53 (Linux .deb from packages.microsoft.com, unpacked), Firefox 157.0 (conda-forge repackaging of the Mozilla release) with
geckodriver 0.37.1. Test sites resolve to a local server (`--host-resolver-rules` for Chromium/Edge, a local HTTP proxy for Firefox);
no real website — and no listed adult domain — was ever contacted. The base list is exercised with `testMatchOutcome` (never sends a
request) and the reserved safe-test domain.

## Requirement matrix → checks

| Required test | Where |
|---|---|
| Fresh install, default list, clear status | S1.*, S2.4 (Chromium/Edge) · F1.*, F2.* (Firefox) |
| Blocked domain and its subdomains | S4.1, S3.1–S3.2 · F3.1 |
| Similar-looking domain not blocked | S4.1, S3.3–S3.4 (also 140 known-benign sites, S3.5) · F3.1 |
| Exception precedence | S3.9, S4.2–S4.3 · F3.2–F3.3 |
| Arabic/English phrases, encodings, engines, boundaries | S5.* (9 engine pages, `+`/`%20`/case/lower-hex, other-param/path/`aq`/embedded-word negatives) · F4.* |
| Normal vs private window, permission granted | S9.* (Chromium) |
| Restart / update | S7.8 (real worker stop), S7.9–S7.10 (browser restart), S7.11–S7.12 (extension update 1.0.0→1.0.1) · F6.* |
| Service-worker restart | S7.8 (checks a new worker instance via `performance.timeOrigin`) |
| Permission missing / withdrawn | S8.1–S8.4 (optional-permission build) · S8.5 skipped on Chromium (cannot drop required permission) · F6b (Firefox) |
| DNR / storage failure and rollback | S13.1–S13.4 (real DNR and storage, one failure injected into the real API object) + unit tests |
| Commitment — every settings path | S7.1–S7.7, S9.7–S9.8, F5.* |
| Redirects, no loops | S6.1–S6.2, S2.8 |
| No sensitive logging | S10.1–S10.2 (all console output of extension pages and worker) |
| Realistic-list performance | S11.* (and F8) |
| Keyboard, focus, RTL, contrast | S12.* |
| Import/export | S14.* + unit tests |
| Concurrency, sender boundary, CSP, malformed messages | S13.5–S13.9 + unit tests |

## Results (final run, same build for all three browsers)

| Browser | Version / OS | PASS | FAIL | NOT RUN |
|---|---|---|---|---|
| Chromium | 141.0.7390.37 · Linux x64 | 122 | 0 | 2 (clock change; dropping a *required* host permission is refused by Chromium) |
| Microsoft Edge | 154.0.4258.53 · Linux x64 | 122 | 0 | 2 (same) |
| Mozilla Firefox | 157.0 · Linux x64 (temporary add-on) | 43 | 0 | 1 (Arabic UI needs the Arabic language pack) |

Every check, its result and detail: [`test-evidence/SUMMARY.md`](test-evidence/SUMMARY.md) (generated) and the JSON files beside it.
Unit/static: `npm test` → 45 tests, 0 failures (core logic, controller with fault injection and races, messages, locales, manifest/CSP/permissions, byte-reproducible ZIPs).

### Measured browser limits and cost of the 936,979-domain list

| Measurement | Chromium 141 | Edge 154 | Firefox 157 |
|---|---|---|---|
| Rules the list uses (one rule, `requestDomains` array) | 1 of 329,999 available static rules | same | no such limit reported |
| Documented constants read from the API | dynamic 30,000 · unsafe dynamic 5,000 · **regex rules 1,000** · guaranteed static 30,000 · rulesets 100 / enabled 50 | same | not exposed the same way |
| Time to enable the list (`updateEnabledRulesets`) | ≈ 0.1 s | ≈ 0.1 s | ≈ 3 s |
| Median navigation, list off → on (25 loads, local server) | 32 → 31 ms | 50 → 42 ms | 115 ms with list on (15 loads, local proxy) |
| Per-URL match cost (`testMatchOutcome`, 200 URLs) | 0.36 ms (list) / 0.46 ms (phrase rules) | 0.65 / 0.41 ms | n/a (no such API) |
| Browser memory, list off → on (sum of resident set of all browser processes) | 854 → 879 MB (+25) | 1047 → 1074 MB (+27) | parent process 342 → 556 MB (+214, controlled run); whole-browser figure in the main run was higher (+600 MB, includes unrelated growth) |
| Extension ready after cold start | ≈ 2.6 s | ≈ 2.6 s | not measured |
| Regex limit for a single phrase rule (2 KB memory) | whole-word Arabic ≈ 12–14 letters, English ≈ 80 | same | much higher: a 40-letter Arabic phrase was accepted and enforced |
| Worst-case dynamic rules from our own limits (60 whole-word + 40 partial phrases + starter terms, one phrase per rule) | ≈ 500, below the 1,000 regex-rule limit (unit test) | | |

Interpretation: on Chromium-family browsers the list is cheap (it is compiled into a memory-mapped index on install). On Firefox it costs roughly
200 MB of resident memory and a few seconds to enable — acceptable on a desktop, a reason to offer a smaller list for Firefox/Android if the Owner wants one.
Numbers come from a headless Linux sandbox and a loopback server: they are relative evidence, not a real-world benchmark.

## Real-browser findings that changed the code (not visible to mocks)

1. **Regex memory:** one Arabic phrase of 60 letters cannot compile in Chromium (2 KB regex memory); the prototype would have refused
   or mis-saved it. Packing is now per search parameter, boundary alternatives were minimised (word-mode capacity ≈ 12–14 Arabic letters), and a
   test asserts every starter phrase compiles in a real browser. Firefox accepts much longer phrases.
2. **`chrome.storage` returns objects with sorted keys.** A naive JSON compare after writing reported false conflicts; comparison is now structural
   (and the test double sorts keys too).
3. **Private windows:** with the default `spanning` incognito mode Chromium *redirects but cannot display* the stop page in a private window
   (`ERR_BLOCKED_BY_CLIENT`). `incognito: "split"` shows it, and the two instances were verified to share `storage.local`, so the commitment holds.
4. **`web_accessible_resources`:** not needed in Chromium (removed → no fixed-ID fingerprint); **required in Firefox** for the redirect (added for
   `blocked.html` only; Firefox hosts are random per-profile UUIDs).
5. A service-worker deadlock (status repair queued behind itself) was found by the unit suite before any browser run.

## Known harness limits (reasons for NOT_RUN or manual steps)

- `chrome.runtime.reload()` / toggling "Allow in Incognito" in `chrome://extensions` break a **command-line-loaded** unpacked extension in headless
  Chromium; the update path is therefore tested by relaunching the same profile with a higher version, and the incognito permission by setting the
  profile preference the toggle writes (the status report `incognitoAllowed` is checked before and after).
- Native permission prompts cannot be answered by automation, so the "user grants website access" flow is **NOT RUN**; the missing-permission *state* is.
- The OS clock cannot be changed here → clock-change effect **NOT RUN** (behaviour documented).
- Branded Google Chrome, Windows/macOS, Brave, Opera, real devices: **NOT TESTED**.
- Firefox: add-on installed *temporarily* (restart = reinstall into the same profile); Arabic UI needs the Arabic language pack (NOT RUN here).
- Windows/macOS-specific store prompts and the signed AMO build: not testable here.

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

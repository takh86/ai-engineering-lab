# Tabsira V1 — security and Red Team review

Date: 2026-10-02 (updated after the independent review of `7294cd6`) · Scope: `projects/04-muslim-recovery-protection/chrome-extension` (Chrome/Edge/Firefox packages) ·
Reviewed commit: see the PR (the review was repeated on the frozen commit; evidence files carry the package SHA-256).

## Independence — read this first

The Owner asked for an **independent** security and Red Team review. An independent review of `d662632` found the session race fixed in V1.1, and an
independent review of `7294cd6` found a further **late-write** flaw (F10 below) that my own self-review had missed and had even documented as an accepted
residual (old F5). Both findings came from outside this agent. The rounds done by this agent are **self-reviews with real attacks against the built packages
— not independent audits**, and they have now been wrong once. Findings below are verified; the *absence* of further findings is not evidence of absence.
Recommended before publication: another independent review starting from this document and `tests/unit/late-writes.test.mjs`.

## Threat model

| Actor | Can | Cannot (by design) |
|---|---|---|
| Hostile web page | send requests, embed frames, call `window.open`, `fetch`, `postMessage`, try `runtime.sendMessage(id, …)` | reach extension pages/files (no `web_accessible_resources` in Chrome/Edge), message the worker, learn that Tabsira is installed |
| Other extension | try `runtime.sendMessage(id, …)` | worker has no `onMessageExternal`; sender id must equal our id |
| The user in a weak moment | disable/uninstall the extension, use another browser, edit extension storage via developer tools, change the clock | (stated plainly in the product: it is friction, not tamper resistance) |
| Second worker instance (private window) | write the same storage at the same time | shorten/erase a session, or leave rules different from stored settings |
| Hostile or corrupt import file / storage | oversized, prototype-pollution, wrong types, invisible characters, tampered lock values | execute code, widen permissions, silently weaken a session, delete protection because of a read error |

## Findings

| # | Area | Finding | Severity | Status | Evidence |
|---|---|---|---|---|---|
| F1 | Concurrency | A settings write paused after its "unchanged?" check could, on resuming, reset the session end time written meanwhile by the other worker instance (`d662632`). | High | **Fixed.** End time moved out of `config` into grow-only per-instance keys (max wins); config writes never touch it; all state changes run in a storage-based cross-instance mutex with a lease. | `tests/unit/concurrency.test.mjs` (regression written first; output on `d662632` archived in `regression-on-d662632.expected-failure.txt`); real browser S16.1–S16.4 (normal + private instance, real storage). The same S16 scenario against `d662632` fails (`regression-s16-real-browser-on-d662632.expected-failure.txt`; the failure mode differs there — the session start is refused (`session_needs_active_protection`) while the paused write leaves the browser half-applied, so the exact interleaving of the review is not reproduced in the real browser; it is pinned by the deterministic unit test). |
| F2 | Concurrency | A repair/reconcile paused **before** its rule write, past its lease, could install stale rules after another instance saved a newer configuration (rules ≠ stored settings until the next status check). | Medium | **Fixed.** Rules-only commits now re-verify ownership and the stored configuration after writing; on mismatch the browser is rebuilt from storage. | unit test "a repair paused BEFORE its rule write…" (fails on the previous controller: `regression-stale-repair-before-fix.expected-failure.txt`) |
| F3 | Privacy | The export file holds the user's blocked sites/phrases as unencrypted text; the UI did not say so. | Low | **Fixed.** Hint next to the buttons (ar/en/de), privacy policy updated. | locale parity test, S15 text checks |
| F4 | Privacy | The **browser's own history** keeps the address the user tried to open (and the stop page), as for any visit. Measured in Chromium: the original blocked URL and the stop page both appear in `History`. Tabsira has no `history` permission and never reads or copies it. | Medium (user-facing) | **Documented**, not fixable by an extension. Privacy policy and README say so; recommend clearing history or using a profile policy if that matters. | S17 note `S17-history` |
| F5 | Concurrency | *(was: accepted residual window between the last ownership check and the storage write.)* **Reclassified as F10 and fixed** — it was not harmless: a frozen writer could replace the whole configuration. | — | see F10 | — |
| F6 | Tamper | Extension storage can be edited through the extension's developer tools: a user can delete the session keys and end a session early, or write a far-future value to lengthen it. | Info | **Accepted** — by definition of the feature ("friction, not tamper resistance"); tampered/invalid values are detected and never trusted (`mergeLocks`, `invalidLockKeys`). | `security.test.mjs`, controller tests |
| F7 | Permissions | `http://*/*` + `https://*/*` host access is broad. | Info | **Accepted**: required to *redirect* arbitrary user-chosen sites; no content scripts, no `tabs`/`history`/`webRequest`/`cookies`/`scripting`. | static manifest test |
| F8 | Surface | Firefox needs `web_accessible_resources` for `blocked.html`. The page is inert (no messaging, no state, no parameters) and the add-on host is a random per-profile UUID. | Info | **Accepted.** | S2.9b, F-suite |
| F9 | Invisible input | A zero-width character inside a typed domain is dropped by URL normalisation (stored name is clean ASCII); bidi controls are refused for domains and removed from phrases. | Info | **Verified.** | `security.test.mjs` |

| F10 | Concurrency | **Late write (independent review of `7294cd6`).** A `SAVE_SETTINGS` that deletes sites is frozen at `storage.set({config})` after `assertOwner` and the compare; its lease expires; another instance saves newer sites and starts a session; the frozen write resumes. Result: stored sites `[]`, rules 0, session still active. Re-checking ownership before a non-atomic write cannot prevent this, because the freeze can happen after the check. | High | **Fixed by construction, not by another check.** The configuration is no longer overwritten: each write creates `cfg:<epoch>:<instance>`; the epoch is registered when the lock is entered (strictly above all earlier holders, ownership re-verified afterwards); the effective configuration is the highest record, so a late record is dominated by everything written after its holder entered the lock. `START_SESSION` writes a pinning record, so nothing begun before a session can land inside it. Rollback removes only its own record and is skipped when the lease is gone; compaction keeps the two newest records. | simulation: `tests/unit/late-writes.test.mjs` (6 of 9 tests fail on `7294cd6`; output archived) · real browser: S16b (fails on the `7294cd6` package: domains `[]`, state `not_configured`, late save `ok`; passes now) |

No finding rated Critical was open at the end of the review.

## What was attacked (and how)

| Attack | Where | Result |
|---|---|---|
| Web page: iframe / `<img>` / `<script>` / `fetch` / `window.open` to any extension URL | S17.1 (Chromium/Chrome/Edge) | all blocked |
| Web page and other pages: `runtime.sendMessage(id, START_SESSION)` | S13.7, S17.2 | not reachable; no state change |
| Stop/help pages (inert) sending worker messages | S2.9b | refused |
| Sender spoofing by URL tricks (`options.html@evil`, `options.htmlx`, other id, frame ≠ 0) | `security.test.mjs` | refused |
| Malformed/oversized/cyclic/prototype-polluting messages | S13.9, `security.test.mjs` | `bad_request`, no change |
| Import: `__proto__`/`constructor` keys, extra keys, wrong types, nesting, > 256 KB, > list limits | `security.test.mjs`, S14 | refused with a code; `Object.prototype` untouched |
| Regex injection through phrases (`.* | ( ) [ ] { } \ ^ $`) | `security.test.mjs`, S5 | metacharacters are literal; only the stored letters match |
| Homograph / IDN / IPv4 / credentials / port in a "domain" | `security.test.mjs`, core tests | refused or normalised to the punycode name; homograph stays a different name |
| Weakening during a session by every path (save, import, reset, replace, longer phrase, exception) | controller tests, S7, S9, F5, F9 | `locked_weakening` |
| Two instances racing a session start / extension / rollback | `concurrency.test.mjs`, S16 | max-wins; never shortened; rules follow storage |
| Writers frozen past their lease (at the config write, the rule write, the rollback, the record removal) resuming after newer saves and a session start | `late-writes.test.mjs`, **S16b (real normal + private instances)** | late record dominated; newer sites, rules and session intact |
| Tampered lock values (negative, NaN, huge, extra keys, look-alike keys) | `security.test.mjs` | invalid → corrupt state, never trusted; look-alike keys ignored |
| Leakage: visited URL parts / search text in extension storage, IndexedDB, local/session storage after blocked visits | S17.4 | none found |
| Leakage: console output of pages and worker | S10 | none; no unexpected errors |
| Code injection on extension pages (inline script, `eval`, `new Function`) | S13.8 | blocked by CSP |
| Network: any outbound request from extension code | static test (no `fetch` except own file, no sockets) | none |
| Supply chain | `package.json`, `src/fonts/SOURCES.md`, `PROVENANCE.json` | no runtime dependencies; fonts SHA-256 pinned (OFL); list inputs SHA-256 pinned |

## Not covered

What remains: browsers' rule application (`declarativeNetRequest`) is not transactional with storage, so rules are *derived* state: a late rule write can briefly leave rules different from the stored configuration. That is detected (status `rules_mismatch`), `START_SESSION` refuses while it persists, and the late worker's own `busy` path, any status check, start-up and `Repair` rebuild the rules from the effective record.

Independent audit; fuzzing campaign beyond the listed cases; Windows/macOS behaviour; branded Chrome stable (Chrome **for Testing** was used);
Brave/Opera; signed AMO build; behaviour of other extensions that modify requests (priority conflicts with other `declarativeNetRequest` extensions are
not tested); a malicious local administrator (out of scope by design).

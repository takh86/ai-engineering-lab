# Changelog

All notable changes to the Tabsira browser extension. Format: [Keep a Changelog](https://keepachangelog.com/);
versions follow `package.json`. The built-in list version is the version of the extension that ships it.

## [1.0.0] — unreleased (release candidate V1.1, not published)

### V1.1 (Owner decisions of 2026-10-02) — changes since the first release candidate
- **Built-in list: final Owner decision — licence-only sources.** The list is exactly ShadowWhisperer `Lists/Adult` (The Unlicense) ∪ Sinfonietta `pornography-hosts` (MIT):
  **242,750 domains** (was 714,093; originally 936,979). The Block List Project (including its 492,511 unattributed entries), HaGeZi, zachlagden and Clefspeare13 are no longer
  used. Inputs pinned to commits (`1404d49…`, `46f3097…`), git blob ids and SHA-256; licence texts verified byte-identical to the pinned commits; notices with the MIT copyright
  line ship in the package; the settings page names the two sources. The package shrank from 3.9 MB to 1.3 MB. The entry-count drop is not a coverage measurement.
  `alarms` permission: **approved by the Owner**.
- **Fixed (High): commitment-session race.** A settings write paused after its "unchanged?" check could reset a session started meanwhile from the other
  worker instance (normal vs private window). The end time now lives in grow-only per-instance entries (the effective end is the maximum); configuration
  writes never touch it; every state change runs inside a storage-based cross-instance write lock with a lease (`busy` instead of writing blindly).
  Deterministic regression tests (written first; the output on the old commit is archived) and a real-browser test with a paused real worker.
- **Fixed (review of `516a4ff`): protection not recovered after a worker was terminated following a stale rule write.** Measured in real Chromium: rules stayed empty (no recovery in 170 s, no extension page opened); nothing wakes a terminated worker. Added the `alarms` permission (no install warning; **Owner decision pending**) with a 1-minute watchdog plus a check at every worker start; rules are rebuilt from the stored settings under the write lock (32 s in the Chromium-family tests, 53–63 s in Firefox). README "Recovery" states the exact conditions; the earlier wording "brief gap" was removed.
- **Fixed (High, independent review of `0b46c1d`): late deletes.** A cleanup that had chosen an expired session key and froze at `storage.remove` wiped a NEW session that re-used the same key, after which a save deleting every site was accepted. Keys that carry state are now write-once under unique names (`lock:<epoch>-<n>:<instance>`, `ep:<epoch>:<instance>`, `cfg:<epoch>:<instance>`); cleanup removes only entries dominated for ever and runs after each operation; rollback restores under its own record instead of deleting. Regression tests first (3 of 7 fail on `0b46c1d`) and real-browser S16c (fails on the old package).
- **Fixed (High, independent review of `7294cd6`): late writes.** A save frozen at the storage write, resumed after its lease expired, a newer save and a session start, emptied the stored sites while the session stayed active. Ownership re-checks cannot prevent that, so the configuration is now stored as append-only records ranked by a fencing epoch taken when the lock is entered; a late record is dominated and ignored; starting a session pins the current settings; rollback removes only its own record. Regression tests first (6 of 9 fail on `7294cd6`) and real-browser S16b (fails on the old package).
- **Fixed (Medium):** a repair paused past its lease could leave stale rules after another instance's newer save; rules-only writes now re-verify.
- *(superseded by the final decision above)* **Built-in list rebuilt with verified source licences (plus an unattributed remainder).** 714,093 domains (was 936,979): ShadowWhisperer (Unlicense) + Block List Project (Unlicense) + Sinfonietta (MIT,
  attribution; 492,511 Block List Project entries are "unattributed" — present in no other examined source; this does NOT show they are BLP's original work; origin unknown, see `data/base-list/README.md`); 234,341 entries traceable only to GPL-3.0 / unlicensed / unverifiable upstreams removed; inputs pinned by SHA-256; licences and
  `THIRD_PARTY_NOTICES.txt` shipped in the package and linked from Settings. Package is ~1 MB smaller.
- **Approved visual identity** on Popup, Options, Onboarding, Stop and Help pages: shared design tokens (`tokens.css`), Cairo Bold + Tajawal (OFL, bundled, no
  network), blue/lime filter mark (redrawn from the Owner's reference — not the designer's SVG), lime primary action with dark text, status by text + icon + colour,
  dark scheme, AA contrast and layout tests (200 % text, 320 px width). New icons.
- **Tests now run on the built ZIPs.** The harness extracts the release ZIP; variants differ only in `manifest.json`. New suites: normal + private concurrency (S16), identity
  and layout (S15), hostile page + leakage scan (S17), Firefox private windows, Google Chrome for Testing. Adversarial unit tests (import, domains, phrases, messages, lock).
- Export hint: the file is plain text listing your sites; privacy policy and README state that the browser's own history keeps the addresses you tried to open.
- Docs corrected: Chrome/Edge use `incognito: "split"` and no `web_accessible_resources`; Firefox needs one web-accessible resource.
- Removed the separate test builds (`--test`, `--optional-hosts`).

Builds on the v0.1 personal prototype (PR #73). Nothing here is published to any store.

### Added
- Built-in adult-sites list: one static DNR ruleset generated from a bundled, licensed snapshot
  (first RC: Block List Project `porn.txt` alone, 936,979 domains — replaced in V1.1, see above; provenance and SHA-256
  in `data/base-list/PROVENANCE.json`). Off until the user accepts it in onboarding.
- Exceptions (allow list) with defined precedence: exception > user rules > built-in list.
- Search phrases: whole-word and partial modes, per-engine query parameter (`q`, `p`, `search_query`, `text`),
  Google regional domains, Bing/Yahoo/YouTube/Yandex/Brave/Ecosia/Qwant/DuckDuckGo, `+`/`%20`, case-insensitive,
  NFKC + Arabic-diacritic normalization of the stored phrase. Optional conservative starter phrases (AR/EN).
- Onboarding (purpose, permission, privacy, limits, safe test), popup, options, stop and help pages.
- Arabic (RTL, default), English, German; shared `_locales` structure for more languages.
- Settings export/import (merge-only; refused during a commitment session if it would weaken protection).
- Honest status model: not configured / rules installed + permission present / partial / unknown, with reasons.
- Firefox (Gecko, MV3 event page) manifest alongside Chrome/Edge; deterministic build and ZIP packaging.
- Unit tests (core, controller with fault injection, static/package checks) and real-browser acceptance tests.

### Changed
- Settings schema v2 with strict validation and migration from the v0.1 prototype configuration.
- Commitment end time stored separately from the configuration, so a damaged configuration cannot erase it.
- All blocking changes are applied transactionally (snapshot → install → verify → persist, restore on failure),
  with reconciliation on browser start, extension update and permission changes.
- Messages are allow-listed and schema-validated; only the popup, settings and onboarding pages may send them.
- Stricter CSP (`default-src 'none'`); `web_accessible_resources` removed from the Chrome/Edge package (redirecting to the stop
  page does not need them in Chromium, and removing them stops websites detecting the extension). Firefox needs one entry
  (`blocked.html`) and uses random per-profile add-on hosts.
- Chrome/Edge keep `incognito: "split"` on purpose: with the default `spanning` mode Chromium redirects a private window but cannot
  show the stop page (`ERR_BLOCKED_BY_CLIENT`). Verified: the private-window instance shares `storage.local`, so the commitment
  holds there too; since V1.1 the cross-instance write lock (see above) covers two windows saving at once. Private-window use still needs
  the browser’s manual “allow” switch.

### Fixed
- Prototype regex rule stored a 60-character Arabic phrase that real Chromium cannot compile (2 KB regex memory
  limit); phrases are now validated against the browser and the real limit is documented.

### Known limits
See README “Limits”. Highlights: URL-level only (no page/image/screen reading), main-frame only, in-page searches
are not caught, Arabic phrases ≈ 12–14 letters per rule, list classification can be wrong, extension can be disabled.

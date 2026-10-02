# Changelog

All notable changes to the Tabsira browser extension. Format: [Keep a Changelog](https://keepachangelog.com/);
versions follow `package.json`. The built-in list version is the version of the extension that ships it.

## [1.0.0] — unreleased (release candidate V1.1, not published)

### V1.1 (Owner decisions of 2026-10-02) — changes since the first release candidate
- **Fixed (High): commitment-session race.** A settings write paused after its "unchanged?" check could reset a session started meanwhile from the other
  worker instance (normal vs private window). The end time now lives in grow-only per-instance entries (the effective end is the maximum); configuration
  writes never touch it; every state change runs inside a storage-based cross-instance write lock with a lease (`busy` instead of writing blindly).
  Deterministic regression tests (written first; the output on the old commit is archived) and a real-browser test with a paused real worker.
- **Fixed (Medium):** a repair paused past its lease could leave stale rules after another instance's newer save; rules-only writes now re-verify.
- **Built-in list rebuilt with verified source licences (plus an unattributed remainder).** 714,093 domains (was 936,979): ShadowWhisperer (Unlicense) + Block List Project (Unlicense) + Sinfonietta (MIT,
  attribution; 492,511 Block List Project entries are "unattributed" — origin unknown, see `data/base-list/README.md`); 234,341 entries traceable only to GPL-3.0 / unlicensed / unverifiable upstreams removed; inputs pinned by SHA-256; licences and
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

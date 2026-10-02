# Changelog

All notable changes to the Tabsira browser extension. Format: [Keep a Changelog](https://keepachangelog.com/);
versions follow `package.json`. The built-in list version is the version of the extension that ships it.

## [1.0.0] — unreleased (release candidate, not published)

Builds on the v0.1 personal prototype (PR #73). Nothing here is published to any store.

### Added
- Built-in adult-sites list: one static DNR ruleset generated from a bundled, licensed snapshot
  (The Block List Project `porn.txt`, Unlicense; 936,979 domains after de-duplication; provenance and SHA-256
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
- Stricter CSP (`default-src 'none'`); `web_accessible_resources` removed (redirecting to the stop page does not
  need them, and removing them stops websites detecting the extension).
- Extension no longer sets `incognito: "split"` (one worker for all windows, so a commitment cannot be bypassed
  from another window). Private-window use still needs the browser’s manual “allow” switch.

### Fixed
- Prototype regex rule stored a 60-character Arabic phrase that real Chromium cannot compile (2 KB regex memory
  limit); phrases are now validated against the browser and the real limit is documented.

### Known limits
See README “Limits”. Highlights: URL-level only (no page/image/screen reading), main-frame only, in-page searches
are not caught, Arabic phrases ≈ 12–14 letters per rule, list classification can be wrong, extension can be disabled.

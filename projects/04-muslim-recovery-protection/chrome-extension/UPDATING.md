# Updating the lists and the extension

Lists are updated **only by shipping a new extension version.** The extension never downloads a list, never
contacts a server, and never changes rules by itself. That is a deliberate privacy and review-friendliness
choice; the price is that a list is as fresh as the last release.

## Cadence (proposal — Owner to confirm)

| Trigger | Action |
|---|---|
| Every 3 months | Refresh the base-list snapshot (below), run all tests, release a patch/minor version. |
| Wrong-block report on a popular site | Add it to `data/base-list/known-benign-canaries.txt`, rebuild the snapshot (the update refuses to write if a canary is covered), release a patch. |
| Browser/API change (Chrome, Edge, Firefox release notes) | Re-run the real-browser suites on the new stable versions before the next release. |
| Store policy change | Re-check `store/LISTING.md` and `store/privacy-policy.html` against the current policy. |

## Refreshing the base list

1. `node scripts/fetch-base-list-sources.mjs .base-list-inputs` downloads the six input files (only the list files; **never visit a listed
   domain**). The inputs directory is git-ignored.
2. `node scripts/update-base-list.mjs --inputs .base-list-inputs --retrieved YYYY-MM-DD`
   - validates hostnames, applies the composition rule in `data/base-list/README.md`, removes entries covered by a listed parent,
     refuses to write if a known-benign canary would be blocked, writes `adult-domains.txt.gz`, `PROVENANCE.json` (input SHA-256s, counts,
     header dates) and `provenance-samples.json`.
3. Re-check **licence and provenance** of every contributing source (ShadowWhisperer, Block List Project, Sinfonietta): open the upstream `LICENSE`,
   compare with `data/base-list/licenses/`, update `THIRD_PARTY_NOTICES.md`. If a licence changes or becomes unclear, or an upstream that feeds
   Block List Project's `porn` category (see its `config/lists.yml`) changes, stop and ask the Owner.
4. Spot-check a random sample of *names only* for false positives (never open a listed site); add any clear false positive to the canary list.
5. A new list is added only with evidence: coverage gain after de-duplication, canary/false-positive check, performance measurement, verified licence.
6. `npm test`, then `node scripts/build.mjs` and the real-browser suites on the built ZIPs (`TESTING.md`).
7. Bump `version` in `package.json`, update `CHANGELOG.md`, `npm run build`, `npm run verify-reproducible`.

## Releasing the extension

1. Update `CHANGELOG.md` and the version in `package.json` (the build injects it into both manifests).
2. `npm ci && npm test && npm run build && npm run verify-reproducible` → `dist/tabsira-chromium-<v>.zip`, `dist/tabsira-firefox-<v>.zip`.
3. Run the real-browser suites **on the built ZIPs** (`tests/e2e` extracts and tests the release ZIP itself); attach the JSON evidence from `test-evidence/` to the release record.
4. Owner uploads (Chrome Web Store, Edge Add-ons, AMO). The Firefox ZIP is **unsigned**; AMO signs it. Do not describe it as signed before AMO returns the signed XPI.
5. Settings are versioned (`v` in storage). A new schema version must add a migration in `src/core/config.js` and a unit test using a stored v(N-1) fixture. Never drop unknown stored data silently; corrupt data is reported, not overwritten.

## Extension updates and rules

An extension update resets which static rulesets are enabled to the manifest default (disabled). The service worker
re-applies the stored configuration on `onInstalled`, browser start and permission changes. This was verified in
Chromium (see `TESTING.md`, S7.11). Until the worker's first run after the update the built-in list is off; the first worker run (any event, or the watchdog alarm within about a minute) restores it.

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

1. Download the upstream file `https://raw.githubusercontent.com/blocklistproject/Lists/master/porn.txt`
   (do **not** visit the listed domains; only the list file is fetched).
2. `node scripts/update-base-list.mjs --from <downloaded porn.txt> --retrieved YYYY-MM-DD`
   - Validates and normalizes hostnames, removes entries already covered by a listed parent, refuses to write if any
     known-benign canary would be blocked, writes `adult-domains.txt.gz` and `PROVENANCE.json` (new SHA-256, counts, dates).
3. Re-check **licence and provenance**: the repository licence (currently Unlicense) and the file header; copy the current
   `LICENSE` into `data/base-list/LICENSE-blocklistproject.txt`. If the licence changes or becomes unclear, stop and ask the Owner.
4. Spot-check a random sample of *names only* for false positives (never open a listed site); add any clear false positive
   to the canary list or ask upstream to remove it.
5. `npm test`, `npm run build:test && node scripts/build.mjs --test --optional-hosts && npm run test:e2e`, then the Firefox suite.
6. Bump `version` in `package.json`, update `CHANGELOG.md`, `npm run build`, `npm run verify-reproducible`.

## Releasing the extension

1. Update `CHANGELOG.md` and the version in `package.json` (the build injects it into both manifests).
2. `npm ci && npm test && npm run build && npm run verify-reproducible` → `dist/tabsira-chromium-<v>.zip`, `dist/tabsira-firefox-<v>.zip`.
3. Run the real-browser suites; attach the JSON evidence from `test-evidence/` to the release record.
4. Owner uploads (Chrome Web Store, Edge Add-ons, AMO). The Firefox ZIP is **unsigned**; AMO signs it. Do not describe it as signed before AMO returns the signed XPI.
5. Settings are versioned (`v` in storage). A new schema version must add a migration in `src/core/config.js` and a unit test using a stored v(N-1) fixture. Never drop unknown stored data silently; corrupt data is reported, not overwritten.

## Extension updates and rules

An extension update resets which static rulesets are enabled to the manifest default (disabled). The service worker
re-applies the stored configuration on `onInstalled`, browser start and permission changes. This was verified in
Chromium (see `TESTING.md`, S7.9). Between the update and the first worker run the built-in list may be briefly off.

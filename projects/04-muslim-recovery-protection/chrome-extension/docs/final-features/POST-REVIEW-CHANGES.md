# Changes after the locally verified busy fix

Date: 2026-10-03. These changes were made on top of `f6174fd` and change the product source, so the 1.1.0 package bytes changed.

| Change | Why | Test |
|---|---|---|
| `applySettings` validates only phrases added by the save (`src/background/controller.js`) | A phrase accepted earlier and rejected later (browser update lowered the regex memory limit, or a longer parameter name was added) blocked every save and, during a session, every strengthening change | `tests/unit/controller.test.mjs`, "a saved phrase the browser later rejects ..." (fails without the fix) |
| Entry-point guard in `scripts/fetch-base-list-sources.mjs` compares `pathToFileURL` | The old `file://` string comparison never matched on Windows or paths containing spaces, so the script did nothing | Checked by hand on a path with a space; no automated test |
| `engines.node` raised to `>=22` | `npm test` passes a glob to `node --test`, which older Node versions do not expand; CI runs Node 22 | CI |
| Workflow: actions pinned to commit SHAs, `persist-credentials: false`, `npm ci --ignore-scripts`, timeout, concurrency | Supply-chain hardening; no behaviour change | CI |

## Package fingerprints

A fresh build of this tree gives different SHA-256 values from those in `BUSY-FIX-LOCAL.md`:

- Chromium: `cee0c1c98100ea293646bc9bc0afa8c94ea3dd369a22ce28787e8e12c9200e62`
- Firefox: `f6f35d0f441916b16e3e375f46a63e8a894d94b46856cfcd3ddd6c584b8c3804`

`npm test` (194 tests) and `npm run verify-reproducible` pass locally on Node 22. The earlier 193-test report, the native-browser results and any package tested by hand describe the earlier bytes only. The ZIPs must be frozen again and re-tested (CI e2e, then the same package on real browsers) before this candidate is relied on.

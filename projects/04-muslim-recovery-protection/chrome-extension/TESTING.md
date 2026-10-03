# Tabsira 1.1.0 verification

The current feature contract is [docs/final-features/CONTRACT.md](docs/final-features/CONTRACT.md). Current results, reviewed commit and package hashes are recorded in [docs/final-features/REVIEW.md](docs/final-features/REVIEW.md).

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

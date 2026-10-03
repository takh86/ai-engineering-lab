# تبصرة Tabsira — browser extension

Tabsira is a local browser extension for adults who choose support with their online habits. It blocks a bundled adult-domain snapshot and user-added domains/search phrases, and offers respectful help, a five-stage recovery journey, and an optional Muslim faith experience. It is not a proven treatment.

**1.1.0 is a review candidate, not a store release.** Final requirements are frozen in [the feature contract](docs/final-features/CONTRACT.md). Current verification and its limits are recorded in [TESTING.md](TESTING.md). Evidence from 1.0.0, frozen 1.0.1 or an earlier 1.1.0 candidate does not certify the changed 1.1.0 packages. Nothing here claims protection against an owner uninstalling the extension or changing its local files.

## Features

- After setup, the licensed **242,750-domain core stays enabled**. Exceptions affect additional rules only; they cannot exempt the core. The exact domain snapshot and licence notices ship in both packages.
- Additional sites and search phrases are enforced by declarative browser rules. Main-frame redirects show a stop page without passing the blocked address or search text to that page. No browsing history is collected.
- Multiple weekly schedules support overnight periods and reject overlaps. They govern additional protection; the core stays continuous. A commitment keeps additional protection active and prevents weakening.
- A commitment has a custom duration and an early-exit delay of at least 60 minutes, chosen when it starts. Early exit requires a request, the complete wait and password confirmation. Natural expiration ends the commitment. Password recovery preserves its deadline.
- The popup shows actual protection status, a shield and a live countdown. “Block this site” asks for optional `activeTab` access only on its button click. The safe self-test lives in setup/settings.
- Arabic, English and German share initial setup: religion choice sets initial faith preferences independently of language, with a manual override. Faith content is optional. Prayer notifications are separately optional and **off by default**.
- Prayer calculations run locally using a manually entered location, time zone, calculation method, adjustment and selected prayers. No geolocation or server is used. Notification permission is requested only on explicit activation. Polar-day calculation gaps are reported honestly.
- Need-based help includes 30 suggestions, custom ideas, favorites, unsuitable markers and an optional timer. Recovery stays in one five-stage journey; a review can be saved explicitly, skipped or postponed. A private covenant uses purpose, values, needs and “if … then …” plans.
- An optional independent local password gates settings and private records in the worker. Private notes, covenant, custom suggestions and reviews are encrypted with AES-GCM when a password is set; PBKDF2 derives keys. A one-time recovery code is shown when a password is set. There is no Google/device password dependency, account backend or email recovery. Worker restart locks access; help remains available.

## Privacy and boundaries

No telemetry, cloud sync, account server, browsing history, geolocation, or remote content loading. Protection configuration and public preferences remain local and unencrypted; private records are encrypted only when a password is enabled. An exported protection configuration contains site/phrase rules; keep that file private. The extension does not control other browsers/apps or resist an owner with device access. Local passwords are access controls, not tamper-proof enforcement.

The built-in list is automated community classification and can contain errors. Unlike older versions, the core cannot be turned off or exempted. Only explicitly licensed sources feed the snapshot; [provenance](data/base-list/PROVENANCE.json) pins commits and hashes, and both packages include full licence notices.

## Build and verification

Requires Node >=22 (`npm test` passes a glob to `node --test`, which older Node versions do not expand; CI runs Node 22). No runtime npm dependency; Playwright is a development dependency only.

```sh
npm ci
npm test
npm run build
npm run verify-reproducible
node node_modules/playwright-core/cli.js install --with-deps chromium
node tests/e2e/final-features.mjs
```

The deterministic build writes Chromium and Firefox ZIPs into `dist/`. The final browser suite extracts the Chromium release ZIP and uses real extension APIs. Set `CHROMIUM` to an installed compatible Chromium executable if needed. Browser inability to launch is recorded as `NOT_RUN` and returns failure; it is never counted as a pass. CI repeats the checks and retains ZIPs/evidence for review.

Load `dist/chromium` using Chromium's developer mode, or use the Firefox package according to that browser's development/signed-add-on rules. Do not label an unsigned development package as a store release. See [COMPATIBILITY.md](COMPATIBILITY.md), [privacy policy](store/privacy-policy.html) and [final feature review](docs/final-features/REVIEW.md).

## Browser boundaries preserved from 1.0.1

- Chrome-family redirects initiated inside a web page can display the browser’s own blocked-page error instead of Tabsira’s stop page. The server remains blocked. Typed/bookmarked navigation can show the stop page. Chromium does not expose extension files as web-accessible resources; Firefox exposes only `blocked.html`.
- Rules apply to top-level navigation, not embedded images/frames or search updates without navigation. URL phrase patterns can miss spelling/encoding variants; long whole-word phrases use narrower edges and the status reports that limitation.
- The browser itself can retain the attempted address in its history; Tabsira neither reads nor copies it. Private windows require the browser’s explicit extension permission.
- Persisted configuration and sessions use append-only fenced records. Browser rules are derived state: a late frozen worker can temporarily leave rules different from stored configuration. Worker events and the one-minute watchdog reconcile them; sleeping/closed browsers cannot deliver a timing guarantee. Dedicated schedule boundary alarms do not eliminate operating-system delay.
- Store signing, branded stable Chrome, Windows/macOS and newly integrated behavior need package-specific verification. Historical browser results are retained in [TESTING.md](TESTING.md), separately from current results.

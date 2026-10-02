# تبصرة — Tabsira (browser extension)

A local-only extension for adults who chose to protect themselves online: it blocks websites and search phrases
**you** choose, then turns the moment of blocking into a short, respectful pause with help. It complements the
Android app and Family DNS; it is not a replacement for them and not a proven treatment.

> **Status — release candidate, not published.** Code complete and verified by automated tests in real browsers
> (Chromium 141: 122 checks pass · Edge 154: 122 · Firefox 157: 43, all on Linux; 0 failures). **Not yet verified:** branded Google Chrome,
> Windows/macOS, Brave, Opera, the AMO-signed Firefox build, real user devices. Store packages are prepared but nothing was uploaded, merged or published.
> See [`TESTING.md`](TESTING.md) for evidence and [`COMPATIBILITY.md`](COMPATIBILITY.md) for the browser table.

## What it does

- **Blocks sites you add** — the site and its subdomains, on DNS label boundaries (`example.com` blocks `mail.example.com`,
  not `badexample.com` or `example.com.evil.org`).
- **Built-in adult-sites list (opt-in)** — a bundled snapshot of The Block List Project (Unlicense), 936,979 domains. Automated and
  community-made: it **can block innocent sites**; use Exceptions. Details and licence in
  [`data/base-list/README.md`](data/base-list/README.md). Nothing is downloaded at run time.
- **Search phrases (Arabic and English)** — matched only inside the search parameter (`q`, `p`, `search_query`, `text`) of
  Google (all regional domains), Bing (web/images/video), DuckDuckGo, Yahoo, YouTube, Yandex, Brave, Ecosia and Qwant;
  `+` or `%20`, upper/lower case, Unicode-normalized. Whole-word (default) or partial (broader, more false blocks).
  Optional conservative starter phrases.
- **Exceptions** — fix wrong blocks. Precedence: **exception > your sites/phrases > built-in list.**
- **Commitment session (60 / 90 / 120 min)** — see below.
- **Help me now** — one-minute pause; never opens the blocked site; no blame, diagnosis or promise; nothing is stored.
- **Settings export/import** (merge-only), **Arabic (RTL) / English / German** UI, keyboard-operable, light/dark.

## Commitment session — exactly what it does

While a session is active, **inside the extension** these are refused: deleting a site or phrase, turning off the built-in list or
starter phrases, adding an exception, importing settings that would weaken anything, resetting. Adding **stronger** protection is
always allowed. The same rules apply from a private window and from several windows at once (one shared state).
It is a time stamp in storage — no timer, so a sleeping/restarted worker cannot lose it. When it ends it **only re-allows
editing**; it never removes a rule.

It is friction, **not tamper resistance**: the user can still disable or uninstall the extension, use another browser/profile,
or change the device clock (moving the clock forward ends the session early; backward lengthens it). Nothing prevents removal at
OS level and no enterprise policy or device permission is used.

## Status shown to the user (never "fully protected")

| State | Meaning |
|---|---|
| Not configured | Onboarding not finished, or everything switched off. Nothing is blocked. |
| Rules installed, permission available | Browser holds exactly the rules your settings imply and website access is granted. (Verified by read-back, not a guarantee of coverage.) |
| Partial | Missing website permission, rules differ from settings (auto-repair offered), or some phrases exceed browser limits. |
| Unknown | Settings unreadable/corrupt or the browser API failed. Existing rules are **left untouched**, never deleted because of a read error. |

## Privacy and permissions

No accounts, analytics, telemetry, browsing history, server, or remote list. Stored locally in `storage.local` (**not encrypted**):
sites, exceptions, phrases, switches, a revision number, and the session end time. Block attempts, URLs and search words are never
stored or logged; the stop page cannot see which rule matched. Full text: [`store/privacy-policy.html`](store/privacy-policy.html).

| Permission | Why |
|---|---|
| `storage` | Keep your settings across restarts. |
| `declarativeNetRequest` | Let the browser apply the rules itself. |
| Website access (`http://*/*`, `https://*/*`) | Required by the browser to *redirect* a blocked page to the help page for any site you choose. Not used to read or change pages; **no content scripts.** |

Not requested: `tabs`, `webNavigation`, `webRequest`, `history`, `cookies`, `activeTab`, `scripting`, `alarms`, `downloads`.
No `web_accessible_resources` in the Chrome/Edge package, so websites cannot detect the extension by its fixed ID; Firefox requires exactly one (`blocked.html`) for the redirect and its add-on host is a random per-profile UUID. CSP `default-src 'none'; script-src 'self'`.
The worker accepts only schema-validated messages from the extension's own popup/settings/onboarding pages.

## Limits (by design and by browser)

- **URL-level only.** No reading of page content, screen or images; no AI classification. Such features would need new
  permissions and a decision (see "Proposals").
- **Top-level pages only** (`main_frame`). Embedded frames and images from listed sites are not blocked.
- **No new navigation, no catch**: a search that updates the page in place (suggestion boxes, single-page apps) is invisible to URL rules.
- **Arabic phrases are short.** The browser caps each rule's regex memory (2 KB): measured in Chromium 141, a whole-word Arabic
  phrase fits about 12–14 letters (fewer with spaces); English ≈ 80 letters. Over-long phrases are refused with the line number.
  Diacritics/tatweel are removed from stored phrases; alef/ya/ta-marbuta variants are **not** unified.
- **List quality.** Classification is automated; false positives exist (a 60-name sample showed one). Updates only with new versions.
- **Private windows** need the browser's manual "allow in private/incognito" switch. Chromium: the stop page shows in private windows
  (`incognito: split`, shared storage, verified); two windows saving within the same few milliseconds → last write wins and rules follow storage.
- **Clock changes, disabling, removing, other browsers/profiles, local files** are outside any guarantee.
- **Updates:** browsers reset which static ruleset is enabled on an extension update; the worker re-applies your settings
  immediately (verified) but there can be a brief gap.

## Install (testing)

**Chrome / Edge / Brave (unpacked):** unzip `tabsira-chromium-<v>.zip` to a permanent folder → `chrome://extensions` (or `edge://extensions`)
→ Developer mode → *Load unpacked* → select the folder with `manifest.json`. The onboarding page opens.
**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `manifest.json` from the unzipped
`tabsira-firefox-<v>.zip`. (Temporary add-ons vanish on restart; the AMO-signed build is a later step.) If Firefox does not grant website
access automatically, the onboarding page has a button to request it.
**Safe test:** open `https://tabsira-selftest.test/` — a reserved name that never resolves; the redirect happens first. Never test with real adult sites.
**Private window:** enable "Allow in Incognito" (Chrome/Edge) or "Run in Private Windows" (Firefox) in the extension's details.

## Build and test

Requires Node ≥ 20.11. No runtime dependencies; dev dependency `playwright-core@1.56.1` (exact) only for browser tests.

```sh
npm ci
npm test                       # unit + static + build-reproducibility tests (no browser)
npm run build                  # dist/tabsira-chromium-1.0.0.zip, dist/tabsira-firefox-1.0.0.zip (byte-reproducible)
npm run verify-reproducible    # builds twice, compares SHA-256
# real browsers (see TESTING.md):
node scripts/build.mjs --test && node scripts/build.mjs --test --optional-hosts
CHROMIUM=/path/to/chrome-or-chromium node tests/e2e/run.mjs --browser chromium
EDGE=/path/to/msedge        node tests/e2e/run.mjs --browser edge
FIREFOX=/path/to/firefox GECKODRIVER=/path/to/geckodriver node tests/e2e/firefox-run.mjs
```

`dist-test*` builds add test-only permissions (`declarativeNetRequestFeedback`) and are never packaged for stores.

## Layout

`src/core` pure logic (domains, phrases, rules, settings, session) · `src/background` controller, message validation, browser
adapter, worker · `src/ui` pages (copied flat into the package) · `src/_locales` ar/en/de · `scripts` build, ZIP, base-list updater,
icon/asset generators · `data/base-list` snapshot + provenance + canaries · `tests` unit and real-browser suites ·
`store` listing text, privacy policy, images, submission checklist · [`UPDATING.md`](UPDATING.md) list/extension update plan ·
[`CHANGELOG.md`](CHANGELOG.md).

## Proposals needing an Owner decision (not implemented)

1. **In-page search detection** (SPA) — a content script limited to the nine search engines that only watches `location` changes (no DOM
   reading): no new install warning (host access already exists) but new code in pages; privacy review needed.
2. **Block embedded frames/images** from the built-in list (`sub_frame`, `image` types): small change, more coverage, pages may look broken.
3. **Remote list updates** — needs a server/provider and a signed feed; conflicts with the "no server" stance.
4. **Image/screen/DOM classification** — large permission, privacy and cost implications; not recommended for V1.
5. **Stronger removal resistance** — only via enterprise/OS policy; explicitly out of scope.
6. **Safari / Firefox Android** — separate projects (see `COMPATIBILITY.md`).

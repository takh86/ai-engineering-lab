# تبصرة — Tabsira (browser extension)

A local-only extension for adults who chose to protect themselves online: it blocks websites and search phrases
**you** choose, then turns the moment of blocking into a short, respectful pause with help. It complements the
Android app and Family DNS; it is not a replacement for them and not a proven treatment.

> **Status — release candidate V1.1, not published.** The built ZIPs themselves were extracted and tested in real browsers on Linux:
> Chromium 141, **Google Chrome for Testing 154** (an official Google build — *not* branded stable Chrome), Microsoft Edge 154, Firefox 157
> including Firefox **private windows**. Exact counts, versions and package SHA-256 are in [`TESTING.md`](TESTING.md) and
> [`test-evidence/SUMMARY.md`](test-evidence/SUMMARY.md). **Not verified:** branded Chrome stable, Windows/macOS, Brave, Opera, the AMO-signed
> Firefox build, real user devices. The security review ([`../docs/tabsira-security-review.md`](../docs/tabsira-security-review.md)) is a
> self-review, not an independent audit. Nothing was uploaded, merged or published. Browser table: [`COMPATIBILITY.md`](COMPATIBILITY.md).

## What it does

- **Blocks sites you add** — the site and its subdomains, on DNS label boundaries (`example.com` blocks `mail.example.com`,
  not `badexample.com` or `example.com.evil.org`).
- **Built-in adult-sites list (opt-in)** — a bundled snapshot of 714,093 domains built only from sources whose licence is documented
  (ShadowWhisperer and The Block List Project, both Unlicense; Sinfonietta, MIT; entries that trace only to GPL/unlicensed upstreams were
  removed). Automated and community-made: it **can block innocent sites**; use Exceptions. Sources, licences, pinned hashes and the
  residual legal risk: [`data/base-list/README.md`](data/base-list/README.md). Nothing is downloaded at run time.
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
It is a time stamp in storage — no timer, so a sleeping/restarted worker cannot lose it. The end time is kept in grow-only entries (the
effective end is the maximum), and every change goes through a cross-instance write lock, so a late or concurrent write from another window
**cannot shorten or erase a running session** (regression-tested, including in a real normal + private window pair). When it ends it **only
re-allows editing**; it never removes a rule.

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
stored or logged by Tabsira; the stop page cannot see which rule matched (verified by scanning the profile after blocked visits).
**Your browser itself still records the address you tried to open in its normal history, as for any page** (measured in Chromium) —
Tabsira has no history permission and neither reads nor copies it. The settings export is plain text listing your sites and phrases: keep it
private. Full text: [`store/privacy-policy.html`](store/privacy-policy.html).

| Permission | Why |
|---|---|
| `storage` | Keep your settings across restarts. |
| `declarativeNetRequest` | Let the browser apply the rules itself. |
| Website access (`http://*/*`, `https://*/*`) | Required by the browser to *redirect* a blocked page to the help page for any site you choose. Not used to read or change pages; **no content scripts.** |

Not requested: `tabs`, `webNavigation`, `webRequest`, `history`, `cookies`, `activeTab`, `scripting`, `alarms`, `downloads`.
No `web_accessible_resources` in the Chrome/Edge package, so websites cannot detect the extension by its fixed ID (verified: a hostile page cannot frame, load, script or fetch any extension file); Chrome/Edge do set `incognito: "split"` so the stop page can be shown in private windows. Firefox requires exactly one web-accessible resource (`blocked.html`) for the redirect, and its add-on host is a random per-profile UUID. CSP `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'`.
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
- **Private windows** need the browser's manual "allow in private/incognito" switch (without it the extension is simply not applied there — tested in
  Chromium-family and Firefox). With it: the stop page shows (Chromium `incognito: split`, shared storage; Firefox spans), the commitment holds, weakening
  from the private window is refused. Two windows saving at once are serialised by a lease-based lock; if a worker is frozen for longer than the 20 s
  lease the other one proceeds and the late one is refused (`busy`), and rules are rebuilt from storage.
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

Requires Node ≥ 20.11. No runtime dependencies; dev dependency `playwright-core@1.56.1` (exact) only for Chromium-family tests.

```sh
npm ci
npm test                       # unit + static + adversarial + build-reproducibility tests (no browser)
npm run build                  # dist/tabsira-chromium-1.0.0.zip, dist/tabsira-firefox-1.0.0.zip (byte-reproducible)
npm run verify-reproducible    # builds twice, compares SHA-256
# real browsers - they EXTRACT AND TEST THE BUILT ZIPs (see TESTING.md):
CHROMIUM=/path/to/chromium  node tests/e2e/run.mjs --browser chromium
CHROME=/path/to/chrome      node tests/e2e/run.mjs --browser chrome      # official Google build (Chrome for Testing or branded Chrome)
EDGE=/path/to/msedge        node tests/e2e/run.mjs --browser edge
FIREFOX=/path/to/firefox GECKODRIVER=/path/to/geckodriver node tests/e2e/firefox-run.mjs
FIREFOX=... GECKODRIVER=... node tests/e2e/firefox-private.mjs
node scripts/summarize-evidence.mjs   # test-evidence/SUMMARY.md
node scripts/make-store-assets.mjs    # store/images from the release package
```

The test harness derives variants from the release package by editing `manifest.json` only (extra `declarativeNetRequestFeedback` for the two
checks that call `testMatchOutcome`; host access made optional for the "permission missing" state; a higher version for the update test) and
proves every other file is byte-identical. Most checks run on the unmodified release package.

## Layout

`src/core` pure logic (domains, phrases, rules, settings, session) · `src/background` controller, message validation, browser
adapter, worker · `src/ui` pages (copied flat into the package) · `src/_locales` ar/en/de · `scripts` build, ZIP, base-list updater,
icon/asset generators · `data/base-list` snapshot + provenance + licences + canaries · `src/brand`, `src/fonts`, `src/ui/tokens.css` approved
identity ([`docs/brand/ASSETS.md`](docs/brand/ASSETS.md) — the mark is a **redraw** of the Owner's reference image, not the designer's SVG) ·
`tests` unit and real-browser suites · `store` listing text, privacy policy, images, submission checklist ·
[`UPDATING.md`](UPDATING.md) list/extension update plan · [`CHANGELOG.md`](CHANGELOG.md).

## Proposals needing an Owner decision (not implemented)

1. **In-page search detection** (SPA) — a content script limited to the nine search engines that only watches `location` changes (no DOM
   reading): no new install warning (host access already exists) but new code in pages; privacy review needed.
2. **Block embedded frames/images** from the built-in list (`sub_frame`, `image` types): small change, more coverage, pages may look broken.
3. **Remote list updates** — needs a server/provider and a signed feed; conflicts with the "no server" stance.
4. **Image/screen/DOM classification** — large permission, privacy and cost implications; not recommended for V1.
5. **Stronger removal resistance** — only via enterprise/OS policy; explicitly out of scope.
6. **Safari / Firefox Android** — separate projects (see `COMPATIBILITY.md`).

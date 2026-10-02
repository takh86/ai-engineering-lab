# تبصرة — Tabsira Chrome, personal prototype v0.1

An Arabic, local-only companion extension for desktop Chrome 120+. User-defined domain redirects, selected search-query phrase redirects, commitment sessions and a short Help Now page. No automatic adult-site classification or built-in adult-domain list. Configure your own rules; this complements an existing family DNS setup and does not replace it.

## Install on your computer

1. Extract `Tabsira_Chrome_v0.1.zip` into a permanent folder.
2. Open `chrome://extensions` in desktop Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**, then select the extracted `tabsira-chrome` folder containing `manifest.json`.
5. Open Tabsira → **إعداد الحجب**. No blocking rules are installed initially.
6. Add domain names (one per line), optionally search phrases, then **حفظ القواعد**.
7. For a harmless test, click **أضف example.com للاختبار الآمن**, save, then open `https://example.com` in a new tab. The Tabsira stop page should appear. Remove the test rule afterward, before starting a commitment session.
8. In extension details, manually enable **Allow in incognito** if you want that coverage. Test there separately. Removing or disabling the extension remains possible.

Chrome on Android is not the target. No store publication or Android release is included.

## What it does

- Redirects top-level HTTP/HTTPS requests for the configured domains and their subdomains to a local stop page using Manifest V3 declarativeNetRequest.
- Matches partial phrases in `q`, `p`, or `search_query` URL parameters on Google `.com`, `.de`, `.com.eg`, Bing, DuckDuckGo, Yahoo Search and YouTube.
- Matches normal `encodeURIComponent` encoding, `%20` or `+` spaces, case-insensitive; Unicode phrases normalized to NFC when configured. Alternate encoding, language inflection, diacritics, synonyms and in-page SPA navigation are not guaranteed.
- Installs persistent dynamic rules. A status check compares installed rules with configured rules; this is configuration evidence, not comprehensive protection evidence.
- A 60/90/120-minute commitment prevents removing existing rules through this extension's settings, while allowing new rules. No automatic unblock occurs when commitment expires. Rules remain until edited.
- Local 60-second Help Now timer; its expiry never opens a blocked URL.

## Privacy and permissions

`storage` holds domains, phrases and `lockedUntil`, unencrypted, in `chrome.storage.local`; no browsing URLs, search history, attempt logs, notes, telemetry, account or server. The service worker does not subscribe to browsing events or read page content. Storage is restricted to trusted extension contexts. HTTP/HTTPS host permissions support DNR redirects, and require deliberate user review. There are no content scripts, TLS interception, analytics or external libraries.

## Known limits

Disabling/removing the extension, other browsers/profiles without it, incognito without permission, device-clock changes affecting commitment, local files and already loaded/cached/in-page content are outside its guarantee. It does not blur images, classify posts, lock the OS or verify DNS. The web-accessible stop/help pages expose no browsing data. Opening them directly must not grant access to privileged extension messages from ordinary web pages.

## Verification

Run from this folder with Node 20+:

```sh
npm test
```

2026-10-02: **9 automated tests passed**: domain validation and boundaries, Unicode normalization, search parameter matching, commitment enforcement, worker serialization, storage rollback, configuration status and sender boundary. Worker tests mock Chrome APIs; they are not evidence of native DNR behavior.

All JS syntax checks and manifest/file-reference checks passed. Native Chrome install/redirect/UI/incognito verification remains **NOT RUN**: no local browser binary was available, and the browser download failed. Treat this as a reviewable prototype until the manual checks below pass. Android files were not modified and Android checks were not run.

### Manual acceptance before relying on it

- Empty installation accurately says blocking is not configured.
- `example.com` and its subdomain redirect; `example.org` and `example.com.example.org` do not match its domain rule. Use Chrome's unpacked-extension `testMatchOutcome` for synthetic subdomains rather than opening unknown sites.
- Add harmless phrase `tabsira test`; Google normal search containing that phrase redirects, ordinary search stays accessible. Repeat with `عبارة اختبار`; test both `+` and `%20` spaces.
- Help timer ends without opening a blocked site; keyboard focus and RTL layout are usable.
- Settings and actual rules survive browser restart.
- During a commitment, deletion fails, additions work; after expiry, editing works and no rule disappears automatically.
- Incognito works only after its permission is enabled; other profiles remain explicitly outside coverage.
- Extensions page shows no manifest/worker errors. Review requested permissions before public distribution.

## Scope record

This desktop-only personal prototype implements the Owner's 2026-10-02 instruction to add a Tabsira Chrome extension alongside Project 04. It does not certify or change the Android DNS candidate, Android H9/screen-reading gates, clinical content review, discovery records, release gates or live tracker decisions. No claim of recovery efficacy is made.

# Browser compatibility

Status words: **VERIFIED** (the check ran in that real browser and passed), **FAILED**, **NOT TESTED**, **NOT RUN**
(prepared, could not be executed here, with the reason). Evidence files are in `test-evidence/`; commands and
manual steps are in `TESTING.md`. “Verified” never means a store-published or user-tested release.

| Browser (desktop) | Package | Status | Tested version / OS | Notes |
|---|---|---|---|---|
| Google Chrome — **branded stable** | `tabsira-chromium-*.zip` | **NOT TESTED** | — | The branded installer (`dl.google.com`) was not reachable. Run the manual steps in `TESTING.md` on your Chrome. |
| **Google Chrome for Testing** (official Google build for automation) | `tabsira-chromium-*.zip` | **VERIFIED** (141 PASS · 0 FAIL · 2 NOT RUN) | 154.0.8037.97 · Linux x64 | Full automated suite on the extracted release ZIP, incl. restart, update, private windows, concurrency, faults, identity/zoom, hostile page, performance. Not the branded stable build. |
| Chromium (open source) | `tabsira-chromium-*.zip` | **VERIFIED** (141 PASS · 0 FAIL · 2 NOT RUN) | 141.0.7390.37 · Linux x64 | Same suite. **Not** to be read as "Google Chrome". |
| Microsoft Edge | `tabsira-chromium-*.zip` | **VERIFIED** on Linux (141 PASS · 0 FAIL · 2 NOT RUN) | 154.0.4258.53 · Linux x64 | Same suite and package. **Edge on Windows/macOS: NOT TESTED.** Edge resets connections to some of its own/partner search hosts in the local test setup (bing/yahoo/youtube); the suite therefore asserts "not redirected" there. |
| Mozilla Firefox | `tabsira-firefox-*.zip` | **VERIFIED** with a temporary add-on (43 PASS · 0 FAIL · 1 NOT RUN) | 157.0 · Linux x64 | geckodriver 0.37.1. Signed AMO build and permanent install **NOT TESTED**. Arabic UI inside Firefox NOT RUN (needs the Arabic language pack). |
| Mozilla Firefox — **private windows** | `tabsira-firefox-*.zip` | **VERIFIED** (11 PASS · 0 FAIL) | 157.0 · Linux x64 | Real private windows (`PrivateBrowsingUtils.isWindowPrivate`): with "Run in Private Windows" allowed the stop page shows, the session is shared, weakening is refused; without it the extension is not applied (documented limit). |
| Brave | Chromium package | **NOT TESTED** | — | Not installed here; expected to load the Chromium package, unverified. |
| Opera | Chromium package | **NOT TESTED** | — | Not installed here. |
| Safari (macOS/iOS) | — | **Out of V1** | — | See “Safari later” below. |
| Firefox for Android | — | **Study only / NOT TESTED** | — | See below. |

## Why two packages

| | Chrome / Edge | Firefox |
|---|---|---|
| Background | `background.service_worker` (module) | `background.scripts` (module event page) — Firefox does not support `service_worker` |
| API namespace | `chrome.*` (promises in MV3) | `browser.*` / `chrome.*` (both promise-based in MV3); code uses `browser ?? chrome` |
| Host permissions | granted at install | listed in `host_permissions` but **user-grantable** (verified: the temporary add-on received them, and `permissions.remove` made the status `partial / host_permission_missing`); the onboarding page can request them with a click |
| `storage.local.setAccessLevel` | used (trusted contexts only) | not available; guarded, no content scripts exist anyway |
| `declarativeNetRequest` | dynamic + static rulesets, `isRegexSupported` | same API surface used (dynamic rules, `updateEnabledRulesets`, `isRegexSupported`); Firefox has no `testMatchOutcome` |
| Manifest extras | `minimum_chrome_version: 120` | `browser_specific_settings.gecko.id`, `strict_min_version: 128.0`, `data_collection_permissions: {required: ["none"]}` |
| Redirect target | `blocked.html` needs **no** `web_accessible_resources` (verified) | `blocked.html` **must** be web-accessible for the redirect (verified); host is a random per-profile UUID |
| Private windows | off until the user enables “Allow in Incognito”; `incognito: split` is needed so the stop page can be shown there (verified), storage is shared | off in private windows until “Run in Private Windows” is enabled; only `spanning` exists; **verified** in Firefox 157 (F9.*) |
| Regex limits | 2 KB per rule → Arabic phrase ≈ 12–14 letters | no such limit seen (40 Arabic letters accepted) |
| Cost of the 714k-domain list | ≈ +13–70 MB, enable ≈ 0.1 s | several hundred MB (whole-browser, noisy), enable ≈ 6 s |

No `chrome.*` API is assumed to exist in Firefox: the few non-portable calls are optional (`setAccessLevel?.()`), and
the Firefox manifest differs only where the browsers require it. Facts about Firefox DNR and MV3 were checked against
published Mozilla material via search snippets (official MDN/Chrome docs were not directly fetchable from the build
environment) and **by running the extension in Firefox 157**.

## Firefox for Android — short study (not a V1 requirement)

- Mozilla announced MV3 support on Firefox for Android from Firefox 128, and `declarativeNetRequest` has been available
  since Firefox 113 on desktop. Whether the Android build exposes the **same DNR surface and limits** (especially a
  714k-domain static ruleset, memory on phones, and optional-host-permission prompts) was **not tested**.
- Open points before a mobile release: install path (AMO, supported-extension list on Android), memory/CPU with the
  large ruleset (likely need a smaller mobile list), the options page UX on a small screen (current CSS is responsive
  but untested on a device), and private-browsing behaviour.
- This is a **later track**; it does not block the desktop release. It also overlaps the Android app and Family DNS,
  which remain the primary mobile protections.

## Safari later (out of V1)

Safari Web Extensions need an Xcode wrapper app (macOS/iOS), an Apple developer account, and App Store review.
Safari’s `declarativeNetRequest` has a **different rule limit and redirect behaviour** (static rules only per content
blocker semantics; `extensionPath` redirects have known gaps), so the 714k-domain ruleset and the dynamic-rule
based commitment model would need a redesign and real-device testing. Treat as a separate project.

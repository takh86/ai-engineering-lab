# Browser compatibility

Status words: **VERIFIED** (the check ran in that real browser and passed), **FAILED**, **NOT TESTED**, **NOT RUN**
(prepared, could not be executed here, with the reason). Evidence files are in `test-evidence/`; commands and
manual steps are in `TESTING.md`. “Verified” never means a store-published or user-tested release.

| Browser (desktop) | Package | Status | Tested version / OS | Notes |
|---|---|---|---|---|
| Google Chrome | `tabsira-chromium-*.zip` | **NOT TESTED** as branded Chrome | — | Chromium 141 (the open-source build Chrome is based on) is VERIFIED — see next row. Branded Chrome could not be downloaded in the build environment. Run the manual steps in `TESTING.md` on your Chrome. |
| Chromium | `tabsira-chromium-*.zip` | see `test-evidence/e2e-chromium.json` | 141.0.7390.37, Linux x64 | Full automated suite. |
| Microsoft Edge | `tabsira-chromium-*.zip` | see `test-evidence/e2e-edge.json` | 154.0.4258.53, Linux x64 | Same suite (see TESTING.md for what could and could not run). Windows/macOS Edge NOT TESTED. |
| Mozilla Firefox | `tabsira-firefox-*.zip` | see `test-evidence/e2e-firefox.json` | 157.0, Linux x64 | Driven through geckodriver; add-on installed *temporarily* (an unsigned add-on cannot be installed permanently in release Firefox). |
| Brave | Chromium package | **NOT TESTED** | — | Not installed here. Expected to load the Chromium package; unverified. |
| Opera | Chromium package | **NOT TESTED** | — | Not installed here. |
| Safari (macOS/iOS) | — | **Out of V1** | — | See “Safari later” below. |
| Firefox for Android | — | **Study only** | — | See below. |

## Why two packages

| | Chrome / Edge | Firefox |
|---|---|---|
| Background | `background.service_worker` (module) | `background.scripts` (module event page) — Firefox does not support `service_worker` |
| API namespace | `chrome.*` (promises in MV3) | `browser.*` / `chrome.*` (both promise-based in MV3); code uses `browser ?? chrome` |
| Host permissions | granted at install | listed in `host_permissions` but **user-grantable**; the UI reports `host_permission_missing` and the onboarding page can request it |
| `storage.local.setAccessLevel` | used (trusted contexts only) | not available; guarded, no content scripts exist anyway |
| `declarativeNetRequest` | dynamic + static rulesets, `isRegexSupported` | same API surface used (dynamic rules, `updateEnabledRulesets`, `isRegexSupported`); Firefox has no `testMatchOutcome` |
| Manifest extras | `minimum_chrome_version: 120` | `browser_specific_settings.gecko.id`, `strict_min_version: 128.0`, `data_collection_permissions: {required: ["none"]}` |
| Private windows | extension is off in incognito until the user enables “Allow in Incognito” | off in private windows until the user enables “Run in Private Windows” |

No `chrome.*` API is assumed to exist in Firefox: the few non-portable calls are optional (`setAccessLevel?.()`), and
the Firefox manifest differs only where the browsers require it. Facts about Firefox DNR and MV3 were checked against
published Mozilla material via search snippets (official MDN/Chrome docs were not directly fetchable from the build
environment) and **by running the extension in Firefox 157**.

## Firefox for Android — short study (not a V1 requirement)

- Mozilla announced MV3 support on Firefox for Android from Firefox 128, and `declarativeNetRequest` has been available
  since Firefox 113 on desktop. Whether the Android build exposes the **same DNR surface and limits** (especially a
  937k-domain static ruleset, memory on phones, and optional-host-permission prompts) was **not tested**.
- Open points before a mobile release: install path (AMO, supported-extension list on Android), memory/CPU with the
  large ruleset (likely need a smaller mobile list), the options page UX on a small screen (current CSS is responsive
  but untested on a device), and private-browsing behaviour.
- This is a **later track**; it does not block the desktop release. It also overlaps the Android app and Family DNS,
  which remain the primary mobile protections.

## Safari later (out of V1)

Safari Web Extensions need an Xcode wrapper app (macOS/iOS), an Apple developer account, and App Store review.
Safari’s `declarativeNetRequest` has a **different rule limit and redirect behaviour** (static rules only per content
blocker semantics; `extensionPath` redirects have known gaps), so the 937k-domain ruleset and the dynamic-rule
based commitment model would need a redesign and real-device testing. Treat as a separate project.

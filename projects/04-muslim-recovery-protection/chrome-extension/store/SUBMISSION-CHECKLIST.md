# Submission checklist — everything that needs the Owner

Nothing below has been done. No account was created, no fee paid, nothing uploaded or published.

## Before any submission
- [ ] Review and approve: Arabic/English/German copy (UI, `store/LISTING.md`, privacy policy) by native speakers.
- [ ] Review the **starter search phrases** (`src/core/starter-terms.js`) and the **built-in list decision** (`data/base-list/README.md`).
- [ ] Approve or replace the **temporary icon** (`src/icons/icon.svg`) and the generated screenshots/promo images in `store/`.
- [ ] Decide the Firefox add-on ID (`{6e6f9f5e-…}` is a placeholder GUID; it cannot change after the first AMO upload).
- [ ] Publish `store/privacy-policy.html` at a stable HTTPS URL (any static host, e.g. GitHub Pages) and add the publication date and a contact address (marked in the file).
- [ ] Legal sign-off on redistributing the list (see `data/base-list/README.md` "Open questions").
- [ ] Confirm the target-device manual checks in `TESTING.md` ("Manual steps") on the machines you will actually use (real Chrome/Edge/Firefox release builds, Windows/macOS).

## Chrome Web Store
- [ ] Developer account + one-time registration fee (Owner pays).
- [ ] Upload `dist/tabsira-chromium-1.0.0.zip` (built with `npm run build`).
- [ ] Listing text from `LISTING.md`; icon 128 px, screenshots (1280×800), small promo tile (440×280) from `store/images/`.
- [ ] Privacy practices tab: single purpose, permission justifications, “no data collected” (all in `LISTING.md`), privacy policy URL.
- [ ] Expect extra review time for broad host access (`http://*/*`, `https://*/*`); the justification is in `LISTING.md`.

## Microsoft Edge Add-ons
- [ ] Partner Center account (Owner). Upload the **same** `tabsira-chromium-1.0.0.zip`.
- [ ] Logo (300×300 supplied in `store/images/`; **verify the current required size in Partner Center**), small promo tile, screenshots 1280×800.
- [ ] Same listing/privacy text. Edge was tested as Edge 154 on Linux (see `TESTING.md`), not Windows/macOS.

## Firefox (AMO)
- [ ] Developer account (free). Upload `dist/tabsira-firefox-1.0.0.zip` (**unsigned** — AMO signs it; do not call it a signed release before then).
- [ ] Select the data-collection declaration “none” (already in the manifest) and the source-code submission if asked: this repo + `npm ci && npm run build` (Node ≥ 20.11).
- [ ] Reviewer note: the large `rulesets/base_adult.json` is generated data (provenance in `data/base-list/PROVENANCE.json`), not code.
- [ ] After approval, test the signed XPI once on a clean Firefox profile (permissions prompt, permanent install, restart persistence).

## After publishing (not part of this work)
- [ ] Re-run the real-browser suites on the stores’ versions; verify the store listing text matches behaviour.

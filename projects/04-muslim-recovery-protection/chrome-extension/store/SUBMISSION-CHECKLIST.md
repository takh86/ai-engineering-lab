# Submission checklist — everything that needs the Owner

This is a store-release checklist, separate from feature implementation. The 1.1.0 feature branch/PR and build artifacts are review candidates; no store upload is implied.

## Before any submission
- [x] `alarms` permission: **approved by the Owner** (watchdog for protection recovery, `README.md` "Recovery"); keep its justification in the store form (`store/LISTING.md`).
- [ ] Review and approve: Arabic/English/German copy (UI, `store/LISTING.md`, privacy policy) by native speakers.
- [ ] Review the **starter search phrases** (`src/core/starter-terms.js`) and the **built-in list decision** (`data/base-list/README.md`).
- [ ] Provide the designer's **master SVG** of the mark (the shipped mark is the Owner-supplied vector reconstruction, `docs/brand/ASSETS.md`, `docs/brand/vector/SOURCE.md`) and approve the generated icon, screenshots and promo images in `store/images/`.
- [ ] Decide the Firefox add-on ID (`{6e6f9f5e-…}` is a placeholder GUID; it cannot change after the first AMO upload).
- [ ] Publish the policy at a stable HTTPS URL: `store/privacy-pages/` (index.html + .nojekyll, ZIP included) is ready for a public GitHub Pages repo `takh86/tabsira-privacy` (branch main, root). The 1.1.0 draft in `store/privacy-policy.html` must replace older publication assets after review. Date and contact are filled in. **Not yet published**: creating the repo needs the Owner (the session had no permission to create repositories).
- [ ] *(optional, at your discretion)* Counsel confirmation of the list. The Owner decision stands: the list is ONLY ShadowWhisperer `Lists/Adult` (Unlicense) ∪ Sinfonietta `pornography-hosts` (MIT), as decided; see `data/base-list/README.md` for what was verified (licence covers the files, notices shipped) and what cannot be (the upstream projects do not document where individual entries came from; Sinfonietta's file has 49 contributing authors).
- [ ] Confirm the target-device manual checks in `TESTING.md` ("Manual steps") on the machines you will actually use (real Chrome/Edge/Firefox release builds, Windows/macOS).

## Chrome Web Store
- [ ] Developer account + one-time registration fee (Owner pays).
- [ ] Upload `dist/tabsira-chromium-1.1.0.zip` (built with `npm run build`).
- [ ] Listing text from `LISTING.md`; icon 128 px, Chrome screenshots = new actual1.1.0 images replacing the five older titled images in `store/chrome-web-store/` (1280×800, 24-bit PNG, ZIP included; regenerate with `scripts/make-chrome-store-screenshots.mjs`), small promo tile (440×280) from `store/images/`.
- [ ] Privacy practices tab: single purpose, permission justifications, “no data collected” (all in `LISTING.md`), privacy policy URL.
- [ ] Expect extra review time for broad host access (`http://*/*`, `https://*/*`); the justification is in `LISTING.md`.

## Microsoft Edge Add-ons
- [ ] Partner Center account (Owner). Upload the **same** `tabsira-chromium-1.1.0.zip`.
- [ ] Logo (300×300 supplied in `store/images/`; **verify the current required size in Partner Center**), small promo tile, screenshots 1280×800.
- [ ] Same listing/privacy text. Historical Edge154 results cover1.0.0 only; verify1.1.0 before submission.

## Firefox (AMO)
- [ ] Developer account (free). Upload `dist/tabsira-firefox-1.1.0.zip` (**unsigned** — AMO signs it; do not call it a signed release before then).
- [ ] Select the data-collection declaration “none” (already in the manifest) and the source-code submission if asked: this repo + `npm ci && npm run build` (Node ≥ 20.11).
- [ ] Reviewer note: the large `rulesets/base_adult.json` is generated data (provenance in `data/base-list/PROVENANCE.json`), not code.
- [ ] After approval, test the signed XPI once on a clean Firefox profile (permissions prompt, permanent install, restart persistence).

## After publishing (not part of this work)
- [ ] Re-run the real-browser suites on the stores’ versions; verify the store listing text matches behaviour.

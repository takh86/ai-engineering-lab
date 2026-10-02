# Tabsira browser extension V1 — scope record

Date: 2026-10-02 (updated after the Owner's second instruction the same day — "V1.1 decisions" below). Owner instruction: complete the
Tabsira extension (PR #73 prototype) into a usable V1 with store-ready packages, **without merging or publishing**. This record is the bounded scope for the V1 work; it
supersedes `chrome-personal-v0-contract.md` for the extension only and changes nothing about the Android app,
its decisions, gates or trackers.

## In scope (implemented)
Desktop Chrome and Edge (one Chromium package), Firefox desktop (separate manifest, same core). Blocking of
user domains (+subdomains on DNS label boundaries), a bundled adult-sites snapshot, Arabic/English search
phrases in listed search engines, exceptions, 60/90/120-minute commitment session, “Help me now” pause, local
settings with export/import, Arabic RTL / German / English UI, onboarding, honest status, store materials.

## Out of scope / deferred (unchanged boundaries)
No page/DOM/screen/image reading, no content scripts, no AI classification, no accounts, analytics, server or remote
list/rule feeds, no enterprise policy or device permissions, no tamper-resistance claims, no Android changes, no
Safari (documented in `chrome-extension/COMPATIBILITY.md`), Firefox Android only as a short study.
If closing a gap would need page content, tabs/history/webNavigation permissions or a server, it is a **separate
proposal** needing an Owner decision (see "Proposals needing a decision" in `chrome-extension/README.md`).

## Decisions made by the engineer (routine; revisit if you disagree)
| # | Decision | Reason |
|---|---|---|
| 1 | One shared core (`src/core`, `src/background`) with per-browser manifests produced by `scripts/build.mjs`. | Chrome uses `service_worker`, Firefox `background.scripts`; the rest is identical. |
| 2 | Built-in list is an **opt-in snapshot** shipped inside the package; no remote updates. | Privacy, reviewability, no new server/provider. |
| 3 | **Final (Owner, 2026-10-02):** the list is exactly ShadowWhisperer `Lists/Adult` (Unlicense) ∪ Sinfonietta `pornography-hosts` (MIT) — 242,750 domains, pinned to commits and hashes. Nothing else; The Block List Project and every source without an explicit use/modify/redistribute licence are excluded. | Explicit licence per source, verified to cover the file used; notices shipped. What cannot be verified (origin of individual entries upstream) is stated in `chrome-extension/data/base-list/README.md`. |
| 4 | Precedence: exception > user rules > built-in list. | Lets users fix wrong blocks without weakening their own rules. |
| 5 | Adding an exception, disabling the list/starter terms, removing a rule, resetting, or importing something that does so counts as weakening and is refused during a session. | Owner requirement. |
| 6 | Redirect to a stop page (not `block`) using `host_permissions` for http/https. | Needed to show help at the moment of blocking; cost is a broad permission, justified in the store text. |
| 7 | **Chrome/Edge:** no `web_accessible_resources`, but `incognito: "split"`. **Firefox:** exactly one web-accessible resource (`blocked.html`), no `incognito` key. (The first version of this row said the opposite; it was wrong and is corrected here.) | Chromium: with the default `spanning` mode a private window is redirected but cannot show the stop page (`ERR_BLOCKED_BY_CLIENT`); `split` fixes that and the two instances share `storage.local`, verified, with the cross-instance mutex of V1.1 keeping the commitment consistent. Firefox refuses a redirect to a non-web-accessible page; its add-on host is a random per-profile UUID. |
| 8 | Starter search phrases are small, explicit-seeking, whole-word only; help-seeking words are excluded. | Avoid blocking people who search for help. Needs Owner review. |
| 9 | Arabic UI copy is plain Modern Standard Arabic (prototype used Egyptian dialect). | Broader audience; Owner may prefer dialect — copy review required. |
| 10 | ~~Temporary icon/identity.~~ **Superseded by V1.1 decision 4.** | |

## V1.1 decisions (Owner, 2026-10-02) and how they were applied
| # | Owner decision | Applied |
|---|---|---|
| 1 | Chrome, Edge, Firefox desktop stay in scope; "Google Chrome" and "Firefox Private" must be tested as such; Chromium results are never called Chrome. | Chromium, **Google Chrome for Testing 154** (official Google build, *not* branded stable Chrome — labelled so), Edge, Firefox; Firefox private windows tested in `tests/e2e/firefox-private.mjs`. |
| 2 | Keep the current list but verify source, licences, notices; identify the real upstreams; pin versions; replace what cannot be documented; keep the compressed snapshot in git; add lists only with proof; no remote updates. **Superseded by the final decision (row 3 above): licence-only sources.** | `data/base-list/README.md`, `PROVENANCE.json`, `licenses/`, `THIRD_PARTY_NOTICES.md`. |
| 3 | Fix the commitment-session race found by the independent review, with a deterministic regression test that fails first; coordinate every writer; late writes must not erase or shorten a session. | Grow-only lock keys + cross-instance mutex; `tests/unit/concurrency.test.mjs`; real-browser S16. See `tabsira-security-review.md` F1/F2. |
| 4 | Apply the approved visual identity (palette, Cairo Bold + Tajawal, blue/lime filter mark) to Popup, Options, Onboarding, Blocked, Help; no unverified safety claims, no family/report/monitoring features, no "stop protection" as the primary action; original SVG not claimed. | `src/ui/tokens.css`, `chrome-extension/docs/brand/ASSETS.md`; the mark is a **redraw** from the reference image (not the designer's SVG); contrast and layout tested (`tokens.test.mjs`, S15). |
| 5 | Security and Red Team review; real screenshots; freeze a commit; test the packages themselves; new PR to `main` completing PR #73's prototype; do not merge or publish. | `tabsira-security-review.md` (self-review, not independent — stated); e2e extracts and tests the release ZIPs; new PR. |

## Permission added after the review of `516a4ff` — **approved by the Owner**
`alarms` (no install warning in Chrome/Edge/Firefox) was added to wake the extension after its worker is terminated, so rules left stale by a late write are rebuilt (README "Recovery"; security review F12). It is the only mechanism available without broader permissions. Store listing, privacy policy and README were updated. Approved on 2026-10-02.

## Unresolved decisions (Owner)
- **List licence — final decision taken** (licence-only sources). Remaining for counsel: the upstream projects do not document where individual entries came from (Sinfonietta's file has 49 contributing authors); fallback is ShadowWhisperer alone.
- **Master SVG** of the Tabsira mark (the shipped mark is a redraw), and an approved store icon/promo design.
- **Comprehensive independent audit** (optional before public release). A targeted independent verification of the late-write / late-delete / recovery fixes and of the build (86 tests on `dd0fce9`, identical SHA-256, watchdog and storage code unchanged since the earlier review) was reported by the Owner; it is not a full audit.
- **Branded Google Chrome stable** and Windows/macOS runs (only Chrome *for Testing* on Linux was available).
- Starter phrase list; Firefox add-on ID; hosting and contact address for the privacy policy; Arabic dialect vs MSA; who publishes and when.

## Verification and claims
Real-browser results and their limits are in `chrome-extension/TESTING.md` and `chrome-extension/test-evidence/`.
No efficacy, recovery, “full protection” or tamper-resistance claim is made anywhere. Mocks are not treated as
evidence of declarativeNetRequest, permission or UI behaviour.

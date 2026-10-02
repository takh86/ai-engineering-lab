# Tabsira browser extension V1 — scope record

Date: 2026-10-02. Owner instruction: complete the Tabsira extension (PR #73 prototype) into a usable V1 with
store-ready packages, **without merging or publishing**. This record is the bounded scope for the V1 work; it
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
| 3 | Source: The Block List Project `porn.txt` (Unlicense; header says MIT). | Redistributable, current, plain hostnames. Needs Owner/legal confirmation. |
| 4 | Precedence: exception > user rules > built-in list. | Lets users fix wrong blocks without weakening their own rules. |
| 5 | Adding an exception, disabling the list/starter terms, removing a rule, resetting, or importing something that does so counts as weakening and is refused during a session. | Owner requirement. |
| 6 | Redirect to a stop page (not `block`) using `host_permissions` for http/https. | Needed to show help at the moment of blocking; cost is a broad permission, justified in the store text. |
| 7 | No `web_accessible_resources`; no `incognito: "split"`. | Verified unnecessary; removes site fingerprinting and a bypass path. |
| 8 | Starter search phrases are small, explicit-seeking, whole-word only; help-seeking words are excluded. | Avoid blocking people who search for help. Needs Owner review. |
| 9 | Arabic UI copy is plain Modern Standard Arabic (prototype used Egyptian dialect). | Broader audience; Owner may prefer dialect — copy review required. |
| 10 | Temporary icon/identity. | No approved Tabsira identity assets were found in the repository (only the lab logo). |

## Unresolved decisions (Owner)
List licence/provenance sign-off; keeping a 4.8 MB binary snapshot in git; starter phrase list; final identity assets;
Firefox add-on ID; hosting and contact address for the privacy policy; Arabic dialect vs MSA; who publishes and when.

## Verification and claims
Real-browser results and their limits are in `chrome-extension/TESTING.md` and `chrome-extension/test-evidence/`.
No efficacy, recovery, “full protection” or tamper-resistance claim is made anywhere. Mocks are not treated as
evidence of declarativeNetRequest, permission or UI behaviour.

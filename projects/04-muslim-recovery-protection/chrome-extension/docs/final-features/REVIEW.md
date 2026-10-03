# Tabsira 1.1.0 final feature review — 2026-10-03

Six implemented feature groups have separate commits in [PR75](https://github.com/takh86/ai-engineering-lab/pull/75). Requirements are in [CONTRACT.md](CONTRACT.md). The review is reopened after follow-up objections. Integration with the separate local 1.0.1 branch, fresh installed-browser verification and the owner store/privacy decision remain unresolved. All follow-up findings are tracked in FOLLOWUP-REVIEW.md. Four earlier independently substantiated P1 defects were fixed and their regression cases pass; that does not clear the newer findings. This is an engineering review, not a comprehensive security/clinical/religious audit.

**Historical PR candidate evidence (before the follow-up local changes below):** The product source frozen at local `e0b3a3134c0cf85b416ae29311f2096bc9732ced` is byte-identical (Git tree `51f5783e6e810b66a06318a27651d455035fa787`) to GitHub `4047f32e1ffdce953130402e79c75b912fd3ad79`. Subsequent test/docs commits do not change installed files or package hashes.

See [FOLLOWUP-REVIEW.md](FOLLOWUP-REVIEW.md) for current local corrections and remaining blockers. The following results and package hashes certify the earlier PR candidate, not the revised working tree.

## Features and verification

| Feature | Implemented behavior | Evidence |
|---|---|---|
| Identity/popup | Approved six-color light/dark styles, local Cairo/Tajawal, honest status/shield/countdown, explicit current-site block | Tokens/audit/models, packaged imports, AR/EN/DE browser pages |
| Security | Worker gates, optional encrypted vault, independent password/code recovery, restart lock |13 security tests, combined worker/corruption/large-record regressions, installed-browser recovery |
| Protection | Mandatory licensed core, extras, overnight weekly schedules, frozen minimum60-minute delay and explicit verified early exit |14 feature/race tests plus legacy concurrency/late-write/cleanup tests, actual mandatory-core DNR redirect; schedule persistence/validation |
| Recovery/help/covenant |30 localized steps, custom/favorite/unsuitable handling, five stages, optional faith, capacity deeds, optional review save |7 models, schema checks, installed AR/EN/DE pages and expanded click tests |
| Setup/settings |Religion/faith choice independent of language, local preferences/notes/password, actual domain preview, schedule editor/stale-draft preservation |4 models/localization checks, source review, installed pages/click-based setup |
| Prayer |Off-default opt-in, manual location/time zone/method, local calculation, optional gesture permission, safe cancellation/deduplication |15 calculation/lifecycle/UI-ordering tests; real OS notification delivery not yet checked |

**147/147 unit/static tests PASS**, locally, in independent integrated rerun, and on GitHub Node22.23.3. Checks include locale/error keys, CSP, packaged imports, approved contrast and reproducible ZIPs. Controller review: **10/10 PASS**, plus actual service-worker capability harness PASS. These execute real modules with simulated browser adapters and cannot prove DNR or notification delivery.

```sh
node tests/review/controller-regressions.mjs
node tests/review/worker-capabilities.mjs
```

Installed release-ZIP acceptance: **57/57 PASS** on Chromium141.0.7390.37/Ubuntu24.04, [run37115823692](https://github.com/takh86/ai-engineering-lab/actions/runs/37115823692). ZIP hashes match the local build exactly. Expanded setup/help/recovery/covenant click checks also passed. Tested GitHub head: `96983d4da8ffde419eccd480b595c9ec0457c4ad`. An earlier visibility assertion was corrected to wait for the asynchronous setup panel; product code was unchanged.

Local browser attempt: **NOT_RUN**, persistent Chromium profile failed `socket(): Operation not permitted`. CI provides actual installed-browser evidence instead. Local failure is retained separately and never counted as a pass. Historical1.0.0 browser results do not certify1.1.0.

## Findings and corrections

| Finding | Cause | Fix/regression |
|---|---|---|
| RT1 P1 valid password could never finish early exit |Protection-held shared mutex recursively acquired by verifier |Verify outside protection mutex; revalidate exact request/credential generation under fencing. Valid mature exit passes; cancel/new session/rotation/expiry refuse stale proof |
| RT2 P1 new shorter commitment vanished |Released long lock dominated storage compaction |Rank unreleased immutable locks; new shorter commitment survives released-lock and paused-cleanup races |
| RT3 P1 opted-in reminders failed |Prayer-held mutex recursively acquired profile getter |Validated lock-free snapshot under prayer mutex; current eligibility revalidated. Actual security+prayer test delivers once while locked and refuses obsolete profile |
| RT4 P1 large valid vault save corrupted records |Ciphertext bound ignored base64 expansion |Bound encrypted envelope correctly and validate before persistence.60×3500-character ideas survive save/restart/unlock/recovery |
| Integration import defect |Flattened UI ../core path escaped installed package |Move pure popup modules into core; inspect every packaged relative import |
| Schedule stale-draft issue |Old revision persisted after another tab saved |Refresh authoritative schedules/revision on stale response, retain editor fields, explicit retry |

The RT3 fixture explicitly selects Muslim+faith to match final eligibility. Noneligible profiles are correctly silent; this fixture correction did not alter product code.

## Packages

| Package | SHA-256 |
|---|---|
| tabsira-chromium-1.1.0.zip |`2f8eaa576a020d01b62758ac04a3402d4ecf231d7d08ec8b5da6a7bb8090aa63`|
| tabsira-firefox-1.1.0.zip |`7489c0df23645c0f4208ab3593e7062aafc19d354a81e72f8e1d4a3d557ba352`|

Both targets and second builds are byte-identical. GitHub artifacts expire after14days; hashes identify the candidate independently.

## Boundaries and release review

Firefox runtime/signed add-ons, Chrome stable/Edge, private-window integration of new features, Windows/macOS and user devices remain unverified for1.1.0. The activeTab prompt and delivered prayer notifications need target-browser/manual checks. Pure tests check request ordering/permission gates, not OS delivery. Native-language/religious copy and device UX remain human review focus.

Passwords do not resist owner uninstall, developer tools, clock changes or a compromised device. Public preferences (including religion/manual prayer coordinates) and protection rules are local but unencrypted; vault encryption starts when a password is enabled. Losing password and code has no account/email recovery. Recovery never clears protection/commitment. No cloud/backend/device biometrics are implemented.

Store upload/signing, production policy deployment and main merge remain owner release decisions. No store publication is claimed.

## Content and calculation references

Faith copy includes full Quran39:53 and11:114, optional repentance prayer, required purification and good deeds by capacity, without a mandatory amount. References checked by feature agents: [KSU39:53](https://quran.ksu.edu.sa/tafseer/qortobi/sura39-aya53.html), [KSU11:114](https://quran.ksu.edu.sa/tafseer/katheer/sura11-aya114.html), [Dar al-Ifta purification](https://www.dar-alifta.org/ar/fatwa/details/17269/), [repentance prayer](https://islamqa.info/ar/answers/98030). General support references [WHO Doing What Matters](https://www.who.int/publications/i/item/9789240003927) without treatment/recovery promises.

Local solar calculations reference [USNO](https://aa.usno.navy.mil/faq/sun_approx), [PrayTimes conventions](https://praytimes.org/docs/calculation) and [NASA ephemeris](https://eclipse.gsfc.nasa.gov/TYPE/sun1.html). Prayer times are estimates; conventions, adjustments, time zone and unavailable high-latitude results are explicit.

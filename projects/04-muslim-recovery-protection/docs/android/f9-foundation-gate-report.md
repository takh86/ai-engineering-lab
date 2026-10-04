# F9 DESIGN FOUNDATION GATE REPORT

Status: implementation, independent review, red team, fix loop and the Owner's pre-gate closure (C1 to C5) complete. **Not merged.** Awaiting Tech Lead Feature Gate and Owner review.
Play artifacts remain NOT authorized for Google Play upload. Nothing here claims accessibility compliance or local (non-CI) verification of Android behavior; CI is the objective gate.

Specification: `f9-design-foundation-task-record.md`. Usage guide: `design-foundation.md`. Fonts: `font-sources-and-licenses.md`. Release boundary: `release-boundary.md`.

## 1. Final head, branch, commits
- **Branch:** `ccr-e2ef6a06-p8z2wo`, based on `main` (`207f352`). 73 files changed (`git diff --name-status origin/main...HEAD`), `chrome-extension/**` untouched.
- **Final code head: `55b8f1034a2c4663c6d5ff528b8210e4411ec18c`.** Full CI on exactly this head, all green on the first run after the closure:
  push run 23 and pull_request run 24 of *Project 04 Android CI* (7 jobs each: tool self-tests and diff guards, build/test/lint both flavors with release boundary and LocaleConfig proof,
  M1 equivalence, baseline, existing-tests-preserved, API 30 and API 34 managed devices) and the legacy *M1-07 Verification Gate* run 72.
  The commit that adds this report changes documentation only; the pull_request run on the final PR head is reported in the PR.

| Commit | Content |
|---|---|
| `a0c9622` | F9 task record (contract v2 + E1 to E10), font provenance |
| `c7afdf2` | IR-A: `UiLanguage` retired from `SettingsStore` |
| `1357c8e` | IR-B/C: AppCompat 1.8.0, generated LocaleConfig, RTL, locale service, AppCompat theme, non-translatable placeholder names |
| `91dedf0` | IR-D: W0b diff guard post-W0b mode (Owner-approved, D-F9-GUARD) |
| `95b4fc6` | design foundation: tokens, theme, typography, 7 primitives, locale controller, JVM tests |
| `03910d3` | release-boundary: exactly the resolved AppCompat coordinates |
| `d0e03f8` | managed devices, instrumentation tests, results gate, first LocaleConfig check (IR-D) |
| `735c45a` `a334ca4` | `ColorScheme` constructor; instrumentation test defects |
| `9c296de` | independent-review and red-team fixes |
| `428c3d0` | 200% font-scale test hosted in a scrolling column |
| `b83380e` | earlier (pre-closure) gate report |
| `35194e9` | **D-F9-FONT** Cairo Bold static instance (Option B); **D-F9-LICENSE** shipped OFL notices |
| `dfbb45e` | **C1** component key encodes `enabled`; locale-service metadata verified |
| `55b8f10` | **C2** linked LocaleConfig reference proof; shipped-notice assertion |

Exact files: see the list in `git diff --name-status origin/main...HEAD`. Groups: `core/design/**`, `core/data` (ThemeMode only), `MainActivity`, manifest, `build.gradle.kts`, resources
(`res/font/{cairo_bold,tajawal_regular}.ttf`, `assets/licenses/OFL-*.txt`, `resources.properties`, `values*/strings_common.xml`, `design_colors.xml`, `themes.xml`, `strings.xml`, internal `strings.xml`),
unit tests, six instrumentation test classes, `ci/*`, `release-boundary/*`, `tools/fonts/*`, the workflow, `.gitignore`, five documents.

## 2. AppCompat 1.8.0 dependency evidence
Only new direct library: `androidx.appcompat:appcompat:1.8.0`. It resolved and built in CI. The release-boundary report listed exactly **14 new coordinates, all AndroidX**, which are the only allow-list additions:
appcompat, appcompat-resources, cursoradapter, customview, drawerlayout, emoji2-views-helper, fragment, lifecycle-livedata, lifecycle-livedata-core-ktx, loader, resourceinspection-annotation,
vectordrawable, vectordrawable-animated, viewpager (appcompat plus 13 transitives; none unexpected). `playReleaseRuntimeClasspath` now has 112 allowed coordinates; findings against allow-lists: **0**.
No font-generation package is on the Android dependency graph (fontTools lives only in `tools/fonts/requirements.txt`).

## 3. Component allow-list (release boundary)
Key format is now `tag|name|exported|enabled|permission|filters`. The play release artifact contains exactly these 4 components (CI discovered list = allow-list, 0 violations):

| Component | exported | enabled |
|---|---|---|
| `MainActivity` (launcher) | true | unset |
| `androidx.startup.InitializationProvider` | false | unset |
| `androidx.profileinstaller.ProfileInstallReceiver` (DUMP-guarded) | true | true |
| `androidx.appcompat.app.AppLocalesMetadataHolderService` | **false** | **false** |

`autoStoreLocales=true` on the locale service is verified as required metadata (hard failure if missing or different, or if the component is absent), on the play and the internal artifact.
Mutation self-tests (release-boundary suite, 53 tests) prove these are caught: `enabled=false` to `true`, the `enabled` attribute dropped, `autoStoreLocales` false, `autoStoreLocales` missing, service removed.
A focused JVM manifest test asserts the same state in the source manifest. No permission was added.

## 4. Fonts
Both fonts are bundled; headings, titles and buttons use Cairo Bold, body text Tajawal Regular; **no `FontFamily.Default` remains** in the design sources (asserted).

**Cairo Bold: a generated static instance (Owner Option B, explicit exception to the earlier STOP rule).**
| Item | Value |
|---|---|
| Upstream | `https://github.com/Gue3bara/Cairo`, commit `73d16933c6a0f341c27a69e401da83dcb0d53114` |
| Input | `fonts/Cairo/variable/Cairo[slnt,wght].ttf`, SHA-256 `667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964` (identical in `google/fonts`) |
| Instance | `wght=700`, `slnt=0`, all axes pinned |
| Tool | fontTools **4.55.3** (`varLib.instancer`), pinned in `tools/fonts/requirements.txt`; script `tools/fonts/generate_cairo_bold.py` refuses other inputs/versions |
| Deterministic command | `python3 tools/fonts/generate_cairo_bold.py <input.ttf> app/src/main/res/font/cairo_bold.ttf` (two independent generations gave the same hash) |
| Output | `cairo_bold.ttf`, 164,796 bytes, SHA-256 `5fa21b9d998565e30b9a6173240f88869eeccd8bb4634f08e0f77a4404b52feb` |
| Form | static TrueType (`glyf`, sfnt 0x00010000), no `fvar/gvar/avar/STAT/HVAR/MVAR/cvar`; `OS/2.usWeightClass=700`, bold bits set; name table and coverage in `font-sources-and-licenses.md` |
| License | SIL OFL 1.1; the upstream copyright line declares no Reserved Font Name (a factual reading, not a legal opinion) |

**Tajawal Regular:** upstream static font, unmodified. `google/fonts` `ofl/tajawal/Tajawal-Regular.ttf`, SHA-256 `6882892da3e03527d5db2bbab3b48bde6ef2e878a43f522d1a4eebda90010a19`, upstream commit `2085b894...`
(from `METADATA.pb`), weight 400. Gaps: fetched from the `main` ref (the hash pins the content); name table says "(c) 2017" while OFL.txt says 2018 (unreconciled upstream text).

**Font gate (C3), JVM `FontCoverageTest`:** both files match the recorded SHA-256 (a changed hash fails the test and needs explicit review), are static TrueType, have the expected weight (700 and 400), and cover A-Z a-z 0-9,
ä ö ü ß Ä Ö Ü, the Arabic letters, harakat and Arabic-Indic digits by parsing their own cmap. `TypeScaleTest` and the instrumented `TypographyFontsTest` prove headings/buttons use Cairo Bold and body uses Tajawal Regular.
Instrumented `FontFamilyTest` (API 30 and 34): both resources load as typefaces. Not exercised: API 24 to 29.

**Bundled OFL notices (D-F9-LICENSE):** `app/src/main/assets/licenses/OFL-Cairo.txt` (SHA-256 `a4554e17...62a9`) and `OFL-Tajawal.txt` (SHA-256 `9b584984...db87`). CI listed both in the final play release APK
(`/assets/licenses/OFL-Tajawal.txt`, `/assets/licenses/OFL-Cairo.txt`) and an instrumented test reads them. No About/Settings screen was added.

## 5. Linked LocaleConfig proof (C2)
CI on the final **play release APK**, using `apkanalyzer` and `aapt2 dump resources`:
```
manifest android:localeConfig = @ref/0x7f100000
resolved resource id          = 0x7f100000
resource table entry          = xml/_generated_res_locale_config
resource file                 = res/Ed.xml
locales                       = ['en', 'ar', 'de'] (expected ['en', 'ar', 'de'])
resource table entries parsed = 1367
LocaleConfig linked-reference proof OK
```
The manifest reference is resolved through the resource table to its file, and only that file is decoded; a reference to any other resource, a dangling id, a non-XML resource, a config with other locales, or a valid config the
manifest does not reference cannot pass (mutation self-tests, `ci/test_check_locale_config.py`). SYSTEM as the empty application locale list is proven at runtime by `AppLanguageControllerTest`.
AGP generated the config (`generate*LocaleConfig` tasks); there is no hand-written file.

## 6. Contrast matrix (computed WCAG 2.x ratios of the token constants, reproduced by `ContrastTest`; not a compliance claim)
| Pair | Ratio | Use |
|---|---|---|
| navy on white / on `#F3F6FB` | 10.31 / 9.52 | text |
| navy on lime | 6.97 | primary label |
| royal on white; white on royal | 6.63 | links, dark cards |
| white on navy; lime on navy | 10.31; 6.97 | dark text; dark focus/fill |
| lime on royal | 4.48 | non-text and large text only |
| sky on white / navy | 3.27 / 3.15 | graphics and the Light card hairline only |
| lime on white | 1.48 | forbidden foreground; the primary button always has a navy border on Light |
| royal on navy | 1.56 | dark cards do not separate by contrast; grouping relies on spacing/headings |

All declared text pairs are at least 4.5:1 and non-text pairs at least 3:1, Light and Dark. Lime and sky are never text roles. Every Material3 slot of the real scheme is a brand color (instrumented test).

## 7. EN/AR/DE parity
`ResourceParityTest` (JVM, each rule also tested against synthetic bad input): `strings_common.xml` complete in `values-ar` and `values-de` (5 keys), kinds, positional placeholders, plural/array shapes, empty/self-closing entries, duplicates,
key prefixes (including multi-word feature files), no unsupported locale folders; placeholder `app_name` and internal strings non-translatable. `lint` has `MissingTranslation` and `ExtraTranslation` as errors (green).
`LocaleAndRtlTest` on both devices: EN LTR, DE LTR, AR RTL with mirrored layout, English fallback for an unshipped locale.

## 8. Executed test counts (final head `55b8f10`)
- **API 30 managed device (play debug):** 24 instrumentation tests in 8 classes, 0 failures, 0 errors, **0 skipped**.
- **API 34 managed device (play debug):** 24 instrumentation tests in 8 classes, 0 failures, 0 errors, **0 skipped**.
  Per class: `ThemeRenderingTest` 4, `LocaleAndRtlTest` 6, `ComponentSemanticsTest` 6, `FontFamilyTest` 3, `AppLanguageControllerTest` 1, `TypographyFontsTest` 1, `ProductShellTest` 1, `PlayHasNoHistoricalExperimentTest` 2.
  The results gate (`--min-tests 24`, eight required classes, suite-level counters, distinct test cases) passed on both. Managed devices: Pixel 2, `aosp_atd` x86_64, API 30 (AppCompat locale backport path) and API 34 (platform per-app language path); no deviation; no third-party Action.
- **JVM unit tests (CI):** internal 26 classes / **281** tests, play 15 classes / **126** tests, 0 failures, 0 errors, 0 skipped (W0b baseline 231 / 76). Existing-test preservation job green.
- **Python self-tests:** `ci/` 43, `release-boundary/` 53 (all green in CI "tool self-tests" and locally).

## 9. Independent Review (separate agent) and Red Team (separate agent): findings and fixes
- **Review, fixed:** string-array regex swallowed following strings; committed `.pyc`; broad guard edit (now the exact approved `strings.xml` text only); vacuous font-coverage test (now each font's own cmap + SHA-256); SYSTEM theme test only covered Light (now day and night);
  Light cards nearly invisible (Light border is sky); `remember(tokens)`; stale comment; test margin. Documentation claims were corrected.
- **Red team, fixed:** diff guard bypass through quoted/non-ASCII/tab paths (NUL-separated parsing, reproduced and re-tested); instrumentation checker ignored suite counters, crashed suites, flaky markers, duplicates; locale checker tie and unparseable candidates
  (since replaced by the linked proof); scanner and parity gaps; internal manifest and Kotlin roots frozen; vpn/dns forbidden in every product source set.
- **Regression tests added:** guard hardening tests, results-checker mutations, parity and scanner bypass cases, FontCoverageTest, linked-reference mutations, enabled/metadata mutations.
- **Open (not F9 blockers):** workflow `paths:` omits `chrome-extension/**` (D-F9-TRIGGER-GAP, acknowledged, deferred, separate CI-hardening follow-up; F9 did not change workflow path triggers); `translatable="false"` is unrestricted.

## 10. Accepted residual risks
Theme first frame may show the wrong theme when the explicit choice differs from the system theme (E7, accepted with a visual gate); AppCompat blocking I/O on API <= 32 (E3, accepted standard behavior); API 24 to 29 are not on a managed device and locale persistence across process death is untested;
the 3-button navigation-bar contrast with an in-app Dark choice is unverified; the Cairo instance is generated, not upstream-published (Owner-approved); font copyright text is unreconciled upstream text; scanners are regex-based; a Cairo or Tajawal hash change requires explicit review by design.

## 11. Manual Owner-device acceptance still outstanding
EN/AR/DE x Light/Dark; SYSTEM/LIGHT/DARK including a restart where the explicit theme differs from the system theme (E7 first-frame check); font scale 1.0, 1.3, 2.0 and largest display size; TalkBack; 3-button navigation bar contrast;
Cairo Bold headings and Tajawal body against the identity sheet; the OFL notices in the installed APK.

## 12. Unlocked for F1, F3 and F5 (subject to Owner/Tech Lead acceptance of this gate)
- **Theme and tokens:** `TabsiraTheme(themeMode)` (hosted by `MainActivity`), `TabsiraDesign.colors`, `MaterialTheme.colorScheme/typography/shapes` mapped to Tabsira tokens; `TabsiraSpacing`; no color, font or left/right literals.
- **Primitives:** `TabsiraScreen` (use `scrollable = true` when content can exceed the viewport), `PrimaryButton`, `SecondaryButton`, `TextAction`, `TabsiraTextField`, `SectionCard`, `SelectableOption`.
- **Localization:** per-feature `strings_<feature>.xml` in `values/`, `values-ar/`, `values-de/` with enforced parity and key prefixes; `strings_common.xml` for generic words; `AppLanguageController` / `SupportedLanguage` (the persistent language owner is AppCompat; `UiLanguage` no longer exists); `ThemeMode` in `SettingsStore`.
- **Fonts:** Cairo Bold for headings/buttons, Tajawal Regular for body, via the theme only.
- **Not provided:** Settings screen, About/Licences UI, Design Gallery, `StatusBanner`, top bar, dialogs, numeral policy (OD-F9-4 deferred), logo/icon/public name/discreet identity. F1's persisted onboarding state still waits for F7.

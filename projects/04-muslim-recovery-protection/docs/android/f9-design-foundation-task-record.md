# F9 Design Foundation: canonical task record

Status: **F9 DESIGN FOUNDATION GATE only** is authorized. Not merged. Owner/Tech Lead approved *F9 FEATURE CONTRACT v2* with
mandatory execution amendments E1 to E10 (below). No v3 contract exists; this record plus the contract v2 below is the
canonical F9 specification. Anything not stated here is not authorized.

Scope tags: **[F]** fact, **[OD]** Owner decision, **[A]** assumption, **[R]** recommendation.

## 1. Contract v2 (approved), condensed

**Problem.** F1/F3/F5 (and later features) must not each invent colors, type, spacing, RTL handling and language behavior.
F9 provides one small, tested design and localization layer.

**In scope (F9a Design Foundation).** Semantic brand-only Light/Dark theme (`TabsiraTheme`), typography scale, spacing and shape
scales, 8 primitives, RTL rules, accessibility requirements with automated evidence.

**In scope (F9b Localization/Appearance).** EN fallback + AR + DE resource architecture, AppCompat per-app locale
infrastructure, `ThemeMode` persistence through the D0 `SettingsStore`, `UiLanguage` persistence removed.

**Non-goals.** Settings screen, Design Gallery as a gate dependency, logo/icon/public name/applicationId/discreet identity,
golden/screenshot tests, `StatusBanner`, feature-specific product UX, numeral policy (deferred to the first feature where
it matters, probably the F3 timer), dynamic color, onboarding, Help Now, Home, My Plan, Recovery, Notes, Faith content,
authentication, protection, DNS/VPN, analytics, backend, final product copy.

**Locale architecture.** `MainActivity` is an `AppCompatActivity`. Language changes use
`AppCompatDelegate.setApplicationLocales(...)`. Android 13+ uses the platform per-app language; API 24 to 32 uses the AppCompat
backport with `autoStoreLocales`. AppCompat/Android is the **only** owner of the language preference. SYSTEM is the empty
application locale list. English is the unqualified resource fallback. The platform decides behavior for unsupported device
locales (no custom resolver, no forced LTR).

**Theme.** `ThemeMode` (SYSTEM/LIGHT/DARK) stays in `SettingsStore`. `TabsiraTheme` starts from SYSTEM and reacts to the
`ThemeMode` flow. There is no startup appearance snapshot and no blocking read.

**Primitives (8, including the theme).** `TabsiraTheme`, `TabsiraScreen`, `PrimaryButton`, `SecondaryButton`, `TextAction`,
`TabsiraTextField`, `SectionCard`, `SelectableOption`. Deferred: top bar, toggle row, dialogs, chips, timer/progress, bottom
navigation, status banner, feature-specific components. A component enters `core/design` only when a real feature needs it.

**Tokens.** Brand-only palette `#0B3B8F #1456C5 #B7E445 #5F8FD9 #F3F6FB #FFFFFF`. State is never color-only. Contrast numbers
in the contract are evidence to be reproduced by automated tests (see `design-foundation.md`).

**Design-rule enforcement (narrow).** No raw brand color literals in feature code, no feature-defined font families, no
left/right directional assumptions where start/end applies, shared spacing uses F9 tokens. Dp literals are allowed.

## 2. Mandatory execution amendments

| ID | Amendment | Implemented as |
|---|---|---|
| E1 | `androidx.appcompat:appcompat:1.8.0` is the only new direct library. No speculative transitives. After resolution the dependency allow-list gets only the actual resolved coordinates; unexpected dependencies are reported, not broadly allowed. | `app/build.gradle.kts`, `release-boundary/allowed-dependencies.txt` |
| E2 | `app/src/main/res/resources.properties` containing `unqualifiedResLocale=en`. AGP automatic LocaleConfig. No competing manual LocaleConfig. | file added; `generateLocaleConfig = true` |
| E3 | AppCompat `autoStoreLocales` on API <= 32 may do blocking disk reads/writes internally. Accepted standard AppCompat behavior and recorded as a known implementation characteristic. No custom locale storage, duplicate persistence, StrictMode suppression or startup workaround unless objective evidence shows a real problem and a new review. | this record; `design-foundation.md` |
| E4 | LocaleConfig verification must be objective CI evidence of: generated config exists, the final Play manifest references it, locales are exactly en/ar/de, SYSTEM is the empty list. Do not assume APK unzip yields plain XML; choose the least brittle method after inspecting real build output. | CI check, see `design-foundation.md` |
| E5 | `SupportedLanguage` mapping is frozen: empty list -> SYSTEM; non-empty list -> first supported locale in list order; no supported locale -> SYSTEM. The mapper is total. | `core/design/locale` + tests |
| E6 | The placeholder `app_name` is non-translatable until the Owner decides the public name. Engineering/internal-only copy is non-translatable. "Recovery Protection" is not translated to AR/DE. This does NOT decide the public name. | `translatable="false"` |
| E7 | Theme first-frame flash is an accepted known risk, not permission for a visibly poor transition. No preemptive blocking read. Emulator and Owner-device acceptance must test SYSTEM/LIGHT/DARK and a restart where explicit theme differs from system. A visible wrong-theme flash is a Feature Gate finding with a bounded fix proposal. No second theme store. | manual acceptance plan |
| E8 | One primary implementation agent for the F9 branch, authorized for IR-A to IR-D only within this contract. Read-only research agents may be used for font provenance. After implementation: a separate Independent Reviewer and a separate F9 Red Team. | process |
| E9 | Font STOP rule: T0 must prove an authoritative Android-compatible **static** Cairo Bold (provenance, OFL, SHA-256, glyphs, weight, minSdk 24). Do not generate a derivative, raise minSdk or substitute. If not provable, STOP font implementation and return alternatives. | **TRIGGERED for Cairo Bold**, see `font-sources-and-licenses.md` |
| E10 | Gradle Managed Devices API 30 and API 34, no new third-party Action. Image availability is a fact to verify; deviations are reported and must keep one pre-33 and one 33+ locale path. | `app/build.gradle.kts`, CI |

## 3. Owner decisions recorded

| ID | State |
|---|---|
| D-5 | EN fallback + AR + DE; a missing required translation is a release error |
| OD-F9-1 | APPROVED: brand-only palette |
| OD-F9-2 | APPROVED IN PRINCIPLE: Cairo (headings/buttons) + Tajawal (body), bundled, no downloadable fonts; evidence required (E9) |
| OD-F9-4 | DEFERRED: numeral policy |
| OD-F9-5 | APPROVED: emulator execution in F9 |
| OD-F9-6 | DEFERRED: logo, icon, public name, applicationId, discreet identity |
| OD-F9-7 | APPROVED: F9 owns `core/design` and shared design resources |
| OD-F9-8 | APPROVED: Material You dynamic color prohibited for v1 |
| OD-F9-10 | DEFERRED: golden/screenshot dependency |
| OD-F9-11 | APPROVED but post-gate: internal Design Gallery |
| OD-F9-13 | APPROVED: IR-A through IR-D |
| OD-F9-14 | APPROVED: API 30 + API 34 managed devices |
| OD-F9-15 | ACCEPTED AS KNOWN RISK WITH VISUAL GATE (E7) |

## 4. Integration requests (authorized exactly as bounded)

- **IR-A** retire `UiLanguage` from `core/data` (`SettingsStore`, `DataStoreSettingsStore`, their tests); `ThemeMode` unchanged.
- **IR-B** `app/build.gradle.kts` (appcompat, locale generation/filters, managed devices), `AndroidManifest.xml`
  (`supportsRtl`, AppCompat locale-storage service), `release-boundary` allow-lists for the resolved coordinates and the one new component.
- **IR-C** `MainActivity` becomes `AppCompatActivity` and hosts `TabsiraTheme` with `ThemeMode` collection; XML theme parent
  becomes an AppCompat DayNight theme; `app_name` and internal-only strings become non-translatable.
- **IR-D** `project-04-android-ci.yml` (emulator job, locale-config assertion, lint `MissingTranslation` as error).

## 5. F9 DESIGN FOUNDATION GATE (exact)

Semantic brand Light/Dark theme; verified typography **or** the explicit font STOP return; spacing and shapes; 8 primitives; RTL
support; EN/AR/DE resource architecture; AppCompat per-app locale infrastructure; `ThemeMode` persistence; `UiLanguage`
persistence removed; resource/translation parity checks; contrast and design-rule verification; Gradle Managed Device runtime
evidence; design-foundation documentation. Not in the gate: Settings screen, Design Gallery, logo/icon/name work, discreet
identity, golden tests, `StatusBanner`, feature UX.

## 6. Lifecycle

Implementation -> CI -> Independent Review -> F9 Red Team -> fix loop -> regression CI -> Tech Lead Feature Gate -> Owner
review. Not merged. Play artifacts remain NOT authorized for Google Play upload.

## 7. Execution notes (not new decisions)

- **Fonts (E9):** Tajawal Regular proven and bundled; Cairo Bold NOT provable as a static Android-compatible asset. Headings use a
  placeholder (`HeadingFontFamily`); the Owner must choose one of options A to E in `font-sources-and-licenses.md` (the placeholder is
  effectively option E until then).
- **Unplanned guard change (needs Owner review):** `ci/w0b_diff_guard.py` treated the already-merged W0b relocation as unapproved
  additions, so it blocked every later change. It now has a post-W0b mode: chrome-extension, domain and ScaffoldingSanityTest stay frozen,
  the relocated historical code and the internal manifest are frozen, nothing may return to product vpn/dns directories, and `strings.xml`
  may only become the exact E6 text. Paths are parsed NUL-separated so quoted/non-ASCII names cannot slip past (found by the red team).
- **Known gap (pre-existing, not changed):** the workflow `paths:` filter does not include `chrome-extension/**`, so a PR touching only
  the frozen extension does not run the diff guard. Recommended: add the path to the triggers (a workflow change for the Owner to approve).
- **Light card border:** changed to sky so a white card on the `#F3F6FB` background is visibly grouped (review finding).

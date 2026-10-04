# Design foundation (F9): how features use it

Status: F9 DESIGN FOUNDATION GATE implementation, not merged, not Owner-accepted. Specification:
`f9-design-foundation-task-record.md`. Font provenance: `font-sources-and-licenses.md`. Nothing here claims accessibility
compliance; it lists what is measured and what is still manual.

## 1. What a feature gets

| Need | Use | Where |
|---|---|---|
| Theme | `TabsiraTheme(themeMode)` (already hosted by `MainActivity`; features do not wrap it) | `core/design/theme` |
| Colors Material has no slot for | `TabsiraDesign.colors` (`borderStrong`, `focus`, `disabledContent`, ...) | `core/design/theme` |
| Everything else | `MaterialTheme.colorScheme`, `.typography`, `.shapes` (all mapped to Tabsira tokens) | |
| Spacing | `TabsiraSpacing.xs/s/m/l/xl/xxl`, `minTouchTarget`, `borderHairline/Control`, `focusWidth` | `core/design/layout` |
| Screen root | `TabsiraScreen { ... }` (edge-to-edge safe, start/end symmetric padding) | `core/design/components` |
| Actions | `PrimaryButton`, `SecondaryButton`, `TextAction` | |
| Input | `TabsiraTextField` (label required; error = icon + message + border) | |
| Grouping | `SectionCard` | |
| Choice | `SelectableOption` (radio or checkbox role; marker + border + semantics) | |
| Change language | `AppLanguageController` (`AppCompatLanguageController`) | `core/design/locale` |

Components take **already localized `String`s**; the calling feature owns its string resources. Design components contain no
business logic and never read a store.

### Not in F9 (do not assume it exists)
Top bar, toggle row, dialogs, chips, timer/progress, bottom navigation, `StatusBanner`, icons beyond `material-icons-core`,
illustrations, the Settings screen, the Design Gallery, numeral formatting policy. **Promotion rule:** a component moves into
`core/design` only when at least one real feature needs the abstraction; propose it in that feature's contract.

## 2. Tokens

Brand-only palette (OD-F9-1): navy `#0B3B8F`, royal `#1456C5`, lime `#B7E445`, sky `#5F8FD9`, surface `#F3F6FB`, white.
Material You dynamic color is prohibited (OD-F9-8). Roles are defined once for Light and Dark in
`core/design/theme/ColorTokens.kt`; `TokenMappingTest` proves every role is a brand color, `ContrastTest` the thresholds, and the
instrumented `ThemeRenderingTest` that every Material3 slot of the real scheme is a brand color.

Rules that follow from the measured contrast (computed WCAG 2.x ratios of the constants, reproduced by `ContrastTest`):

- lime and sky are never a text color; lime is never a foreground on light surfaces (1.48:1 on white);
- the lime primary button always carries a navy label and a 2dp navy border (lime fill alone is below 3:1 on light);
- lime on royal is 4.48:1: non-text and large text only, never body text;
- royal on navy is 1.56:1: dark cards do not separate from the background by color, so grouping there uses spacing and headings; in Light a white card on the `#F3F6FB` background is only about 1.09:1, so the Light card border is sky (3.27:1 on white; decorative, not a contrast claim);
- links are underlined (`TextAction`); selection, error, focus and disabled are never color-only.

## 3. Typography

Five styles in `sp`: headline 28/36, title 20/28, body 17/26, bodySmall 15/23, label 16/24. `letterSpacing` is always 0, no forced
uppercase or italics, body leading is at least 1.5x (Arabic). **Body** is the bundled Tajawal Regular. **Headings and buttons use
a placeholder** (system default at Bold) because a static Android-compatible Cairo Bold could not be proven (E9 STOP, see
`font-sources-and-licenses.md`); `HeadingFontFamily` in `core/design/type/Fonts.kt` is the single line that changes after the
Owner picks an alternative. Features never declare a `FontFamily`.

## 4. RTL rules

- The manifest sets `android:supportsRtl="true"`. Use `start`/`end` (never `left`/`right`); `Icons.AutoMirrored` for directional icons.
- No fixed-height text containers; labels wrap, never truncate; critical labels (for example Help Now) must stay fully visible.
- User-typed text uses content-based direction (`TabsiraTextField` does this).
- Numerals: **undecided** (OD-F9-4 deferred). Format numbers, dates and times with the active `Locale`
  (`LocalConfiguration.current.locales[0]`); never hard-code formats. The first feature where numeral presentation matters
  (probably F3 timer) freezes the Latin-versus-locale digits decision.

## 5. Localization architecture

- **Languages:** English is the unqualified fallback (`values/`), plus `values-ar` and `values-de`. Nothing else is shipped:
  `localeFilters` limits resources, AGP generates the LocaleConfig (`resources.properties` has `unqualifiedResLocale=en`).
- **Single source of truth:** Android/AppCompat per-app locales. There is **no** persisted language in `SettingsStore` and no
  custom locale store. `AppLanguageController.set(...)` calls `AppCompatDelegate.setApplicationLocales`; on Android 13+ the platform
  per-app language is used and shown in system settings, on API 24 to 32 AppCompat's backport persists it (`autoStoreLocales`,
  the disabled `AppLocalesMetadataHolderService`).
- **SYSTEM** is the empty application locale list; follows the platform. A device with an unsupported locale gets the English
  fallback strings; layout direction comes from the platform (no custom resolver, no forced LTR).
- **Mapping (frozen, E5):** empty list -> SYSTEM; non-empty -> the first supported locale in list order; no supported locale ->
  SYSTEM. Total over any input (`SupportedLanguageTest`).
- **A language change recreates the activity.** Features must keep unsaved input in `rememberSaveable` or a ViewModel.
- **Non-Activity contexts** (notifications, services) do not receive the app locale on API <= 32. A helper is deferred until
  F3/F14 need one.

### Known implementation characteristics (accepted; no workaround without new evidence and review)
- **E3:** AppCompat `autoStoreLocales` on API <= 32 may perform blocking disk reads/writes internally.
  This is standard AppCompat behavior. We removed our own DataStore locale read; we add no custom locale storage, no duplicate
  persistence, no StrictMode suppression and no startup workaround.
- **E7 (theme first frame):** the theme starts from SYSTEM and reacts to the `ThemeMode` flow; there is no blocking settings read.
  A user who chose Dark on a Light-system device may see one wrong-theme frame at cold start. Accepted as a known risk, **not** as
  permission for a visibly poor transition: it is checked manually (section 8). A visible flash is a Feature Gate finding.

### String ownership
- Each feature owns `strings_<feature>.xml` in `values/`, `values-ar/`, `values-de/`. Key prefix = `<feature>_`
  (enforced by `ResourceParityTest`). No giant global file.
- `strings_common.xml` (owner F9) holds only generic UI words (`common_*`). No feature copy.
- The placeholder `app_name` is **non-translatable** until the Owner decides the public name; internal-flavor engineering copy is
  non-translatable. Neither is rendered into AR/DE as brand copy. This decides nothing about the final name.
- A missing or surplus translation is a release error: `lint` has `MissingTranslation` and `ExtraTranslation` as errors, and
  `ResourceParityTest` (JVM) checks key sets, kinds, placeholders, plural/array shapes, duplicates and prefixes for every file.
- Text expansion: assume German up to about +35%; never fix text container sizes; the 200% font scale test uses a long German label.

## 6. Theme selection

`ThemeMode` (SYSTEM/LIGHT/DARK) stays in the D0 `SettingsStore` (the only persisted D0 key is `theme_mode`). `MainActivity` collects it
with `collectAsState(initial = SYSTEM)`. `TabsiraTheme` also sets system-bar icon contrast and the window background; OEM force-dark is
disabled in the XML theme. The XML theme parent is `Theme.AppCompat.DayNight.NoActionBar` only because `AppCompatActivity` requires it;
all visible UI is Compose.

## 7. Verification map (what proves what)

| Claim | Evidence | Runs |
|---|---|---|
| Tokens are brand-only; Light/Dark defined | `TokenMappingTest`; `ThemeRenderingTest.everyMaterialSlotIsABrandColorInBothThemes` | JVM; managed devices |
| Contrast thresholds on declared pairs; contract values | `ContrastTest` | JVM |
| No color construction, named colors, font families/typefaces, left/right layout, non-mirrored directional icons or hard-coded layout direction outside `core/design/theme|type|layout` (components are scanned too); dp allowed. A regex scan: it catches the forms in its tests, not every conceivable one | `DesignRulesSourceScanTest` (+ synthetic bad input) | JVM |
| Type scale leading, `sp` only, zero letter spacing | `TypeScaleTest` | JVM |
| EN/AR/DE parity, placeholders, prefixes, non-translatable placeholder name | `ResourceParityTest`; lint | JVM; CI lint |
| Language mapping is total | `SupportedLanguageTest` | JVM |
| ThemeMode persists; the store no longer reads or writes `ui_language` (a stale key from an earlier internal build is ignored, not deleted; D0, non-sensitive) | `SettingsStoreTest` | JVM |
| Real rendering in Light/Dark, SYSTEM follows device | `ThemeRenderingTest` | managed devices |
| AR RTL mirroring, EN/DE/AR strings, fallback | `LocaleAndRtlTest` | managed devices |
| Touch targets, role/state semantics, no clipping at 200% | `ComponentSemanticsTest` | managed devices |
| The bundled file is the recorded one (SHA-256) and itself covers Latin, German, Arabic letters, harakat and Arabic-Indic digits | `FontCoverageTest` (parses the font's cmap) | JVM |
| The font resource loads as a Typeface | `FontFamilyTest` (coverage is NOT claimed here: `Paint.hasGlyph` also sees platform fallback fonts) | managed devices |
| AppCompat locale switch end to end; SYSTEM is empty | `AppLanguageControllerTest` | managed devices |
| Final Play APK references the generated LocaleConfig; locales exactly en, ar, de | `ci/check_locale_config.py` (via `apkanalyzer`) | CI |
| No new permission; dependency/component allow-lists exact | release-boundary checker | CI |

Limits, stated plainly: `ResourceParityTest` does not limit what may be marked `translatable="false"` (review it); the release-boundary component key does not include `android:enabled`; AppCompat locale persistence across process death is not tested; the SYSTEM test injects the night mode through the configuration; the 200% test overrides `Density.fontScale` (not the system setting); API 24 to 29 are not on a managed device;
none of this establishes accessibility compliance.

## 8. Manual visual acceptance still required (Owner device + emulator)

EN, AR, DE x Light, Dark; SYSTEM/LIGHT/DARK including a restart where the explicit theme differs from the system theme (E7);
font scale 1.0, 1.3, 2.0 and largest display size; TalkBack pass; compare against the identity sheet; check nothing is color-only and
directional icons mirror in Arabic; check the heading font placeholder once the Owner decides the Cairo alternative.

## 9. Forbidden without a new approved contract

New libraries, Material You dynamic color, a second language or theme store, a screenshot/golden dependency, a feature-defined font,
raw brand colors in feature code, changes to the brand palette, logo/launcher-icon/public-name/applicationId/discreet-identity work.

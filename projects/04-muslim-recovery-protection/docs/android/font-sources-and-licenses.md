# F9 font provenance (T0)

Direction (OD-F9-2, approved in principle): **Cairo** for headings and buttons, **Tajawal** for body text, bundled locally,
SIL OFL 1.1, no downloadable fonts. Execution rule E9: the repository may only contain a font whose authoritative provenance,
license, SHA-256, glyph coverage, weight and minSdk 24 compatibility are proven. No derivative generation, no minSdk raise,
no silent substitution.

Evidence gathered during F9 T0 (fetched with `curl` on 2026-10-04; hashes computed locally; font tables inspected with
`fontTools`). Nothing here is a license-compliance opinion beyond what the upstream files state.

## Tajawal Regular: PROVEN, bundled

| Item | Value |
|---|---|
| File | `app/src/main/res/font/tajawal_regular.ttf` (Android resource name `tajawal_regular`) |
| Source | `google/fonts`, `ofl/tajawal/Tajawal-Regular.ttf` (`https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf`) |
| Upstream project | `https://github.com/googlefonts/tajawal`, commit `2085b8942f234e7afb83dc03c77713d0d5471cc9` (from the `METADATA.pb` in `google/fonts`) |
| License | SIL Open Font License 1.1. `OFL.txt` (committed at `docs/android/licenses/OFL-Tajawal.txt`) says "Copyright 2018 Boutros International"; the font's own name table says "(c) 2017 by Boutros International". Both are upstream text, not reconciled here. |
| SHA-256 (font) | `6882892da3e03527d5db2bbab3b48bde6ef2e878a43f522d1a4eebda90010a19` |
| SHA-256 (OFL.txt) | `9b584984f9db0ee30347391a76eff9c0a6b03dc450c3c6afe3757a2cb3a4db87` |
| Format | static TrueType outlines (`glyf` present, no `CFF`, no `fvar`), `OS/2.usWeightClass = 400`, version 1.700 |
| Glyph coverage checked | Latin, digits 0-9, `ä ö ü ß Ä Ö Ü`, Arabic letters, harakat, Arabic-Indic digits U+0661, Arabic comma and question mark: all present. Only U+06F1 (Persian digit one) is absent; Persian is not a supported language. |
| minSdk 24 | A static TrueType font is the baseline format for `res/font` on all API levels. No variable axes are used. Runtime check: instrumented test loads the family and measures text (`FontFamilyTest`). |

## Cairo Bold: NOT PROVEN, STOP rule E9 triggered

Required: a static, Android-compatible **Cairo Bold** from an authoritative source with clean provenance.

What exists upstream (verified):

| Source | Result |
|---|---|
| `google/fonts` `ofl/cairo/` | ships only the **variable** font `Cairo[slnt,wght].ttf` (axes: `wght` 200 to 1000, `slnt` -11 to 11). `METADATA.pb` lists that single file. License OFL, copyright "2009 The Cairo Project Authors (https://github.com/Gue3bara/Cairo)". |
| Upstream `Gue3bara/Cairo` at the commit `google/fonts` records (`73d16933c6a0f341c27a69e401da83dcb0d53114`) | `sources/cairo.yaml` has `buildStatic: false`, `buildVariable: true`. The only built font path present is `fonts/Cairo/variable/Cairo[slnt,wght].ttf`. Probed static paths (`fonts/Cairo/{ttf,static,otf,TTF,OTF}/Cairo-Bold.*`, `fonts/ttf/...`) all return 404. |
| SHA-256 of the variable file (identical in both repos, 599548 bytes) | `667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964` |
| Google Fonts CSS API (`fonts.googleapis.com`, `wght@700`) | returns Google-generated, unicode-range-split instances on `fonts.gstatic.com`: a derivative made by a third party, not an authoritative upstream static asset. Not used. |
| npm packages that repackage Cairo (for example `@expo-google-fonts/cairo`) | third-party derivatives; the Owner explicitly said not to rely on them. Not used. |

**Why this is a real problem and not a formality:** Compose variable-font axis selection (`FontVariation`) requires
API 26, and `minSdk` is 24. A variable-only Cairo cannot be used to render a correct Bold on API 24 and 25 without either a
derivative static instance, a higher minSdk, or a different heading font. Each of those is an Owner decision (E9).

### Alternatives returned to the Owner (not decided here)

| ID | Option | Trade-off |
|---|---|---|
| A | Use the upstream variable Cairo with `FontVariation` on API 26+, and fall back to Tajawal Bold (static, OFL, upstream) on API 24 and 25 | Faithful Cairo on 26+, a second heading face on the oldest devices. Needs the Tajawal Bold file and a runtime branch on `Build.VERSION.SDK_INT`. |
| B | Generate a static Cairo Bold instance from the variable font (fontTools instancer) | Modified OFL derivative: needs a check of the font's Reserved Font Name and naming rules, and its provenance is "built by us". Breaks the "authoritative static asset" rule, so it needs explicit approval. |
| C | Raise minSdk to 26 | Loses API 24 and 25 users; contradicts D-12. Not recommended. |
| D | Headings in Tajawal Bold (static, upstream, OFL) | One designer family, simple, but departs from the approved identity sheet (Cairo Bold headings). A brand decision. |
| E | System font for headings until the identity is finalized | Zero assets; headings lose the brand face. |

### Current implementation state

- Body text uses the proven **Tajawal Regular** asset.
- Headings, titles and buttons use an explicit placeholder: `FontFamily.Default` at Bold weight, defined in one place
  (`core/design/type/Fonts.kt` as `HeadingFontFamily`). Replacing it is a one-line change after the Owner chooses A to E.
- No Cairo file, no derivative and no substitute heading font is in the repository.

### Open licensing item for the Owner
The OFL asks that the license and copyright notice accompany redistributed copies. They are committed under `docs/android/`, but
nothing in the APK carries them (there is no licenses screen or asset). Whether and where to ship the notice (an in-app licenses entry, a
bundled asset) is an Owner/legal call; no screen was added because Settings/legal screens are outside F9.

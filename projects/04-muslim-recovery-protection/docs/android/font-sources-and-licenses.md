# F9 fonts: provenance, generation and licenses

Approved direction (OD-F9-2): **Cairo Bold** for headings, titles and buttons, **Tajawal Regular** for body text, bundled locally, SIL OFL 1.1, no downloadable fonts.
Decision history: T0 (verify) found no authoritative static Cairo Bold, so the E9 STOP rule fired and the alternatives A to E were returned. The Owner then chose
**Option B (D-F9-FONT)**: generate a static Cairo Bold weight-700 instance from the authoritative upstream variable font, an explicit exception to the STOP rule.
Not done, by decision: no minSdk change, no substitute font, no third-party pre-generated Cairo, no API-level font branch, no font tooling in the Android build.

`FontCoverageTest` (JVM) verifies the committed files below against these recorded values. **A changed output hash is never accepted silently**: regenerating or
replacing a font file requires a reviewed update of the hash here and in the test's recorded value.

Machine-checked hashes (do not reformat; `FontCoverageTest` reads these lines):

- cairo_bold.ttf SHA-256: `5fa21b9d998565e30b9a6173240f88869eeccd8bb4634f08e0f77a4404b52feb`
- tajawal_regular.ttf SHA-256: `6882892da3e03527d5db2bbab3b48bde6ef2e878a43f522d1a4eebda90010a19`
- OFL-Cairo.txt SHA-256: `a4554e1799d42e1405924b61eb0e0722ae1623b1f1f07f995348f96c496362a9`
- OFL-Tajawal.txt SHA-256: `9b584984f9db0ee30347391a76eff9c0a6b03dc450c3c6afe3757a2cb3a4db87`

## Cairo Bold: GENERATED static instance (Option B)

| Item | Value |
|---|---|
| Asset | `app/src/main/res/font/cairo_bold.ttf` (Android resource `cairo_bold`), 164,796 bytes |
| Nature | **a generated static instance, not an upstream-published static font** |
| Upstream repository | `https://github.com/Gue3bara/Cairo` |
| Upstream commit | `73d16933c6a0f341c27a69e401da83dcb0d53114` (the commit recorded by `google/fonts` `ofl/cairo/METADATA.pb`) |
| Input | `fonts/Cairo/variable/Cairo[slnt,wght].ttf` at that commit, 599,548 bytes, SHA-256 `667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964`; byte-identical to `google/fonts` `ofl/cairo/Cairo[slnt,wght].ttf` |
| Upstream axes | `wght` 200 to 1000 (default 400), `slnt` -11 to 11 (default 0) |
| Instance | `wght = 700`, `slnt = 0` (upright), all axes pinned (full instancing) |
| Tool | `fontTools` **4.55.3** (`fontTools.varLib.instancer.instantiateVariableFont`), pinned in `android/tools/fonts/requirements.txt`; NOT an Android build or runtime dependency |
| Deterministic command | `pip install -r tools/fonts/requirements.txt` then `python3 tools/fonts/generate_cairo_bold.py <input.ttf> app/src/main/res/font/cairo_bold.ttf` (the script refuses any input whose SHA-256 differs, and any other fontTools version) |
| Determinism | two independent generations produced the same SHA-256 (head timestamps are not recalculated) |
| Output SHA-256 | `5fa21b9d998565e30b9a6173240f88869eeccd8bb4634f08e0f77a4404b52feb` |
| Form | static TrueType: `sfnt` version 0x00010000, `glyf`/`loca` present; `fvar`, `gvar`, `avar`, `STAT`, `HVAR`, `MVAR`, `cvar` all absent; tables `GDEF GPOS GSUB OS/2 cmap gasp glyf head hhea hmtx loca maxp name post prep` |
| Weight | `OS/2.usWeightClass = 700`, `fsSelection` BOLD set and REGULAR clear, `head.macStyle` bold |
| name table | 1 `Cairo`, 2 `Bold`, 3 `Cairo Bold;static instance wght=700 slnt=0;upstream 73d16933c6a0;fontTools 4.55.3`, 4 `Cairo Bold`, 6 `Cairo-Bold`, 0 copyright "Copyright 2009 The Cairo Project Authors (https://github.com/Gue3bara/Cairo)", 5 `Version 3.130;gftools[0.9.24]`, 9 designer Mohamed Gaber, 13/14 SIL OFL 1.1 license text and URL. Typographic-family ids 16/17/21/22/25 are removed. Leftover axis/instance label strings (ids 256 and up) from the variable font remain in the table; they are unreferenced by any variation table and harmless. |
| Glyph coverage (verified) | A-Z a-z 0-9, ä ö ü ß Ä Ö Ü, Arabic letters U+0627-063A and U+0641-064A, harakat U+064B-0652, Arabic-Indic digits U+0660-0669, U+060C, U+061F, U+0640; 699 cmap entries |
| License | SIL Open Font License 1.1, `OFL-Cairo.txt`. The upstream copyright line declares **no Reserved Font Name**, so a modified instance may keep the family name; this is a factual reading of the notice, not a legal opinion. |

## Tajawal Regular: upstream static font (not modified)

| Item | Value |
|---|---|
| Asset | `app/src/main/res/font/tajawal_regular.ttf` (`tajawal_regular`), 60,364 bytes |
| Source | `google/fonts`, `ofl/tajawal/Tajawal-Regular.ttf` (fetched from the `main` ref; the hash above pins the content) |
| Upstream project | `https://github.com/googlefonts/tajawal`, commit `2085b8942f234e7afb83dc03c77713d0d5471cc9` (from `METADATA.pb`) |
| Form | static TrueType (`glyf`, no `CFF`, no `fvar`), `OS/2.usWeightClass = 400`, version 1.700 |
| License | SIL OFL 1.1, `OFL-Tajawal.txt` says "Copyright 2018 Boutros International"; the font's name table says "(c) 2017 by Boutros International". Both are upstream text, not reconciled here. |
| Glyph coverage (verified) | A-Z a-z 0-9, ä ö ü ß Ä Ö Ü, Arabic letters, harakat, Arabic-Indic digits, U+060C, U+061F, U+0640. Only U+06F1 (Persian) is absent; Persian is not a supported language. |

## Shipped license notices (D-F9-LICENSE)

`app/src/main/assets/licenses/OFL-Cairo.txt` and `OFL-Tajawal.txt` are packaged into the application (assets), so the license text and copyright notices accompany the
distributed fonts. CI proves both files are present in the final play release APK (`apkanalyzer files list`). A future About/Licences screen may display them; no such UI
exists in F9 and none was added.

## What the tests and CI prove, and what they do not

- JVM `FontCoverageTest`: both committed files match the hashes above, are static TrueType (no variation tables), have the expected `OS/2` weight, and cover the required glyphs by parsing their own cmap;
  the shipped license assets match their recorded hashes and contain the OFL text and the upstream copyright lines.
- JVM `TypeScaleTest` and instrumented `TypographyFontsTest`: headings, titles and buttons use Cairo Bold, body text uses Tajawal Regular, and `FontFamily.Default` appears in no design source.
- Instrumented `FontFamilyTest` (API 30 and 34): both font resources load as typefaces. API 24 to 29 are not exercised by CI; a static TrueType font has no API-gated feature.
- Not claimed: a licence-compliance opinion, or that the generated instance is byte-identical to any upstream-published static Cairo (none exists).

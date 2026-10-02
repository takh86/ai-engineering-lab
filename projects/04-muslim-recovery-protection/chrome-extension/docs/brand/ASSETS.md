# Tabsira visual identity — how it is implemented, and what is still missing

**Approved reference:** `tabsira-visual-identity-reference.png` (Owner-supplied identity sheet, 1448×1086 raster). It is a visual
reference for palette, type, shapes and tone — **not** approval of its functional claims (family features, reports, "protection is on",
"stop protection" as the main action). None of those were copied.

## Palette (brand colours, fixed)

| Role | Hex | Used for |
|---|---|---|
| Primary dark blue | `#0B3B8F` | headings, wordmark, text on lime, app-icon tile |
| Royal blue | `#1456C5` | links, secondary-button outline, focus/progress accents (light scheme) |
| Lime accent | `#B7E445` | the primary action on every page (with dark text `#0B3B8F`) |
| Supporting blue | `#5F8FD9` | token `--brand-sky` (reserved for illustrations/secondary graphics) |
| Light surface | `#F3F6FB` | page background |

Fonts: **Cairo Bold** (headings, wordmark text, buttons) and **Tajawal Regular** (text). Both SIL OFL 1.1, bundled as WOFF2 subsets
(Arabic + Latin) from `@fontsource/cairo@5.3.0` and `@fontsource/tajawal@5.3.0` (npm); licences in `src/fonts/OFL-*.txt`; SHA-256 of the files in
`src/fonts/SOURCES.md`. No network font loading (CSP `font-src 'self'`).

## Functional colours (additions, documented and tested — they do not change the brand palette)

Defined in `src/ui/tokens.css` and checked by `tests/unit/tokens.test.mjs` (WCAG 2.2 AA: ≥ 4.5:1 text, ≥ 3:1 for borders/focus/icons, both schemes):
ink `#0F2347`, muted ink `#44546F`, hairline `#CBD6EA`, field border `#5B6E92`, lime hover `#A7D635`, info / warning / error / neutral
background-ink-border triplets, and a dark scheme derived from the navy (`#071A3F` page, `#0E2859` card, lime stays the primary action).

## Logo status — Owner-supplied vector **reconstruction**; still not the designer's master

On 2026-10-02 the Owner supplied `Tabsira_Vector_Assets_V1.zip` (kept in `vector/`, provenance and checks in `vector/SOURCE.md`). Its own README says it is
**a vector reconstruction from the supplied images, not the designer's original files** (letter shapes, curves and gradients are approximate). It replaces the earlier
hand redraw as the vector source used by the extension.

| Asset | State |
|---|---|
| Mark (blue→cyan bars with lime tip) | `src/brand/mark.svg` = `vector/tabsira-symbol.svg` (Owner-supplied reconstruction). The earlier hand redraw is retired. |
| Wordmark «تبصرة» | Exists as vector paths in `vector/tabsira-logo-*.svg` (light, dark, mono, white). **Used in the store promo images only.** The five UI pages still set the name in Cairo Bold next to the mark (a deliberate stand-in that also serves en/de and the dark scheme); switching the headers to the Arabic lockup is an open, optional design decision. |
| App/toolbar icon (16–300 px) | Rendered by `scripts/make-icons.mjs` from `src/brand/app-icon.svg` = `vector/tabsira-app-icon.svg`; checked at 16/32/48/96/128 px. |
| Mono variant | `src/brand/mark-mono.svg` = `vector/tabsira-symbol-mono.svg`. |
| Store promo images | Generated from `vector/tabsira-logo-light.svg` (as an `<img>` data URI) + Tajawal text. |

The earlier low-resolution rasters the Owner sent are **not** used in any package.

### Path to the designer's master (Owner action, optional)
1. Ask the designer for the master logo as **SVG (or AI/PDF with outlines)**: full lockup, mark only, one-colour, white, dark-background variants, and the app icon.
2. Drop them into `docs/brand/vector/` and `src/brand/` with the same file names; run `node scripts/make-icons.mjs` (PNG sizes) and `node scripts/make-store-assets.mjs`; rebuild.
3. Review visually against the reference at 16, 32, 48, 128 px and on light/dark toolbars; update this file ("original vector: yes").
4. If the Owner prefers to keep the reconstruction, record that decision here and have the designer review it once.

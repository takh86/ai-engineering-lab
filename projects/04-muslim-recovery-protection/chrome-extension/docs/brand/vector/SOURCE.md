# Owner-supplied vector assets — provenance

- Archive: `Tabsira_Vector_Assets_V1.zip` (received from the Owner 2026-10-02), SHA-256 `582b61f9531a114e10117b066c85d42cd2d3527bc39bcf254946b5e3cd47bd81`.
- The Owner's own `README_AR.md` (kept here unchanged) states: **a vector reconstruction from the supplied images, NOT the designer's original files**; letter shapes,
  curves and gradient stops are approximate. So this is the current best vector source, **not** the designer's master.
- Checked on receipt: all SVG files are well-formed XML; no `<script>`, `<image>`, `<text>`, `<style>`, event handlers, external references or `data:` URIs;
  only paths and linear gradients (element ids repeat across files, so they must be used as `<img>` or one per document, never inlined together).
- Not copied here: the PNG exports (derivable from the SVGs). `Tabsira_Vector_Preview.png` is kept as the visual reference for the reconstruction.
- Used in the extension: `src/brand/mark.svg` = `tabsira-symbol.svg`; `src/brand/app-icon.svg` = `tabsira-app-icon.svg` (toolbar/store icons are rendered from it by
  `scripts/make-icons.mjs`); the light lockup `tabsira-logo-light.svg` in the store promo images. Everything else is kept for later use.

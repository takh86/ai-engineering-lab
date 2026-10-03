# Locally verified busy fix

Owner supplied the exact coordination.js assertOwner patch as text. Original patch archive and original native-browser evidence were not received. The code change was applied verbatim.

A deterministic local test reproduced busy on baseline; three guard tests passed there. All four pass after the fix. Full unit/static suite:193/193PASS. New test source is independently written here, not represented as the missing original tests. Reviewer-reported native browser78/78 results were not independently rerun or certified.

Reproducible builds exactly match supplied expected fingerprints:
Chromium1379908bytes: eba26dd6b2e9cdc95dde09e422a2befa98cf77c01ee94625c63960c733c9b7b0
Firefox1380036bytes: fc984586f21d52b152a267aa385644478e9b3268fa9f8609c1a477823acb4769

The build includes product source/assets, not unit tests or review docs. Thus the pasted source change alone reproduced both original package hashes. Package identity does not prove identity of test/docs/evidence trees.

Local only. No PR update, branch push, closure of75, release or privacy deployment. Actual Windows/Chrome verification and owner privacy/store decisions remain open.

# PR75 follow-up review — local changes, 2026-10-03

The review remains OPEN. No GitHub push, PR update/comment, merge, store submission or policy deployment was performed. The earlier 57 installed-browser passes certify the earlier PR candidate, not this revised source. Nothing here clears the 1.0.1 integration or owner release gates.

## Current local corrections

| Item | Local disposition | Verification and limits |
|---|---|---|
| 3: password derivation | Only credential version 2 is accepted: PBKDF2-HMAC-SHA256, 600,000 iterations, one 256-bit seed per secret, then HKDF-separated wrapping/verifier outputs. AES-GCM labels bind credential role/version. | Old unpublished versionless/v1/310,000 formats now fail closed. The previous compatibility implementation and fixture were removed. No automatic wipe, password replacement or protection reset follows a corrupt credential. V2 password rotation/recovery preserve private data and commitment. |
| 4: optional password | All three languages warn in the commitment form and its confirmation that early exit requires a password. | Password can be set later; natural expiry remains available. Six installed-browser warning assertions are prepared, not verified in a running browser. |
| 5: worker memory unlock | UI explicitly says access can lock when the background worker stops. | Restart fails closed in controller tests. Forced native-CDP stop/restart acceptance prepared; genuine idle termination and editing UX remain unverified. |
| 7: unbounded releases | At most 4,096 immutable cancellation names, each at most 160 characters; request and confirmation capacity checked before mutation. | Never prune merely absent names: an earlier frozen writer can reappear. Saturation refuses further early exits with localized explanation; natural expiry/core protection still work. Replay/late-write/cleanup/saturation regressions pass. This is bounded storage, not unlimited early-exit capacity. |
| 8: schedule polling delay | Dedicated one-shot alarm targets actual next schedule state change or commitment expiry; recalculated on relevant status/save/start/reconciliation. | DST gaps/repeated hours covered with bounded actual-minute scanning. Watchdog remains fallback. Alarms are derived state and can be delayed by sleep/closed browser/late old worker writes; no hard real-time guarantee. Real-minute native DNR transition acceptance prepared with watchdog disabled temporarily and UI polling unloaded. |
| 9: import cycle | Config-record selection extracted to dependency-free config-records.js; config no longer imports lock. | Production ES module graph has no cycles; record/lock/concurrency regressions pass. |
| 10: duplicate domains | Preview reads the actual packaged ruleset; base-domains.txt is no longer shipped. | Both target builds retain the exact 242,750-domain licensed snapshot SHA; static tests hash the ruleset-derived preview. No generalized network-fetch permission was added. |
| 12: prayer scope | Before opt-in, AR/EN/DE UI states four supported methods, no Umm al-Qura or high-latitude substitution, browser-running requirement and late/sleep notification limits. | Unsupported methods remain unsupported. Unavailable events are null/— and get no alarm, including Berlin solstice Fajr/Isha. OS delivery is unverified. See PRAYER-REVIEW-FOLLOWUP.md. |
| 13: rolling sunset reference | Replaced NWS rolling URL with a frozen USNO API JSON response for date/location/UTC offset. | Offline test reads the committed independent response. README includes retrieval provenance and exact SHA. Independent red-team verified saved bytes/hash; its attempted primary API reopening was unavailable. |

PBKDF2 reference: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). This work-factor choice does not claim FIPS certification or protection against a compromised device.

## Fresh local evidence

**161/161 unit/static tests pass** in the root run and an independent run. **10/10 controller regressions pass** and the worker capability harness passes. These use Node and simulated browser APIs; they do not prove real DNR/OS delivery. The full suite includes actual package-reference checks, exact local-fetch whitelist, licensed snapshot hash and repeat-build reproducibility. The cryptographic tests include independent derivation reconstruction and wrapping-label substitution refusal.

Exact fresh results and package hashes: `test-evidence/second-followup-local.json`. The new release ZIP was built before the final attempted installed-browser run. Chromium stopped before loading the extension with process-singleton `socket(): Operation not permitted`. The failed attempt is recorded as **NOT_RUN** in `second-followup-browser-attempt.json`; it is not counted as a pass. The updated browser suite is syntax-checked only.

## Open gates

1. **1.0.1 reconciliation:** the user names a .bundle containing 12 commits from 1d845d0 to efc7357. No .bundle file or supplied download ID appeared in this conversation's current attachments, accessible workspace or relevant Library search/list results. efc7357 is not an available local Git object. Need the actual file to verify, import under a review branch, compare/regress and resolve conflicts. No assumption that a clean GitHub merge status establishes compatibility with 1.0.1.
2. **Store/privacy owner decision (6):** concrete purpose, prayer-scope question and actual data/storage table are in STORE-REVIEW-DECISION.md. Religion and manual location remain unencrypted public preferences; private saved content is encrypted only with password enabled. Policy drafts are aligned locally, not deployed. No store compliance or legal clearance is claimed.
3. **Real browser verification (2/5):** the revised candidate still needs the installed suite (including native schedule boundaries/forced restart), genuine worker idle behavior, successful mature early exit with the real minimum wait, real prayer notification delivery, Firefox and the separate 184-check suite. Prepared tests are not results.

All original missing findings 7–10, 12 and 13 are now accounted for above. They are no longer described as unavailable. The unavailable input is the actual 1.0.1 Git bundle, and unsupported prayer capabilities remain explicit release-scope questions.

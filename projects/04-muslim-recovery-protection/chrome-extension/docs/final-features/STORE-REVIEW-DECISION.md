# Item 6 — owner review before store submission

Status: NOT APPROVED. No submission, privacy deployment, store comment, merge or publication was performed.

## Concrete candidate being reviewed

Single-purpose draft: “Voluntary browser protection with practical support when an adult encounters a blocked page or wants help with an unwanted online habit.” The bundled core, additional rules, commitments, schedules, blocked-page help and saved plans support this stated purpose. The separately opt-in prayer clock also works outside blocked-page help; whether that is sufficiently related is an unresolved store-scope question. Optional activation alone does not establish compliance.

The owner must decide whether to retain that standalone prayer function in the store candidate and obtain an appropriate policy assessment, or defer/separate it before submission. The current local candidate retains it as originally requested; no unsupported store approval is claimed.

## Actual data handling for the privacy decision

| Data | Local use | Storage protection |
|---|---|---|
| Domain/search rules, schedules, commitment/exit times | Protection and commitment | Unencrypted extension storage |
| Chosen religion/faith mode | Optional faith experience and prayer eligibility | Unencrypted public preference storage, including while private access is locked |
| Manual prayer coordinates/city/time zone/method | Local prayer calculation | Unencrypted public preference storage; no geolocation/network lookup |
| Covenant, notes, custom help, favorites and reviews | Explicitly saved personal support | Unencrypted until a password is set, then AES-GCM encrypted vault |
| Password/recovery credentials | Local access and key wrapping | Salted version-2 PBKDF2/HKDF derivation and AES-GCM wrapped vault key; raw secrets not persisted |

No developer server, telemetry, cloud sync, browsing-history collection or device biometric dependency is implemented. Local processing still requires accurate store disclosures. The owner must accept this storage model or request a concrete change before approving release. This document is a decision brief, not a legal or store-compliance clearance.

The local privacy-policy draft and its pages candidate are aligned to these facts. Deployment of that draft and store form selections remain pending owner approval. Previously published policy pages are not changed by a local edit.

## Primary policy references checked 2026-10-03

- [Chrome Web Store quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines): narrow, understandable single purpose; clearly separate functions belong in separate extensions.
- [Chrome Web Store user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): local-only processing/storage still needs disclosure and a privacy policy. The actual handling, purpose, retention and security must be described accurately.

# Decisions

Decisions recorded here follow the Lab's [Decision Record Template](../../../templates/DECISION_RECORD_TEMPLATE.md) format, condensed for this project's early stage.

## D1 — DNS-based VPN filtering is a hypothesis, not a final architecture

**Status:** Accepted (M1)

**Decision:** M1 will implement and test a local DNS-based VPN filter against controlled test domains only, to empirically learn what it can and cannot block.

**Why:** Cheaper and lower-privilege than packet-level filtering or MITM; but its real-world effectiveness against DoH/Private DNS is unknown and must be measured, not assumed.

**Consequences:** If mainstream browsers trivially bypass it, that result must be documented and escalated to an architecture review rather than hidden or worked around. Packet-level filtering, TLS interception, MITM, AccessibilityService, Device Owner, or root are out of scope without a new review and explicit human approval.

## D2 — minSdk 24, compileSdk/targetSdk 36 (Android 16)

**Status:** Accepted (M1). Corrected during human review of M1-01.

**Decision:** `minSdk = 24`. `compileSdk`/`targetSdk = 36` (Android 16), matching the approved project requirement.

**History (kept for honesty, not current state):** During initial local scaffolding, `compileSdk`/`targetSdk` were temporarily set to 35 because Android SDK platform 36 was not yet installed in the local environment and no `sdkmanager`/`cmdline-tools` was available to install it without additional setup. Human review rejected API 35 as an accepted project target. The correction installed Android SDK Platform 36 (`platform-36_r02.zip`, matching the published checksum from Google's SDK repository manifest) directly into the local SDK, and upgraded the build toolchain to a version that officially supports it:

- Android Gradle Plugin: `8.7.3` → `8.11.2` (first stable AGP line to support compileSdk 36, per [AGP 8.11.0 release notes](https://developer.android.com/build/releases/past-releases/agp-8-11-0-release-notes))
- Gradle: `8.11.1` → `8.13` (AGP 8.11's minimum/default required Gradle version)
- Kotlin: `1.9.24` → `2.1.20` (the Kotlin version AGP 8.11 is built/tested against)
- Added the `org.jetbrains.kotlin.plugin.compose` Gradle plugin (Kotlin 2.0+ requires the Compose compiler as a separate plugin; the old `composeOptions.kotlinCompilerExtensionVersion` setting was removed)
- Compose BOM: `2024.10.01` → `2025.06.01`

AGP was upgraded only as far as the minimum stable line needed to support compileSdk 36 (8.11.x), not to the newest available stable AGP release (9.4.0 at time of writing, which requires Gradle 9.6 and is a much larger jump than this milestone needs).

**Why:** The Tech Lead's approved project requirement is Android 16 / API 36+; API 35 must not be recorded as an accepted target under any circumstance.

**Consequences:** Verified with a clean build (`./gradlew clean assembleDebug testDebugUnitTest`) after the upgrade — see PR for exact output. No further SDK-level work is needed for M1-01.

## D3 — Controlled test domains only

**Status:** Accepted (M1)

**Decision:** All M1 testing (unit, manual, integration) uses synthetic domain names or a harmless, controlled test endpoint. Real pornographic content is never browsed, bundled, committed, scraped, referenced, or used in automation.

**Why:** Safety, legality, and reproducibility of engineering evidence.

## D4 — Multi-runtime project layout

**Status:** Accepted (M1-01)

**Decision:** This project uses `android/`, `backend/` (created only when needed), and `docs/` instead of the generic Lab template's `src/`, `tests/`, `docs/`.

**Why:** The Lab's default template assumes a single-runtime backend project. This project's primary artifact is a mobile app, with a backend only as a possible future addition — a single flat `src/` would not represent that structure honestly.

**Consequences:** This is a documented, approved deviation from the generic template for this project only.

## D5 — No backend for M1

**Status:** Accepted (M1)

**Decision:** No backend is scaffolded for M1. `backend/` is not created until a specific M1 requirement demonstrably cannot be implemented correctly without one.

**Why:** M1 must remain local-first; the DNS filtering hypothesis does not require server-side components.

## D6 — Nested Android `.gitignore`, root untouched

**Status:** Accepted (M1-01)

**Decision:** Android build artifacts are ignored via `projects/04-muslim-recovery-protection/android/.gitignore`. The repository root `.gitignore` is not modified during M1-01.

**Why:** Keeps Android-specific ignore rules scoped to the project that needs them.

## D7 — GitHub Actions stay at repository root (correction applied)

**Status:** Accepted (M1-01)

**Decision:** No project-local `.github/workflows/` is created. When CI is introduced for this project, it will be added as a root-level workflow (`.github/workflows/`) using path filters scoped to `projects/04-muslim-recovery-protection/**`.

**Why:** GitHub Actions only executes workflows defined at the repository root. A project-local workflows directory would silently do nothing.

**Consequences:** No CI is added in M1-01. Root workflows are not modified during M1-01 unless explicitly authorized.

## AI contribution

This document, the surrounding scaffolding, and the initial project structure were AI-implemented under explicit Tech Lead constraints (see the M1-01 authorization). The Tech Lead owns the decisions themselves; AI recorded them as directed and did not originate the architecture direction.

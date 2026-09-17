# Decisions

Decisions recorded here follow the Lab's [Decision Record Template](../../../templates/DECISION_RECORD_TEMPLATE.md) format, condensed for this project's early stage.

## D1 — DNS-based VPN filtering is a hypothesis, not a final architecture

**Status:** Accepted (M1)

**Decision:** M1 will implement and test a local DNS-based VPN filter against controlled test domains only, to empirically learn what it can and cannot block.

**Why:** Cheaper and lower-privilege than packet-level filtering or MITM; but its real-world effectiveness against DoH/Private DNS is unknown and must be measured, not assumed.

**Consequences:** If mainstream browsers trivially bypass it, that result must be documented and escalated to an architecture review rather than hidden or worked around. Packet-level filtering, TLS interception, MITM, AccessibilityService, Device Owner, or root are out of scope without a new review and explicit human approval.

## D2 — minSdk 24, target API deferred to highest locally available

**Status:** Accepted (M1)

**Decision:** `minSdk = 24`. `compileSdk`/`targetSdk` set to the highest Android platform available in the local SDK at scaffolding time (35), rather than the project's eventual target of API 36+.

**Why:** The local Android SDK does not yet have platform 36 installed, and no `sdkmanager`/`cmdline-tools` is available in this environment to install it without additional setup. Blocking scaffolding on that install contradicts the instruction not to spend significant effort on tooling during scaffolding.

**Consequences:** Target SDK must be bumped to 36+ in a later milestone once the platform is installed. This is a tracked assumption, not a silent gap (see `docs/requirements.md`).

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

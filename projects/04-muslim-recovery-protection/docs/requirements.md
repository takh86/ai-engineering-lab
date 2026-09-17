# Requirements

## Milestone M1 — DNS-based VPN filtering hypothesis

M1 exists to empirically test one hypothesis: **can a local, on-device DNS-based VPN filter effectively block access to a set of controlled test domains, and where does it fail?**

This is a hypothesis under test, not an approved final architecture. M1 must document real limits as well as what works.

### In scope for M1

- An Android `VpnService`-based local DNS filter (implemented in a later M1 sub-milestone, not M1-01).
- Testing against harmless, controlled/synthetic test domains only (see below).
- Documenting where mainstream browsers bypass DNS filtering via DoH, Private DNS, or other default behavior.

### Explicitly out of scope for M1 (requires a new architecture review + explicit human approval)

- Packet-level filtering
- TLS interception / certificate installation / MITM
- AccessibilityService
- Device Owner privileges
- Root access
- Backend services (unless a later M1 requirement demonstrably cannot be implemented without one)
- AI, analytics, payments, accountability features, Islamic content library
- `QUERY_ALL_PACKAGES`

### Test domains

- Unit tests: synthetic domain names only.
- Manual/integration tests: a harmless test endpoint under our control, or an explicitly designated harmless test domain.
- Never: browsing, bundling, committing, scraping, referencing, or automating tests against real pornographic content.

### Success / stop criteria

M1 is **not** successful if normal mainstream browser configurations trivially bypass the claimed protection (e.g., via DoH/Private DNS). If that happens, work stops at the architecture gate and the following is presented for human review before any architecture change:

1. Exact bypass
2. Affected browser/version
3. Reproduction steps
4. Why DNS filtering failed
5. Technically viable alternatives
6. Permission/policy implications
7. Complexity/security trade-offs

## Platform requirements

- minSdk 24 for M1.
- compileSdk/targetSdk 36 (Android 16), the approved project requirement. See `docs/decisions.md` D2 for the toolchain versions this required and the corrected history (API 35 was used briefly during initial local scaffolding before platform 36 was installed; it was never an accepted target).
- Compatibility risk for legacy Android versions (minSdk 24 through targetSdk 36) is documented, not optimized for, during scaffolding.

## Milestone M1-01 — Project Scaffolding (this PR)

### Requirements

- Repository layout under `projects/04-muslim-recovery-protection/` (android/, docs/; backend/ omitted until needed).
- Project README and docs (problem, requirements, architecture, decisions).
- A buildable, empty Android Kotlin/Jetpack Compose app with no protection logic.
- Nested Android `.gitignore` under `android/`.

### Acceptance criteria

- [ ] `projects/04-muslim-recovery-protection/` exists with the approved layout.
- [ ] Android project builds successfully from a clean state (`./gradlew assembleDebug` or equivalent).
- [ ] No VPN, blocking, rules engine, backend, AI, analytics, payments, accountability, content library, Device Owner, AccessibilityService, or `QUERY_ALL_PACKAGES` code exists.
- [ ] Root `.gitignore` and root `.github/workflows/` are untouched.

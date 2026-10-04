# F1 Onboarding: task record and review record

Status: implementation on branch `feature/f1-onboarding` (base F9 head `3f8a014`), not merged, not Owner-accepted.
Specification: FEATURE CONTRACT v1, F1. Reached state 1 only (domain and UI complete, A4): nothing is persisted, so
this is not release-complete and makes no persistence, encryption or protection claim.

## Scope implemented (unblocked part)
Five steps: Welcome with honest limits, Language (System/English/Arabic/German through `AppLanguageController`), Mode,
optional Reasons (add/remove/skip, trim, 1 to 500 characters, at most 10), Privacy summary and Finish (with an optional
"help me build my first plan next" choice). Back works on every step except the first; nothing is written before Finish.
No permission, DNS/VPN, accessibility, biometric, analytics, network or backend; no public-name decision; copy says "this app".

## Architecture (all in `feature/onboarding/`)
- `OnboardingModel.kt`: state, events, pure `reduce`, `canSubmit`/`canGoBack`; `toString` of state/commit/events is redacted.
- `OnboardingStore.kt`: feature-local port `OnboardingStore.commitOnboarding(OnboardingCommit)` and `InMemoryOnboardingStore`
  (developer builds and tests only, process memory, not persistence, not bound anywhere; a source test keeps it out of `src/main`/`src/play` wiring).
- `OnboardingController.kt` (serialized, one successful commit, store exceptions become a generic failure),
  `OnboardingStateHolder.kt` (plain Kotlin; single re-entry guard; one-time `takeCompletion()`),
  `OnboardingViewModel.kt` (holds the draft; factory for a `ViewModelProvider`, no viewmodel-compose or navigation library),
  `OnboardingContent.kt` (stateless screen) and `OnboardingRoute.kt` (entry point `OnboardingRoute(holder, onFinished(startPlan))`).
- No contradictory state: the port has exactly one write (mode + reasons + completion together, all-or-nothing). Completion is
  the existence of the committed record, never a separate flag. A failed commit leaves nothing and the user can retry.
- Draft text lives only in the ViewModel (no `SavedStateHandle`, no `rememberSaveable`): it survives rotation and the language-change
  recreation; a process kill restarts at Welcome (accepted in the contract).

## OWNER DECISION REQUIRED
- **OD-F1-1 (18+ self-declaration):** NOT implemented. Welcome has no checkbox and the state has no adult field. Adding it is a
  one-step change (a state flag gating `Next` on WELCOME plus one string) once decided. Nothing in F1 currently implies adulthood.
- **OD-F1-5 (Faith option before F8 content exists):** implemented only as the conservative contract behavior: the Faith option and
  `RECOVERY_WITH_FAITH` are unreachable unless the host passes `faithAvailable = true` (default false). Showing it earlier is a decision.
- OD-F1-3 (reasons optional) and OD-F1-7 (no skip-all) are followed as the contract recommends; OD-F1-6 (changing mode later) is not built.
- OD-W1-1/OD-W1-3/OD-W1-4/OD-W1-5 below remain open and block the later states.

## INTEGRATION REQUESTS (none applied by this branch)
1. `AppContainer` / navigation: construct `OnboardingViewModel` via `onboardingViewModelFactory(store, AppCompatLanguageController, faithAvailable)`
   and host `OnboardingRoute`; start-destination logic (profile null/locked/unavailable/complete) is Integration-owned.
   Files: `app/AppContainer.kt`, `MainActivity.kt` or the future root navigation. Reason: features may not touch them.
2. Store binding: `src/internal/**/app/` may bind `InMemoryOnboardingStore` for Owner-device clicking; play must bind an implementation that
   returns `CommitResult.Failure(UNAVAILABLE)` until F7. Mapping `OnboardingMode`/`OnboardingCommit` to the shared `core/model` types happens in
   that adapter once W1-ports (OD-W1-1) is approved.
3. Emulator job: add `com.muslimrecovery.protection.feature.onboarding.OnboardingFlowTest` and `OnboardingRecreationTest` to the required-class
   list and raise the minimum test count (`ci/` and workflow are Integration-owned; not edited here).
4. `FLAG_SECURE` on the reasons step (OD-W1-3, `core/security` helper by F7): not available, not implemented.
5. Sensitive text input (autocorrect off, no personalized keyboard learning; OD-W1-4): `TabsiraTextField` has no such parameter (F9 owner).
   The reasons field therefore uses default keyboard options. Residual privacy risk until F9 adds `sensitive`.

## Content review record (OD-W1-5): all keys are DRAFT
Every `onboarding_*` string in EN/AR/DE is DRAFT: needs native-language review and the clinical/religious review roles the Owner names.
Items needing particular review: `onboarding_limits_body` (honest limits and emergency line), `onboarding_privacy_body` (states no account,
nothing sent, no permission or protection started during setup: true for this flow only), `onboarding_mode_*` descriptions, all Arabic and German text.
Short field label by design: the F9 text field truncates its label to one line, so the label is kept to a few words (200% font scale).

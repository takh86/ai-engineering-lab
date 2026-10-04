# F5 My Plan: task record and content review record

Branch `feature/f5-my-plan`, base F9 head `3f8a014` (PR #79, unmerged). Status: **state 1 only (domain and UI complete against an in-memory port). Not release-complete.** Secure durable storage belongs to F7 (Amendment A4).

## 1. Bounded scope implemented

Package `feature/plan/` (all under `app/src/main/java/com/muslimrecovery/protection/feature/plan/`):

- `PlanModel.kt`: `Reason`, `SupportStep`, `IfThenPlan` (two fields, OD-F5-5), `PlanSnapshot`, `PlanLimits` (20 items; 500/200/300+300). `toString` of every content type is redacted.
- `PlanValidator.kt`: trim, empty/whitespace rejection, code-point length limits, control and bidi-override rejection (newline allowed), duplicate flag (allowed, OD-F5-2).
- `PlanStore.kt`: feature-local port `PlanStore` (`access: StateFlow<PlanAccess>`, `apply(PlanEdit)`) and `InMemoryPlanStore` (dev/test only; memory only; re-checks limits).
- `PlanState.kt`: pure `reduce(state, event)`. Content exists only while access is OPEN; lock/unavailable wipes snapshot, draft and pending delete.
- `PlanController.kt`: serialises writes (one in flight), exactly one `apply` per edit, store exceptions become FAILED, cancellation is not swallowed.
- `PlanViewModel.kt`: holds the controller across rotation and the locale recreate; draft only in memory (no SavedStateHandle).
- `PlanScreen.kt`: `PlanRoute(viewModel, onBack)` (entry point for the Integration Agent) and stateless `PlanScreen`; three sections, inline add/edit, inline two-step delete (Keep/confirm, OD-F5-3), empty states, limit message, locked state. Uses F9 primitives only.
- Strings `strings_plan.xml` in values, values-ar, values-de (prefix `plan_`).

Not wired into MainActivity, navigation or AppContainer (Integration-owned).

## 2. Persistence statement (D1)

Nothing in F5 writes to SettingsStore, DataStore, SharedPreferences, files, a database, logs, clipboard, saved instance state or the network. `PlanSourceScanTest` scans the feature sources for those APIs and checks that only `InMemoryPlanStore` implements the port. The in-memory store is NOT a release implementation; no encryption was invented.

## 3. Owner decisions (defaults used, none silently decided as final)

| ID | Used as | Status |
|---|---|---|
| OD-F5-1 | No risk windows in F5 | default followed |
| OD-F5-2 | Proposed limits and flag-only duplicates | default followed, needs confirmation |
| OD-F5-3 | Inline delete confirmation | default followed |
| OD-F5-4 | No example prompts | default followed (no example text exists) |
| OD-F5-5 | Two if-then fields | default followed |
| OD-F5-6 | No reordering | default followed |
| OD-W1-3 | `FLAG_SECURE` on plan screens | NOT done: helper is F7/core-security owned. OWNER DECISION REQUIRED |
| OD-W1-4 | Sensitive text input (no keyboard learning/autocorrect) | NOT done: `TabsiraTextField` has no `sensitive` option and F9 is out of scope. Keyboard may learn plan text. OWNER DECISION REQUIRED |
| OD-W1-5 | Content review | this table, status DRAFT, reviewer names pending |

Rotation and process death: the draft survives rotation and the locale recreate (ViewModel) but is lost if the process is killed (accepted per OD-W1-3 recommendation).

## 4. Integration requests (none applied here)

1. `AppContainer`/composition: bind a `PlanStore`. In the internal flavor use `InMemoryPlanStore` (device acceptance); the play flavor must bind an `Unavailable` store until F7 exists. Files: `app/AppContainer.kt`, `src/internal/**/app/`. Alternative: none that avoids touching the composition root. Feature-local code cannot choose the binding.
2. Root navigation entry: call `PlanRoute(ViewModelProvider(owner, PlanViewModel.factory(store))[PlanViewModel::class.java], onBack)`. Files: `MainActivity`/navigation (Integration).
3. Adapter from F7's secure `RecoveryProfileStore` (and the shared `core/model` ports if W1-ports is approved) to `PlanStore`. Needed so F1's reasons and F5's reasons are one source (A4).
4. `FLAG_SECURE` helper from `core/security` (F7) applied around `PlanRoute`.
5. Emulator job: add `--require-class com.muslimrecovery.protection.feature.plan.PlanScreenTest` to the instrumentation check in `.github/workflows/project-04-android-ci.yml` (Integration-owned).
6. A `sensitive` option on `TabsiraTextField` (F9 owner), then F5 passes it for all plan fields.

Impact on F1/F3/F5/F9: none of these change F9; F1 and F3 are not touched; F3/F4 later read plan data through whatever F7 port is approved (not defined here).

## 5. Acceptance criteria status

| # | Criterion | Status |
|---|---|---|
| 1 | CRUD with validation and limits (fake store) | JVM tests (`PlanReducerTest`, `PlanControllerTest`, `InMemoryPlanStoreTest`); UI in `PlanScreenTest` |
| 2 | One atomic store call per edit; failing store leaves plan unchanged | `PlanControllerTest` |
| 3 | Locked/unavailable: no plan text anywhere | `PlanReducerTest`, `PlanControllerTest`, `PlanScreenTest` (sentinel) |
| 4 | Inline delete confirmation, reversible by Keep | reducer test, `PlanScreenTest` |
| 5 | Draft survives rotation and locale recreate | ViewModel holder; `PlanScreenTest` (StateRestorationTester) proves composition recreate only. A real Activity locale recreate is an Owner-device/Integration check |
| 6 | No logging/network/persistence outside the port | `PlanSourceScanTest` |
| 7 | EN/AR/DE parity, RTL, 200% font, targets, TalkBack | `ResourceParityTest` + `PlanStringsTest`; `PlanScreenTest` for RTL/200%/targets/semantics. TalkBack on API 30 and 34 not verified here |
| 8 | Review record for all copy | section 6 below |
| 9 | State 1 only until F7 | yes |

## 6. Copy review record (all DRAFT)

Every string is DRAFT: not clinically or religiously reviewed; AR and DE are unreviewed drafts. Reviewer roles and names pending (Owner supplies). The release gate requires every row APPROVED.

| Key | Status | Clinical review | Language review |
|---|---|---|---|
| `plan_title` | DRAFT | pending | pending |
| `plan_intro` | DRAFT | pending | pending |
| `plan_loading` | DRAFT | pending | pending |
| `plan_locked_title` | DRAFT | pending | pending |
| `plan_locked_body` | DRAFT | pending | pending |
| `plan_section_reasons_title` | DRAFT | pending | pending |
| `plan_section_reasons_hint` | DRAFT | pending | pending |
| `plan_section_steps_title` | DRAFT | pending | pending |
| `plan_section_steps_hint` | DRAFT | pending | pending |
| `plan_section_ifthen_title` | DRAFT | pending | pending |
| `plan_section_ifthen_hint` | DRAFT | pending | pending |
| `plan_empty_reasons` | DRAFT | pending | pending |
| `plan_empty_steps` | DRAFT | pending | pending |
| `plan_empty_ifthen` | DRAFT | pending | pending |
| `plan_add_reason` | DRAFT | pending | pending |
| `plan_add_step` | DRAFT | pending | pending |
| `plan_add_ifthen` | DRAFT | pending | pending |
| `plan_limit_reached` | DRAFT | pending | pending |
| `plan_field_reason` | DRAFT | pending | pending |
| `plan_field_step` | DRAFT | pending | pending |
| `plan_field_situation` | DRAFT | pending | pending |
| `plan_field_action` | DRAFT | pending | pending |
| `plan_count` | DRAFT | pending | pending |
| `plan_error_empty` | DRAFT | pending | pending |
| `plan_error_too_long` | DRAFT | pending | pending |
| `plan_error_invalid_characters` | DRAFT | pending | pending |
| `plan_duplicate_note` | DRAFT | pending | pending |
| `plan_save` | DRAFT | pending | pending |
| `plan_saving` | DRAFT | pending | pending |
| `plan_retry` | DRAFT | pending | pending |
| `plan_save_as_new` | DRAFT | pending | pending |
| `plan_save_failed` | DRAFT | pending | pending |
| `plan_item_gone` | DRAFT | pending | pending |
| `plan_edit` | DRAFT | pending | pending |
| `plan_delete` | DRAFT | pending | pending |
| `plan_edit_item_description` | DRAFT | pending | pending |
| `plan_delete_item_description` | DRAFT | pending | pending |
| `plan_delete_confirm` | DRAFT | pending | pending |
| `plan_delete_confirm_action` | DRAFT | pending | pending |
| `plan_keep` | DRAFT | pending | pending |
| `plan_delete_failed` | DRAFT | pending | pending |
| `plan_if_label` | DRAFT | pending | pending |
| `plan_then_label` | DRAFT | pending | pending |

## 7. Known limitations and residual risks

- State 1 only; plan content is lost when the process ends (in-memory).
- No `FLAG_SECURE`; keyboard learning and clipboard copy of typed text are not suppressed (see OD-W1-3/4).
- Item text appears in TalkBack content descriptions for Edit/Delete buttons (the user's own words, needed to tell rows apart).
- Numerals in the character counter follow the device locale (A9 numeral policy not decided here).
- Android build, lint and tests were not run locally (no SDK); GitHub CI is the gate.

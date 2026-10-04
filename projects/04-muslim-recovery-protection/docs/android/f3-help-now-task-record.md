# F3 Help Now: task record and content review record

Status: implementation for review. Not merged, no PR opened by the implementation agent.
Branch `feature/f3-help-now`, base `3f8a014965f6b833ab544e3f39eeffa50a3151fc` (F9 head, PR #79 unmerged).
Specification: FEATURE CONTRACT v1, F3 section and section 0.

## Scope implemented (recovery-first immediate support, NOT a blocking or security feature)

Package `feature/helpnow/`:

| File | Purpose |
|---|---|
| `HelpNowModel.kt` | phases, needs, generic steps, duration choices (60/90/120, default 90) |
| `HelpNowState.kt` | pure `HelpNowState`, `HelpNowEvent`, `reduce` (invalid events ignored) |
| `SuggestionPolicy.kt` | deterministic step ranking, calm cycling when all steps were tried |
| `HelpNowTimer.kt` | monotonic clock port, `TimerNumerals` seam (OD-F3-1), timer arithmetic over an absolute deadline |
| `HelpNowController.kt` | thin state holder over `reduce`; `HelpNowViewModel` keeps it across rotation and locale recreate |
| `PersonalSupport.kt` | feature-local personal-tier port (Open / Locked / Unavailable), redacted `toString` |
| `HelpNowCatalog.kt` | enum to string-resource mapping |
| `BreathingIndicator.kt` | animated guide with text cue, static text when animations are removed |
| `HelpNowRoute.kt` | `HelpNowRoute(controller, onClose, ...)` screens for all phases |

Resources: `strings_helpnow.xml` in `values`, `values-ar`, `values-de` (prefix `helpnow_`).

Persists nothing. No permission, service, notification, wake lock, vibration, network, logging, analytics, or
protection code. Not wired into the app (see Integration Requests).

## OWNER DECISION REQUIRED

| ID | State in this branch |
|---|---|
| OD-F3-1 timer numerals | OWNER DECISION REQUIRED - OD-F3-1 (not final policy). All timer digits pass through `TimerNumerals`. `NeutralLatinNumerals` (ASCII digits, no ICU/locale) is the contract's neutral default, a TEMPORARY detail only. Replacing it is a one-class change. |
| OD-F3-2 named reviewers | Not decided. Every string below is DRAFT. |
| OD-F3-3 emergency / help-line content | No such content, number or contact exists in any string. `HelpNowRoute(qualifiedHelpSlot = ...)` is an empty slot the Integration Agent fills after the Owner decides. A JVM test fails if digits, URLs or phone patterns appear in the strings. The generic "consider talking with a qualified professional" line is draft copy with no contact detail, release-gated like all copy. |
| OD-F3-4 durations | Contract default (60, 90, 120 s; default 90; not persisted) implemented; needs the Owner's confirmation. |
| OD-F3-5 keep screen on during the timer | Seam `keepScreenOnDuringTimer`, default false (not chosen). Only sets the view flag; no wake lock. |
| OD-F3-6 app shortcut | Not implemented (manifest and `res/xml` are Integration-owned). |
| OD-F3-7 local Help Now count | Not implemented (needs F7/D1). |

## Integration Requests

1. Entry wiring (Integration Agent, `MainActivity` / future navigation, or the internal shell): obtain
   `ViewModelProvider(owner, HelpNowViewModel.factory())[HelpNowViewModel::class.java].controller` and call
   `HelpNowRoute(controller, onClose = ...)` inside `TabsiraTheme`. Reason: F3 may not edit `MainActivity`,
   navigation or `AppContainer`. Alternatives: a plain `remember { HelpNowController() }` (loses the timer on
   recreate). Impact on F1/F5/F9: none.
2. `PersonalSupportSource` binding: adapt the real reader (F7 / shared `PersonalSupportReader`, OD-W1-1) to
   `PersonalSupportSource`. Until then pass null (generic tier only). Reason: the shared port is still a proposal.
3. Emulator job required classes: `ci/check_instrumentation_results.py` / the workflow list required test classes.
   Add `com.muslimrecovery.protection.feature.helpnow.HelpNowRouteTest` (F3 may not edit `ci/**`). Impact: none on
   other features.
4. Optional F14 trusted-person callback and F8 faith slot: pass through `trustedPerson` and `faithSlot`.
5. Optional `FLAG_SECURE` while personal content is shown (OD-W1-3): to be set by the host with a `core/security`
   helper once F7 provides it; F3 renders personal text only when the source reports Open.
6. Play/internal manifest: nothing required. No manifest change is requested.

## Verification honesty

No Android SDK locally; Gradle was not run locally. GitHub CI is the gate. See the report for CI results.

## Content review record (OD-W1-5, D-15)

All copy is DRAFT and release-blocking until the named clinical reviewer (and religious reviewer for any faith
text) marks each key APPROVED. Arabic and German are draft translations needing native-speaker review.
A JVM test (`HelpNowResourcesTest`) requires that every key in `strings_helpnow.xml` has a row here.

| Key | Status | English text |
|---|---|---|
| `helpnow_need_heading` | DRAFT | What do you need right now? |
| `helpnow_need_hint` | DRAFT | Pick any that fit, or skip. There is no wrong answer. |
| `helpnow_need_calm` | DRAFT | To calm down |
| `helpnow_need_distraction` | DRAFT | Something to occupy my mind |
| `helpnow_need_movement` | DRAFT | To move my body |
| `helpnow_need_connection` | DRAFT | To be around people |
| `helpnow_need_rest` | DRAFT | To rest |
| `helpnow_action_continue` | DRAFT | Continue |
| `helpnow_action_skip` | DRAFT | Skip |
| `helpnow_action_leave` | DRAFT | Leave Help Now |
| `helpnow_step_heading` | DRAFT | Take one short step |
| `helpnow_step_slowbreathing_title` | DRAFT | Breathe slowly |
| `helpnow_step_slowbreathing_body` | DRAFT | Let your shoulders drop. Breathe in gently, then out a little longer. |
| `helpnow_step_waterandstretch_title` | DRAFT | Water and a stretch |
| `helpnow_step_waterandstretch_body` | DRAFT | Drink some water, stand up and stretch your arms and neck. |
| `helpnow_step_changeplace_title` | DRAFT | Change where you are |
| `helpnow_step_changeplace_body` | DRAFT | Move to another room, or to a place where other people are. |
| `helpnow_step_namefivethings_title` | DRAFT | Look around you |
| `helpnow_step_namefivethings_body` | DRAFT | Quietly name five things you can see and two things you can hear. |
| `helpnow_step_shortwalk_title` | DRAFT | A short walk |
| `helpnow_step_shortwalk_body` | DRAFT | Walk at an easy pace, indoors or outside, until the timer ends. |
| `helpnow_all_tried` | DRAFT | You have tried every step. Starting again is fine. |
| `helpnow_duration_heading` | DRAFT | How long? |
| `helpnow_duration_option` | DRAFT | %1$d seconds |
| `helpnow_timer_description` | DRAFT | Time remaining %1$s |
| `helpnow_timer_finished` | DRAFT | Time is up. Continue when you are ready. |
| `helpnow_breathe_in` | DRAFT | Breathe in slowly |
| `helpnow_breathe_out` | DRAFT | Breathe out slowly |
| `helpnow_breathe_static` | DRAFT | Breathe in slowly, then out slowly, at your own pace. |
| `helpnow_action_step_done` | DRAFT | Done with this step |
| `helpnow_personal_steps_heading` | DRAFT | Your own steps |
| `helpnow_personal_reasons_heading` | DRAFT | Your reasons |
| `helpnow_reflect_heading` | DRAFT | Take a moment |
| `helpnow_reflect_body` | DRAFT | Think about what matters to you. You do not need to say anything. |
| `helpnow_reassess_heading` | DRAFT | How do you feel now? |
| `helpnow_reassess_lighter` | DRAFT | A bit lighter |
| `helpnow_reassess_strong` | DRAFT | Still strong |
| `helpnow_strong_body` | DRAFT | That is okay. You can take another short step. |
| `helpnow_strong_another` | DRAFT | Another step |
| `helpnow_trusted_person_action` | DRAFT | Reach out to someone I trust |
| `helpnow_qualified_help` | DRAFT | If this stays strong or is hard to carry alone, consider talking with a qualified professional. |
| `helpnow_done_heading` | DRAFT | You paused |
| `helpnow_done_body` | DRAFT | You took a moment for yourself. You can come back at any time. |

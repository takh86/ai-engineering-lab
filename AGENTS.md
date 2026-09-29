# Repository Guidelines

## Project Structure & Module Organization

This repository is a portfolio of independent projects. Root files (`README.md`, `PROJECTS.md`, `CONTRIBUTING.md`) explain the lab; `docs/` holds shared workflow and quality guidance, `templates/` holds reusable document outlines, and `assets/` holds branding. The active implementation is `projects/04-muslim-recovery-protection/`: its `docs/` records the problem, requirements, architecture, and decisions. Android source and resources live under `android/app/src/main/`; unit tests live under `android/app/src/test/`. Follow a project's own README when its layout differs from the generic lab template.

## Build, Test, and Development Commands

From `projects/04-muslim-recovery-protection/android/`, run:

```powershell
.\gradlew assembleDebug --no-daemon
.\gradlew testDebugUnitTest --no-daemon
.\gradlew lintDebug --no-daemon
```

These build the debug APK, run local JUnit tests, and run Android lint, respectively. `.\gradlew clean assembleDebug testDebugUnitTest --no-daemon` is the project's documented clean verification command. No repository-wide build command exists.

## Coding Style & Naming Conventions

Use four-space indentation in Kotlin and Gradle Kotlin DSL. Keep Kotlin types in `PascalCase`, functions and properties in `camelCase`, and packages lowercase (for example, `com.muslimrecovery.protection.domain.rules`). Keep domain logic in its matching `domain/` package and Android resources in `res/`. Match existing Markdown headings and keep decisions and requirements in the project's `docs/`. No dedicated Kotlin formatter or third-party lint configuration is present; use the existing style and Android lint.

## Testing Guidelines

Use JUnit 4 for local unit tests. Name test classes after the subject with a `Test` suffix (for example, `RuleSetTest.kt`), place them in the matching package under `src/test/`, and use descriptive behavior names for test methods. Cover normal decisions, malformed input, and privacy-sensitive error paths. Run `testDebugUnitTest` for code changes; apply the relevant checks in `docs/QUALITY_GATES.md`. No numeric coverage target is defined.

## Commit & Pull Request Guidelines

Recent commits commonly use `docs:`, `chore:`, `feat(04):`, or `fix(04):` followed by a concise action; follow that pattern. Keep changes scoped to the current task. Use `.github/PULL_REQUEST_TEMPLATE.md`: state the goal, changes, acceptance criteria, verification, AI contribution, human review focus, and risks or limitations. Link the relevant issue when one exists, and include screenshots for visible UI changes. Do not claim a check passed unless you ran it.

## Security & Agent Workflow

Do not commit credentials or personal data; see `SECURITY.md`. Before implementation, read the relevant project docs and current task scope. Treat AI output as untrusted until verified, and seek human review for major architecture, security, privacy, or dependency decisions.


## Routine V2 execution guardrails

- Codex is the engineering executor; ChatGPT/Work defines and reviews the Task Contract.
- Work only on a feature branch; open a pull request before `main`.
- Never push directly to `main`, force-push `main`, or delete a protected branch.
- Never merge or enable auto-merge. The human owner performs the merge.
- Keep diffs focused; ask before touching files outside the agreed scope.
- Never read, print, or edit secrets or `.env` files.
- Never run destructive migrations.
- Production, credentials, important deletes, external messages, auth/RLS weakening, and substantial architecture changes require an explicit human gate.
- Verify version-specific APIs with current primary documentation when needed.
- Do not install a new Plugin/MCP without explicit approval.
- Do not say "done" without implementation, validation, evidence, and no critical blocker.

## V2 required evidence

- `git diff --stat` and a focused summary.
- Tests, lint, typecheck, and build reported as PASS / FAIL / NOT RUN / N/A with reasons.
- Android `assembleDebug` includes Kotlin compilation; no standalone typecheck is configured.
- Screenshots for UI changes, known limitations, untested areas, and human gates.
- Flag authorization/RBAC gaps, missing business-rule tests, unvalidated input, secrets, destructive migrations, and security regressions.
- Stop on ambiguity, out-of-scope needs, destructive changes, or unresolved test failures.

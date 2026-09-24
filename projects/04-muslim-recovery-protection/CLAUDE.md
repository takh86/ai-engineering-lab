# Project 04 — Muslim Recovery Protection

Read root CLAUDE.md and:

- docs/problem.md
- docs/requirements.md
- docs/architecture.md
- docs/decisions.md

The current human-approved Task Contract defines active scope.
Do not assume future milestones are authorized.

Baseline:
Kotlin + Compose, single :app module, minSdk 24, compile/targetSdk 36.
No backend or new Gradle modules without approval.

Build from android/:

```powershell
.\gradlew clean assembleDebug testDebugUnitTest --no-daemon
```

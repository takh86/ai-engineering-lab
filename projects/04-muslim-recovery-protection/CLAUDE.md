# Project 04 — Muslim Recovery Protection

Read root CLAUDE.md and:

- docs/problem.md
- docs/requirements.md
- docs/architecture.md
- docs/decisions.md

The current human-approved Task Contract defines active scope.
Do not assume future milestones are authorized.

No backend or new Gradle modules without approval.

Build from android/ with explicit flavor variants (internal = historical/experimental build, play = product build):

```powershell
.\gradlew clean assembleInternalDebug assemblePlayDebug testInternalDebugUnitTest testPlayDebugUnitTest lintInternalDebug lintPlayDebug --no-daemon
```

Do not use `testDebugUnitTest` or `lintDebug` as generic commands: since flavors exist they are ambiguous and fail.
`playRelease` upload requires explicit Owner approval.

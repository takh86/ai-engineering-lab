# Project 04 — Muslim Recovery Protection

Read root CLAUDE.md and:

- docs/problem.md
- docs/requirements.md
- docs/architecture.md
- docs/decisions.md

The current human-approved Task Contract defines active scope.
Do not assume future milestones are authorized.

No backend or new Gradle modules without approval.

Build from android/:

```powershell
.\gradlew clean assembleDebug testDebugUnitTest --no-daemon
```

The Tabsira browser extension lives in chrome-extension/ (Node >= 20.11, no runtime dependencies; one dev dependency, playwright-core). Build and test from chrome-extension/:

```powershell
npm ci
npm test
npm run verify-reproducible
```

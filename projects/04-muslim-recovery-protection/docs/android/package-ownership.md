# Android package ownership

Source: M3-01 §2, §18 and Amendment A5. One `:app` module; boundaries are packages under
`projects/04-muslim-recovery-protection/android/app/src/<sourceSet>/java/com/muslimrecovery/protection/`.

| Package | Owner | Notes |
|---|---|---|
| `app/` | Integration Agent | Composition root: `TabsiraApplication`, `AppContainer`; later root navigation. |
| `core/data/` | Foundation, then Integration | D0 `SettingsStore` only in W0a. D1 persistence arrives with F7. |
| `core/model/`, `core/navigation/` | Foundation, then Integration | Created only when the first approved Feature Contract needs them. |
| `core/design/` | F9 | Created by F9. |
| `core/security/` | F7 | Created by F7. |
| `feature/<name>/` | the matching feature agent (F1–F9, F14, F15) | `feature/settings` belongs to F9. A feature may import `core/**` only. |
| `protection/appblocking/` | F10 | Separately gated. |
| `experimental/{webguard,dns,api}/` | F11–F13, F16 | Exists only in `src/internal`. |
| `vpn/`, `dns/`, `domain/` | historical | Not moved, renamed or edited in W0a. `domain/protection/ProtectionState` is the single protection-state source of truth. |

Dependency rules (enforced by `PackageBoundaryTest` over every non-test source set under `src/`, `.kt` and `.java`,
strict by default; comments are ignored, string literals are not):

- every file's `package` declaration must match its directory, and no file may sit outside `com/muslimrecovery/protection`;
- nothing may wildcard-import the project root package;
- `experimental` may be referenced only by composition wiring under `src/internal/**/app/`; never from `src/main`,
  `src/play`, `core`, `feature` or any other source set (Amendment A5);
- `core` never depends on `feature` or `app`;
- `feature/<a>` never depends on `feature/<b>` or `app`;
- `core`, `feature` and `app` do not use the historical `vpn` or `dns` packages.

Not encoded (best effort or by design): `feature` using `domain.*`, `core`/`feature` using `protection.*`, and Kotlin type aliases.

Shared files owned by the Integration Agent: `MainActivity.kt`, manifests, `app/build.gradle.kts`, root navigation, `AppContainer`/application
wiring, build variants, database/bootstrap wiring, `release-boundary/**`, `.github/workflows/**`. Feature agents file an INTEGRATION REQUEST
(file, change, reason, dependency) instead of editing them.

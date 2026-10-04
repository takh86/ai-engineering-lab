# Historical code map (M3-01 W0b)

The historical M1 DNS/VPN experiment is preserved, not deleted. W0b moved it from the shared `src/main` /
`src/test` source sets into the **internal-only** `src/internal` / `src/testInternal` source sets, so the Play
flavor no longer contains it. Package names did **not** change, so `git log --follow` keeps full history
(all moves are pure `git mv` renames, and the diff guard proves each moved file is byte-identical, except the one
approved edit below).

Roots: `projects/04-muslim-recovery-protection/android/app/src/`.

| Old path | New internal-only path | Change | Reason |
|---|---|---|---|
| `main/java/com/muslimrecovery/protection/MainActivity.kt` | `internal/java/com/muslimrecovery/protection/ExperimentalHarnessActivity.kt` | **Rename in place (commit C1, class name changed), then pure move (C3)** | The historical harness is preserved as `ExperimentalHarnessActivity`. |
| *(new)* | `main/java/com/muslimrecovery/protection/MainActivity.kt` | **New file (actual code)** | The product shell launcher; not a relocation of the harness. |
| `main/.../vpn/CapturedNetworkWatch.kt` | `internal/.../vpn/CapturedNetworkWatch.kt` | R100 move | Experiment isolation. |
| `main/.../vpn/DnsProxyRuntime.kt` | `internal/.../vpn/DnsProxyRuntime.kt` | R100 move | same |
| `main/.../vpn/LocalProtectionVpnService.kt` | `internal/.../vpn/LocalProtectionVpnService.kt` | **Move + 2-line edit** (C1) | The foreground notification opens `ExperimentalHarnessActivity` instead of `MainActivity` (D-W0b-1). The only edits: the import and `Intent(this, ExperimentalHarnessActivity::class.java)`. |
| `main/.../vpn/UnderlyingNetworkDns.kt` | `internal/.../vpn/UnderlyingNetworkDns.kt` | R100 move | same |
| `main/.../vpn/UnderlyingNetworkMonitor.kt` | `internal/.../vpn/UnderlyingNetworkMonitor.kt` | R100 move | same |
| `main/.../vpn/VpnLifecycleController.kt` | `internal/.../vpn/VpnLifecycleController.kt` | R100 move | same |
| `main/.../vpn/VpnRuntimeFacts.kt` | `internal/.../vpn/VpnRuntimeFacts.kt` | R100 move | same |
| `main/.../vpn/VpnRuntimeStatus.kt` | `internal/.../vpn/VpnRuntimeStatus.kt` | R100 move | same |
| `main/.../dns/DnsFilteringEngine.kt`, `DnsMessageCodec.kt`, `DnsPacketProcessor.kt`, `DnsProxyStatus.kt`, `ExperimentalDnsTestRules.kt`, `Ipv4UdpDnsPacketAdapter.kt`, `UpstreamDnsSelector.kt` | `internal/.../dns/` (same names) | R100 moves (7 files) | Experiment isolation. |
| `test/.../vpn/{CapturedNetworkWatchTest,UnderlyingNetworkInvalidationLifecycleTest,VpnLifecycleControllerTest,VpnRuntimeFactsTest}.kt` | `testInternal/.../vpn/` (same names) | R100 moves (4 files) | The tests move with the code they test and run in the internal flavor. |
| `test/.../dns/{DnsFilteringEngineTest,DnsMessageCodecTest,DnsPacketProcessorTest,DnsParserRobustnessTest,Ipv4UdpDnsPacketAdapterTest,UpstreamDnsSelectorTest,DnsTestPackets}.kt` | `testInternal/.../dns/` (same names) | R100 moves (7 files) | same |

26 files are detected as renames against `main` (15 main + 11 tests); with the harness (renamed in C1) that is 27 relocated files (16 main + 11 tests). **Not moved:** `domain/protection/**` and `domain/rules/**` (the single protection-state
source of truth and the rules engine, pure Kotlin, no components) and their tests stay in `src/main` / `src/test`; the internal
flavor sees them.

## Manifest changes (actual modifications)

| Item | Before W0b | After W0b |
|---|---|---|
| `uses-permission` FOREGROUND_SERVICE, FOREGROUND_SERVICE_SYSTEM_EXEMPTED, POST_NOTIFICATIONS, INTERNET, ACCESS_NETWORK_STATE | `src/main/AndroidManifest.xml` | `src/internal/AndroidManifest.xml` only |
| `LocalProtectionVpnService` (+ `SUPPORTS_ALWAYS_ON=false`) | `src/main` | `src/internal` only |
| Historical harness activity | the launcher | `ExperimentalHarnessActivity`, **not exported**, not a launcher, `src/internal` only |
| Launcher | the harness | `MainActivity` (product shell), `src/main` |

## Other new W0b files

`app/ProductShell.kt` (main); `app/InternalToolsEntry.kt` in `src/play` (empty) and `src/internal` (button to the harness) as
compile-time, flavor-specific wiring (no generic seam); tests: `ManifestSplitTest`, `NotificationTargetSourceTest`, extended
`PackageBoundaryTest`, instrumentation tests (compiled in CI, not run: D-17); CI helpers: `ci/w0b_diff_guard.py`,
`release-boundary/check_internal_artifact.py`.

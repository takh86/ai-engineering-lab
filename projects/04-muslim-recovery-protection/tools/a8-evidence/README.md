# A8 read-only system-evidence collector

Windows PowerShell helper for the merged [M2-03B runbook](../../docs/m2-03b-a8-verification-runbook.md)
§3, §4.1 and **SYS-SIG (§6.3)**. It collects `dumpsys connectivity` and `dumpsys dnsresolver`
separately, plus the named device properties and optional Settings **reads**. It does not execute
the V0-V13 matrix, DNS-CHECK, browser actions, screenshots, resets or restoration.

**It never classifies verification results.** Source statuses such as `OutputCaptured`,
`ServiceUnavailable`, `PermissionDenied`, `EmptyOutput`, `CommandError` and `TimedOut` describe
collection only. OutputCaptured does not mean the output is understandable or sufficient.
The Tech Lead applies the frozen runbook and [M2-02](../../docs/m2-02-architecture-options.md).
This helper does not change [M2-03](../../docs/m2-03-architecture-adr.md) or issue #40.

## Prerequisites

- Windows PowerShell 5.1 or PowerShell 7, and trusted Android SDK Platform-Tools.
- The Samsung **SM-A566B**, with debugging already authorized by its owner. The collector
  cannot grant permission, pair, reconnect, switch debugging modes or configure the phone.
- Complete the applicable runbook gate/checkpoint and manual setup before running collection.
- A private, preferably non-synced local evidence directory outside **every Git worktree**.
  The default is `%LOCALAPPDATA%\A8-evidence`. No administrator rights are required.
- Read/review the scripts before running. Follow local PowerShell execution policy; this tool
  does not change it or require an execution-policy bypass.

ADB lookup order: explicit `-AdbPath` (no fallback if invalid),
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`, `ANDROID_SDK_ROOT`, `ANDROID_HOME`, then PATH.

## Run

From this directory in a PowerShell window:

```powershell
# Inventory only: no system evidence is collected and no directory is created.
.\Collect-A8Evidence.ps1 -ListTargets

# After the Tech Lead resumes the paused session and completes manual setup:
# replace 1 with the transport ID just listed; choose the already registered run label.
.\Collect-A8Evidence.ps1 -TransportId 1 -Row V1-CELL -Run 1 -Network CELL

# Optional executable and external output root (paths may contain spaces).
.\Collect-A8Evidence.ps1 -AdbPath "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" `
    -TransportId 1 -Row V1-CELL -Run 1 -Network CELL -EvidenceDirectory 'D:\Private evidence\A8'
```

Without `-TransportId`, the script displays the list and prompts. An empty/invalid response
stops it. **Even one target requires an explicit choice.** Duplicate Samsung entries remain
separate: matching model/product names do not prove physical identity. The table shows model,
product, device codename, state, transport ID and a connection hint, without serials/addresses.
An absent `usb:` field is **not** proof of wireless: some ADB backends omit it.

The model read must equal `SM-A566B`. Before each evidence read the script lists targets again,
checks the selected serial/transport association and reads the model. A disconnected, unauthorized,
ambiguous, changed or wrong-model target stops collection. Transport IDs can change across ADB
sessions; list again instead of reusing an old ID blindly. There is no retry or fallback device.

`-Row`, `-Run` and `-Network` are **human labels**, not observed facts. A CELL label does not
establish that cellular is the default network. For the paused V1-CELL step, use authorized USB
with Wi-Fi off and inspect the captured active network. A recognizable network transport is
rejected for CELL. The tool never turns Wi-Fi on to recover a lost wireless ADB connection.

## Files and provenance

One invocation collects each named source once. `-TimeoutSeconds` defaults to 30 per command;
a timeout stops the **host adb client**, preserves its partial streams and records `TimedOut`.
No retry is scheduled. Re-running this tool is another collection, requiring the runbook's
human decision where an extra run is involved.

The folder is `<root>/<UTC date>/<ROW>/<runbook prefix>_<unique capture ID>/`:

- `raw/`: byte-for-byte stdout and stderr from each command, kept separate even when empty.
  Identity snapshots contain serials and other targets. Never share/commit this folder.
- `review/`: allowlisted extracts, collection statuses and metadata. Line numbers point into
  the corresponding raw stream. This is **not a sanitized complete dump**.
- Both: per-command JSON with exact command, start/end UTC, exit code, timeout, raw SHA-256
  hashes; `session.json` with human labels, selected transport, tool/runbook hashes and whether
  the collection loop finished. Completion is not evidence sufficiency.

The stdout file stems for SYS-SIG follow §10 (`..._dumpsys-conn`, `..._dumpsys-dnsres`);
`.stdout`/`.stderr`, metadata and unique capture subfolders are tooling provenance additions.
Every invocation creates a new folder; raw writes use create-new mode. Previous runs are not
overwritten. Keep partial folders if collection stops. Timestamps use the desktop clock, not
an independently trusted time source. Dumps are sequential snapshots, not atomic observations.

## Redaction and privacy limits

Extracts copy only recognized network IDs/types, Private DNS booleans, the configured
`PrivateDnsServerName`, address-list empty/present and address-family markers, device version
fields and limited resolver validation vocabulary. **All addresses, SSID, BSSID, MAC, serial, subscriber, account,
interface and other unlisted content are omitted**, including unfamiliar vendor text.
Recognized identity values are removed in place, so a long mixed line keeps its allowlisted Private DNS
fields. Quoted text is removed first; an unquoted SSID value is removed to the end of the line, so it cannot
inject a fake Private DNS field. Such lines are marked `[identity values removed; inspect raw locally]`,
and genuine fields after an unquoted SSID on the same line are lost from the extract.
**Residual limit:** Android prints a quoted SSID without escaping embedded quotes, so a hostile SSID containing
`", PrivateDnsServerName: x, "` could still produce a fake field in the extract. The extract is a reading aid
only; confirm Private DNS facts against the raw stream before relying on them.
Resolver vocabulary is labelled as context-limited tokens, never as a validation conclusion.
Use raw locally when associating a resolver server/status with a network is unclear.

- A missing service is explicitly reported even if adb returns exit code zero. It is never
  replaced with connectivity, settings or another service. The helper cannot resolve the
  known V1-WIFI missing-source limitation or revise that human decision.
- Unknown formats and unrecognized fields remain only in raw; `NO RECOGNIZED FIELDS` is not
  absence of Private DNS. Manual inspection can still be necessary on Samsung/Android versions.
- The retained DNS hostname, timestamps, model/version and local network IDs may be sensitive.
  Review **every review file manually** before sharing. The tool does not redact screenshots,
  arbitrary files or other commands. Raw data is not encrypted or given a new ACL by this tool.
  Inherited Windows permissions, disk protection, backups and sync remain the operator's job.
- DNS-CHECK is deliberately outside this helper. Q4 requires preserving test-domain answer
  addresses for the oracle; do not use this system-evidence projection on ping/dig evidence.
- Terminal output includes the local output path; do not publish a terminal recording blindly.

## Safety boundary / review checklist

All native execution goes through `Invoke-A8Read` and the closed `Get-A8CommandArguments`
catalogue. There is no command passthrough. The only commands are:

| Host | Explicitly selected device (`-t <digits>`) |
|---|---|
| `devices -l`, `version` | `shell getprop ro.product.model` |
| | `shell getprop ro.build.version.release` / `.sdk` / `.security_patch` |
| | `shell settings get global private_dns_mode` / `private_dns_specifier` |
| | `shell dumpsys connectivity`, `shell dumpsys dnsresolver` |

Only host files/processes are created. ADB may start its normal desktop server. No device-state
mutation, network lookup/probe, arbitrary shell command, app action, settings change, automatic
repeat, alternative evidence source, V-row classification or GitHub upload exists here.
Use the trusted SDK executable; an arbitrary replacement executable is outside this guarantee.
Child processes ignore ADB serial/server/trace environment overrides; they use the local server
and the explicit transport. Read-only collection can still add ordinary device diagnostic logs.

## Tool tests (synthetic only)

```powershell
.\tests\Test-A8Evidence.ps1
```

No external test dependency or connected device is needed. Tests exercise parsing, privacy,
identity selection, command safety, unavailable/error/empty sources, raw preservation and
non-overwriting paths; collection orchestration uses an in-memory mock of the native boundary.
Native stream handling is also checked with a harmless host utility (`where.exe` on Windows,
`/bin/echo` on Linux), never an installed adb.
Fixtures live only in `tests/fixtures/`, carry no real device data, and are never selectable
by the collector. They are **not physical evidence, V-row results or architecture validation**.

The scoped Windows CI runs the same suite on PowerShell 5.1 and 7. A real Windows/SM-A566B
collection and manual raw-versus-review comparison remain human verification; synthetic tests
cannot establish OEM output completeness or resume the paused device session.

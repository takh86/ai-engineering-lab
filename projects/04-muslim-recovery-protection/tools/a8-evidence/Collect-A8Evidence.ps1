#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$ListTargets,
    [string]$AdbPath,
    [string]$TransportId,
    [string]$Row,
    [ValidateSet('1', '2', '3')][string]$Run,
    [ValidateSet('WIFI', 'CELL', 'IPV6', 'P853', 'CPORTAL')][string]$Network,
    [string]$EvidenceDirectory,
    [ValidateRange(1, 120)][int]$TimeoutSeconds = 30
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'A8Evidence.psm1') -Force

try {
    $adb = Resolve-A8Adb $AdbPath
    $inventory = Invoke-A8Read -AdbPath $adb -Name devices -TimeoutSeconds $TimeoutSeconds
    if ((Get-A8SourceStatus $inventory) -ne 'OutputCaptured') { throw 'Cannot list adb targets. Check the local SDK and authorized connection.' }
    $parsed = ConvertFrom-A8Devices $inventory.Stdout
    # Serial/address deliberately absent from the terminal table. Rows are not deduplicated.
    $parsed.Targets | Select-Object TransportId, State, Model, Product, Device, Connection | Format-Table -AutoSize | Out-Host
    if ($parsed.UnparsedLines -gt 0) { throw 'Unrecognized adb inventory lines. Update/check Platform-Tools; no automatic selection.' }
    if ($ListTargets) { return }
    if (-not $parsed.Targets.Count) { throw 'No adb targets. Authorize the desired connection manually, then list again.' }
    if (-not $TransportId) { $TransportId = Read-Host 'Enter the exact transport ID (required even for one target)' }
    $target = Select-A8Target $parsed.Targets $TransportId
    if (-not $Row -or -not $Run -or -not $Network) { throw 'Supply -Row, -Run and -Network as evidence labels from the runbook. No row/run is chosen automatically.' }
    if ($Network -eq 'CELL') {
        Write-Warning 'CELL is your label, not a detected network. Use authorized USB with Wi-Fi off; inspect the active default network in the capture.'
        if ($target.Connection -eq 'Network transport') { throw 'Selected transport depends on a network. Select USB for the paused V1-CELL collection.' }
    }
    if (-not $EvidenceDirectory) {
        if (-not $env:LOCALAPPDATA) { throw 'Supply -EvidenceDirectory outside the repository.' }
        $EvidenceDirectory = Join-Path $env:LOCALAPPDATA 'A8-evidence'
    }
    $session = New-A8EvidenceDirectory $EvidenceDirectory $Row "$Run" $Network
    Write-Host ('Evidence folder: ' + $session.Path)
    Write-Host 'Collecting one read-only snapshot. No DNS queries, retries, settings changes or row classification.'
    $manifest = [ordered]@{
        Schema = 1; RowLabel = $Row; RunLabel = $Run; NetworkLabel = $Network
        LabelsAreHumanSupplied = $true; TransportId = $TransportId; ExpectedModel = 'SM-A566B'
        StartedUtc = [DateTimeOffset]::UtcNow.ToString('o'); EndedUtc = $null
        ToolFileHashes = @{}; RunbookSha256 = $null
        CollectionCompleted = $false; Classification = 'Human/runbook only; not assigned'
    }
    foreach ($file in @('Collect-A8Evidence.ps1', 'A8Evidence.psm1')) {
        $manifest.ToolFileHashes[$file] = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $file) -Algorithm SHA256).Hash
    }
    $runbook = Join-Path $PSScriptRoot '../../docs/m2-03b-a8-verification-runbook.md'
    if (Test-Path -LiteralPath $runbook) { $manifest.RunbookSha256 = (Get-FileHash -LiteralPath $runbook -Algorithm SHA256).Hash }
    try {
        Invoke-A8Collection -AdbPath $adb -Target $target -InventoryCapture $inventory -Session $session -TimeoutSeconds $TimeoutSeconds
        $manifest.CollectionCompleted = $true
    }
    finally {
        $manifest.EndedUtc = [DateTimeOffset]::UtcNow.ToString('o')
        # No local paths, device serial, raw errors, or desktop account name in this manifest.
        $json = $manifest | ConvertTo-Json -Depth 5
        foreach ($folder in @('raw', 'review')) {
            Set-Content -LiteralPath (Join-Path (Join-Path $session.Path $folder) 'session.json') -Value $json -Encoding UTF8
        }
    }
    Write-Host 'Collection finished. Completion is NOT evidence sufficiency. Review source statuses and raw locally.'
    Write-Host 'Share only manually reviewed extracts from review/. Keep raw/ private and outside Git.'
}
catch {
    # Exceptions can include local filesystem paths; never attach raw native output to them.
    Write-Error ('Collector stopped. ' + $_.Exception.Message) -ErrorAction Continue
    exit 1
}

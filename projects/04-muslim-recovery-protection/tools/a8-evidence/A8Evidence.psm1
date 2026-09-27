#Requires -Version 5.1
Set-StrictMode -Version Latest

function Resolve-A8Adb {
    param([string]$AdbPath)
    $candidates = @()
    if ($AdbPath) { $candidates = @($AdbPath) }
    else {
        if ($env:LOCALAPPDATA) {
            $candidates += Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
        }
        foreach ($sdk in @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME)) {
            if ($sdk) { $candidates += Join-Path $sdk 'platform-tools\adb.exe' }
        }
        $onPath = Get-Command adb.exe -CommandType Application -ErrorAction SilentlyContinue
        if ($onPath) { $candidates += $onPath.Source }
    }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Get-Item -LiteralPath $candidate).FullName
        }
    }
    throw 'adb.exe not found. Android SDK Platform-Tools are required; alternatively supply -AdbPath to the trusted SDK executable.'
}

function ConvertFrom-A8Devices {
    param([AllowEmptyString()][string]$Text)
    $targets = @()
    $unparsed = 0
    foreach ($line in ($Text -split '\r?\n')) {
        if (-not $line.Trim() -or $line -match '^List of devices attached\s*$') { continue }
        if ($line -notmatch '^(?<serial>\S+)\s+(?<state>device|offline|unauthorized|recovery|sideload|bootloader|no permissions)\b(?<rest>.*)$') {
            $unparsed++
            continue
        }
        $serial = $Matches.serial
        $state = $Matches.state
        $rest = $Matches.rest
        $fields = @{}
        foreach ($m in [regex]::Matches($rest, '(?:^|\s)(product|model|device|transport_id|usb):([^\s]+)')) {
            $fields[$m.Groups[1].Value] = $m.Groups[2].Value
        }
        $connection = 'Unspecified (not proof of USB)'
        if ($fields.ContainsKey('usb')) { $connection = 'USB reported' }
        elseif ($serial -match ':\d+$|_adb-tls-connect\._tcp') { $connection = 'Network transport' }
        $targets += [pscustomobject]@{
            Serial = $serial; State = $state; TransportId = $fields['transport_id']
            Model = $fields['model']; Product = $fields['product']; Device = $fields['device']
            Connection = $connection
        }
    }
    [pscustomobject]@{ Targets = @($targets); UnparsedLines = $unparsed }
}

function Select-A8Target {
    param([object[]]$Targets, [string]$TransportId)
    if ($TransportId -notmatch '\A[1-9][0-9]*\z') {
        throw 'Explicit numeric transport ID required; no target is selected automatically.'
    }
    $selected = @($Targets | Where-Object { $_.TransportId -ceq $TransportId })
    if ($selected.Count -ne 1) { throw 'Transport ID is missing or ambiguous. List targets again and select explicitly.' }
    if ($selected[0].State -cne 'device') { throw 'Selected transport is not online/authorized. No collection started.' }
    return $selected[0]
}

function Get-A8CommandArguments {
    param([string]$Name, [string]$TransportId)
    # The ONLY device-command catalogue. No shell text, names or arguments from the caller.
    $commands = @{
        devices = @('devices', '-l')
        version = @('version')
        model = @('shell', 'getprop', 'ro.product.model')
        android = @('shell', 'getprop', 'ro.build.version.release')
        api = @('shell', 'getprop', 'ro.build.version.sdk')
        patch = @('shell', 'getprop', 'ro.build.version.security_patch')
        mode = @('shell', 'settings', 'get', 'global', 'private_dns_mode')
        hostname = @('shell', 'settings', 'get', 'global', 'private_dns_specifier')
        connectivity = @('shell', 'dumpsys', 'connectivity')
        dnsresolver = @('shell', 'dumpsys', 'dnsresolver')
    }
    if (-not $commands.ContainsKey($Name)) { throw 'Command is not in the read-only catalogue.' }
    if ($Name -in @('devices', 'version')) { return $commands[$Name] }
    if ($TransportId -notmatch '\A[1-9][0-9]*\z') { throw 'A numeric transport ID is required for every device command.' }
    return @('-t', $TransportId) + $commands[$Name]
}

function Invoke-A8Read {
    param([string]$AdbPath, [string]$Name, [string]$TransportId,
        [ValidateRange(1, 120)][int]$TimeoutSeconds = 30)
    $arguments = @(Get-A8CommandArguments -Name $Name -TransportId $TransportId)
    $start = [DateTimeOffset]::UtcNow.ToString('o')
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $AdbPath
    # All tokens come from the catalogue or a validated integer; no shell interpolation.
    $info.Arguments = $arguments -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.RedirectStandardInput = $true
    foreach ($variable in @('ANDROID_SERIAL', 'ADB_SERVER_SOCKET', 'ANDROID_ADB_SERVER_ADDRESS',
            'ANDROID_ADB_SERVER_PORT', 'ADB_TRACE')) {
        $info.EnvironmentVariables.Remove($variable)
    }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    $stdout = New-Object System.IO.MemoryStream
    $stderr = New-Object System.IO.MemoryStream
    $timedOut = $false
    try {
        [void]$process.Start()
        $process.StandardInput.Close()
        $outTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout)
        $errTask = $process.StandardError.BaseStream.CopyToAsync($stderr)
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $timedOut = $true
            $process.Kill() # Host adb client only, never a device process or the adb server.
            $process.WaitForExit()
        }
        [void]$outTask.GetAwaiter().GetResult()
        [void]$errTask.GetAwaiter().GetResult()
        [pscustomobject]@{
            Name = $Name; Command = 'adb ' + ($arguments -join ' ')
            StartedUtc = $start; EndedUtc = [DateTimeOffset]::UtcNow.ToString('o')
            ExitCode = $process.ExitCode; TimedOut = $timedOut
            StdoutBytes = $stdout.ToArray(); StderrBytes = $stderr.ToArray()
            Stdout = [Text.Encoding]::UTF8.GetString($stdout.ToArray())
            Stderr = [Text.Encoding]::UTF8.GetString($stderr.ToArray())
        }
    }
    finally { $stdout.Dispose(); $stderr.Dispose(); $process.Dispose() }
}

function Get-A8SourceStatus {
    param($Capture)
    $text = $Capture.Stdout + "`n" + $Capture.Stderr
    if ($Capture.TimedOut) { return 'TimedOut' }
    if ($text -match '(?i)can(?:not|\x27t) find service\s*:|service\s+\S+\s+(?:not found|does not exist)') {
        return 'ServiceUnavailable'
    }
    if ($text -match '(?i)permission denial|permission denied|not allowed to dump') { return 'PermissionDenied' }
    if ($Capture.ExitCode -ne 0 -or $text -match '(?im)^\s*(?:adb(?:\.exe)?:\s*)?error:|DUMP TIMEOUT') {
        return 'CommandError'
    }
    if ([string]::IsNullOrWhiteSpace($Capture.Stdout)) { return 'EmptyOutput' }
    return 'OutputCaptured' # Transport observation only; not evidence adequacy or a V-row outcome.
}

function ConvertTo-A8ReviewText {
    param([AllowEmptyString()][string]$Text, [string]$Name)
    # Deliberate allowlist projection, NOT a claim that a regex can anonymize an entire dump.
    # Never return an original line. Unknown fields (including identifiers) stay in raw only.
    $result = New-Object 'System.Collections.Generic.List[string]'
    $result.Add('REDACTED EXTRACT - not a complete dump; no verification classification.')
    $result.Add('L numbers refer to the raw stream. Omitted text requires local human review.')
    $lineNumber = 0
    foreach ($line in ($Text -split '\r?\n')) {
        $lineNumber++
        # A free-form identity value can contain text resembling a Private DNS field.
        # Omit the whole line before parsing; never echo any part of that value.
        if ($line -match '(?i)(?:^|[\s,{])(?:SSID|BSSID|MAC|MacAddress|subscriberId|IMSI|IMEI|ICCID|serial|account|phone|owner(?:Uid)?)\s*[:=]') {
            $result.Add(('L{0}: [OMITTED identity-bearing line; inspect raw locally]' -f $lineNumber))
            continue
        }
        # Do not mistake quoted SSIDs or other quoted free text for field names.
        $line = [regex]::Replace($line, '"(?:\\.|[^"\\])*"', '[OMITTED quoted text]')
        $parts = New-Object 'System.Collections.Generic.List[string]'
        if ($Name -in @('connectivity', 'dnsresolver')) {
            foreach ($m in [regex]::Matches($line, '(?i)\b(Active default network|netId|Network ID)\s*[:=]\s*(-?\d+|none)\b|\bnetwork\{(\d+)\}')) {
                $parts.Add($m.Value)
            }
            foreach ($m in [regex]::Matches($line, '(?i)\b(?:type|Transports)\s*[:=]\s*(?:WIFI|WI-FI|CELLULAR|MOBILE|ETHERNET|VPN|BLUETOOTH|USB|WIFI_AWARE|LOWPAN)(?:[| +]+(?:WIFI|CELLULAR|MOBILE|ETHERNET|VPN|BLUETOOTH|USB))*\b')) {
                $parts.Add($m.Value)
            }
            foreach ($m in [regex]::Matches($line, '(?i)\b(?:UsePrivateDns|PrivateDnsActive|isPrivateDnsActive)\s*[:=]\s*(?:true|false)\b|\bPrivate DNS mode\s*[:=]\s*(?:strict|opportunistic|off)\b')) {
                $parts.Add($m.Value)
            }
            foreach ($m in [regex]::Matches($line, '(?i)\bPrivateDnsServerName\s*[:=]\s*([^\s,}\]]*)')) {
                $value = $m.Groups[1].Value
                # Keep the configured DNS hostname as required; IP literals are never retained.
                $address = $null
                if ([Net.IPAddress]::TryParse($value, [ref]$address)) { $value = '[REDACTED address]' }
                elseif ($value -notmatch '^[a-zA-Z0-9._-]*$') { $value = '[OMITTED unrecognized value]' }
                $parts.Add('PrivateDnsServerName: ' + $value)
            }
            foreach ($m in [regex]::Matches($line, '(?i)\b(ValidatedPrivateDnsAddresses|DnsAddresses|LinkAddresses|Routes)\s*[:=]\s*\[([^\]]*)\]')) {
                $value = $m.Groups[2].Value
                $state = 'present; contents redacted'
                if ([string]::IsNullOrWhiteSpace($value)) { $state = 'empty' }
                $parts.Add($m.Groups[1].Value + ': [' + $state + ']')
                # Family indicators only; do not copy addresses, prefixes or route targets.
                $families = @()
                if ($value -match '\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b') { $families += 'IPv4' }
                if ($value -match '(?:[a-fA-F0-9]{0,4}:){2}') { $families += 'IPv6' }
                if ($families.Count) { $parts.Add($m.Groups[1].Value + ' address-family tokens: ' + ($families -join ', ')) }
            }
            # Preserve resolver validation vocabulary only on relevant lines. It remains a
            # source fragment, not a synthesized validation result or active-network decision.
            if ($Name -eq 'dnsresolver' -and $line -match '(?i)Private DNS|validat|family\.cloudflare-dns\.com') {
                $tokens = @([regex]::Matches($line, '(?i)\b(?:Private DNS|family\.cloudflare-dns\.com|strict|opportunistic|off|validated|validation|validating|success|succeeded|fail|failed|failure|in_process|unknown|true|false)\b') | ForEach-Object { $_.Value })
                if ($tokens.Count) { $parts.Add('Resolver tokens (context omitted): ' + ($tokens -join ' ')) }
            }
        }
        elseif ($Name -in @('model', 'android', 'api', 'patch')) {
            $patterns = @{ model = '^SM[-_]A566B$'; android = '^\d{1,2}(?:\.\d{1,2}){0,2}$';
                api = '^\d{1,3}$'; patch = '^\d{4}-\d{2}-\d{2}$' }
            if ($line.Trim() -match $patterns[$Name]) { $parts.Add($Name + ': ' + $line.Trim()) }
        }
        elseif ($Name -eq 'mode' -and $line.Trim() -match '^(off|opportunistic|hostname|null)$') {
            $parts.Add('private_dns_mode: ' + $line.Trim())
        }
        elseif ($Name -eq 'hostname') {
            $value = $line.Trim()
            $address = $null
            if ($value -and $value -match '^[a-zA-Z0-9._-]+$' -and -not [Net.IPAddress]::TryParse($value, [ref]$address)) {
                $parts.Add('private_dns_specifier: ' + $value)
            }
        }
        elseif ($Name -eq 'version' -and $line -match '^Android Debug Bridge version [0-9.]+$') {
            $parts.Add($line)
        }
        if ($parts.Count) { $result.Add(('L{0}: {1}' -f $lineNumber, ($parts -join '; '))) }
    }
    if ($result.Count -eq 2) { $result.Add('NO RECOGNIZED FIELDS. Inspect raw locally; absence here proves nothing.') }
    $result.Add('SSID/BSSID/MAC/IP/serial/account/interface/subscriber fields and all unlisted text omitted.')
    return $result -join "`r`n"
}

function New-A8EvidenceDirectory {
    param([string]$Root, [string]$Row, [string]$Run, [string]$Network)
    if ($Row -notmatch '\AV(?:[0-9]|1[0-3])(?:-[A-Z0-9]+)*\z' -or $Run -notmatch '\A[123]\z' -or
        $Network -notin @('WIFI', 'CELL', 'IPV6', 'P853', 'CPORTAL')) { throw 'Invalid evidence label.' }
    if (-not $Root) { throw 'An external evidence directory is required.' }
    $full = [IO.Path]::GetFullPath($Root)
    $now = [DateTimeOffset]::UtcNow
    $base = Join-Path (Join-Path $full $now.ToString('yyyyMMdd')) $Row
    # Reject symlinks/junctions and every Git worktree, even if the caller gives an alias path.
    $ancestor = $base
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            $item = Get-Item -LiteralPath $ancestor -Force
            if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw 'Evidence directory must use real directories, without symlinks or junctions.'
            }
            if (Test-Path -LiteralPath (Join-Path $ancestor '.git')) { throw 'Raw evidence must be outside every Git worktree.' }
        }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
    $prefix = 'A8_{0}_R{1}_{2}_{3}' -f $Row, $Run, $Network, $now.ToString('yyyyMMdd-HHmmss')
    $session = Join-Path $base ($prefix + '_' + [Guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory((Join-Path $session 'raw'))
    [void][IO.Directory]::CreateDirectory((Join-Path $session 'review'))
    [pscustomobject]@{ Path = $session; Prefix = $prefix }
}

function Save-A8Capture {
    param($Capture, $Session, [string]$Label)
    if ($Label -notmatch '\A[a-z0-9-]+\z') { throw 'Invalid capture file label.' }
    $stem = $Session.Prefix + '_' + $Label
    $status = Get-A8SourceStatus $Capture
    $metadata = [ordered]@{ Command = $Capture.Command; StartedUtc = $Capture.StartedUtc
        EndedUtc = $Capture.EndedUtc; ExitCode = $Capture.ExitCode; TimedOut = $Capture.TimedOut
        CollectionStatus = $status; Classification = 'Human/runbook only; not assigned' }
    foreach ($stream in @('stdout', 'stderr')) {
        $file = $stem + '.' + $stream + '.txt'
        $rawPath = Join-Path (Join-Path $Session.Path 'raw') $file
        # CreateNew, rather than overwriting existing evidence, including partial sessions.
        $handle = [IO.File]::Open($rawPath, [IO.FileMode]::CreateNew)
        try { $bytes = $Capture.($stream + 'Bytes'); $handle.Write($bytes, 0, $bytes.Length) }
        finally { $handle.Dispose() }
        $metadata[$stream + 'Sha256'] = (Get-FileHash -LiteralPath $rawPath -Algorithm SHA256).Hash
        $review = ConvertTo-A8ReviewText -Text $Capture.$stream -Name $Capture.Name
        $review = "CollectionStatus: $status`r`n$review"
        Set-Content -LiteralPath (Join-Path (Join-Path $Session.Path 'review') $file) -Value $review -Encoding UTF8
    }
    $json = $metadata | ConvertTo-Json
    foreach ($folder in @('raw', 'review')) {
        Set-Content -LiteralPath (Join-Path (Join-Path $Session.Path $folder) ($stem + '.json')) -Value $json -Encoding UTF8
    }
    return $status
}

function Invoke-A8Collection {
    param([string]$AdbPath, $Target, $InventoryCapture, $Session,
        [ValidateRange(1, 120)][int]$TimeoutSeconds = 30)
    [void](Save-A8Capture $InventoryCapture $Session 'targets')
    $parameters = @{ AdbPath = $AdbPath; TransportId = $Target.TransportId; TimeoutSeconds = $TimeoutSeconds }
    # Each evidence read is preceded by identity checks; no reconnect, fallback transport or retry.
    $index = 0
    foreach ($name in @('version', 'android', 'api', 'patch', 'mode', 'hostname', 'connectivity', 'dnsresolver')) {
        $index++
        $inventory = Invoke-A8Read -AdbPath $AdbPath -Name devices -TimeoutSeconds $TimeoutSeconds
        [void](Save-A8Capture $inventory $Session ('identity-{0}-targets' -f $index))
        if ((Get-A8SourceStatus $inventory) -ne 'OutputCaptured') { throw 'Target inventory unavailable; collection stopped without retry.' }
        $parsed = ConvertFrom-A8Devices $inventory.Stdout
        if ($parsed.UnparsedLines -gt 0) { throw 'Target inventory malformed; collection stopped without guessing.' }
        $current = Select-A8Target $parsed.Targets $Target.TransportId
        if ($current.Serial -cne $Target.Serial) { throw 'Transport identity changed; collection stopped. Select again explicitly.' }
        $model = Invoke-A8Read @parameters -Name model
        [void](Save-A8Capture $model $Session ('identity-{0}-model' -f $index))
        if ((Get-A8SourceStatus $model) -ne 'OutputCaptured' -or $model.Stdout.Trim() -cne 'SM-A566B') {
            throw 'Selected target did not report the required SM-A566B model. Collection stopped.'
        }
        $capture = Invoke-A8Read @parameters -Name $name
        $label = $name
        if ($name -eq 'connectivity') { $label = 'dumpsys-conn' }
        if ($name -eq 'dnsresolver') { $label = 'dumpsys-dnsres' }
        $status = Save-A8Capture $capture $Session $label
        Write-Host ('{0}: {1}' -f $name, $status)
        if ($status -eq 'ServiceUnavailable') { Write-Warning "$name service unavailable. No replacement evidence source or retry was attempted." }
    }
}

Export-ModuleMember -Function Resolve-A8Adb, ConvertFrom-A8Devices, Select-A8Target, Get-A8CommandArguments,
    Invoke-A8Read, Get-A8SourceStatus, ConvertTo-A8ReviewText, New-A8EvidenceDirectory, Save-A8Capture, Invoke-A8Collection

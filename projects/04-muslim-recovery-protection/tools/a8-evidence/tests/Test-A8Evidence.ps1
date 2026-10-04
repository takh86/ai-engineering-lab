#Requires -Version 5.1
# SYNTHETIC TOOL TESTS ONLY. Never connect to adb/a device or interpret these as V-row evidence.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Write-Host 'SYNTHETIC TOOL TESTS ONLY - no phone, V-row evidence or architecture verification.'
$toolRoot = Split-Path $PSScriptRoot -Parent
$modulePath = Join-Path $toolRoot 'A8Evidence.psm1'
Import-Module $modulePath -Force
$script:checks = 0
function Assert-ToolTest([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "TOOL TEST: $Message" }
    $script:checks++
}
function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $caught = $false
    try { & $Action | Out-Null } catch { $caught = $true }
    Assert-ToolTest $caught $Message
}
function New-FixtureCapture([string]$Name, [string]$Output, [string]$ErrorText = '', [int]$Code = 0, [bool]$Timeout = $false) {
    [pscustomobject]@{
        Name = $Name; Command = 'synthetic-tool-test-only'; Stdout = $Output; Stderr = $ErrorText
        StdoutBytes = [Text.Encoding]::UTF8.GetBytes($Output); StderrBytes = [Text.Encoding]::UTF8.GetBytes($ErrorText)
        ExitCode = $Code; TimedOut = $Timeout
        StartedUtc = '2026-01-01T00:00:00.0000000+00:00'; EndedUtc = '2026-01-01T00:00:01.0000000+00:00'
    }
}
$fixtureRoot = Join-Path $PSScriptRoot 'fixtures'
$devices = Get-Content -LiteralPath (Join-Path $fixtureRoot 'devices.txt') -Raw
$devicesSpaced = Get-Content -LiteralPath (Join-Path $fixtureRoot 'devices-spaced.txt') -Raw
$samsungLine = (Get-Content -LiteralPath (Join-Path $fixtureRoot 'connectivity-samsung-line.txt') -Raw).Trim()
$connectivity = Get-Content -LiteralPath (Join-Path $fixtureRoot 'connectivity.txt') -Raw
$resolver = Get-Content -LiteralPath (Join-Path $fixtureRoot 'dnsresolver.txt') -Raw
$missing = Get-Content -LiteralPath (Join-Path $fixtureRoot 'missing-service.txt') -Raw
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('a8-SYNTHETIC-tool-tests-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($tempRoot)
try {
    # Exercise real native stream handling with a harmless HOST utility, never an adb.
    # where.exe searches for a filename; /bin/echo echoes it. Neither contacts a device.
    $hostUtility = '/bin/echo'
    if ($env:OS -eq 'Windows_NT') { $hostUtility = Join-Path $env:SystemRoot 'System32\where.exe' }
    $native = @(Invoke-A8Read -AdbPath $hostUtility -Name version)
    Assert-ToolTest ($native.Count -eq 1) 'Native async waits must not emit extra pipeline objects.'
    Assert-ToolTest ($native[0].Stdout -ceq [Text.Encoding]::UTF8.GetString($native[0].StdoutBytes)) 'Native stdout bytes and decoded text agree.'
    Assert-ToolTest ($native[0].Stderr -ceq [Text.Encoding]::UTF8.GetString($native[0].StderrBytes)) 'Native stderr bytes and decoded text agree.'
    Assert-ToolTest ([DateTimeOffset]::Parse($native[0].EndedUtc) -ge [DateTimeOffset]::Parse($native[0].StartedUtc)) 'Native timestamps are ordered.'
    $inventory = ConvertFrom-A8Devices $devices
    $spaced = ConvertFrom-A8Devices $devicesSpaced
    Assert-ToolTest ($spaced.Targets.Count -eq 2 -and $spaced.UnparsedLines -eq 0) 'Spaced mDNS duplicate suffix is parsed; both transports preserved.'
    Assert-ToolTest ((@($spaced.Targets.TransportId) -join ',') -ceq '2,3' -and $spaced.Targets[1].Connection -eq 'Network transport') 'Spaced duplicate keeps its own transport ID.'
    Assert-Throws { Select-A8Target $spaced.Targets '' } 'Spaced duplicates still require explicit selection.'
    Assert-ToolTest ((ConvertFrom-A8Devices 'adb-X (2)._adb-tls-connect._tcp bogus transport_id:9').UnparsedLines -eq 1) 'Unknown state with a spaced name stays unparsed.'
    Assert-ToolTest ($inventory.Targets.Count -eq 5 -and $inventory.UnparsedLines -eq 0) 'Preserve every transport; no deduplication.'
    Assert-ToolTest (@($inventory.Targets | Where-Object Model -eq 'SM_A566B').Count -eq 3) 'Keep duplicate Samsung entries.'
    Assert-Throws { Select-A8Target $inventory.Targets '' } 'Duplicates must require an explicit choice.'
    Assert-Throws { Select-A8Target @($inventory.Targets[0]) '' } 'Even one device requires a choice.'
    Assert-ToolTest ((Select-A8Target $inventory.Targets '2').Connection -eq 'Network transport') 'Select exact network transport.'
    Assert-ToolTest ((Select-A8Target $inventory.Targets '3').Connection -eq 'Network transport') 'Identify mDNS network transport.'
    foreach ($bad in @('4', '5', '99', '1;reboot', '-d', '0')) {
        Assert-Throws { Select-A8Target $inventory.Targets $bad } 'Reject unavailable/invalid selection.'
    }
    Assert-Throws { Select-A8Target @($inventory.Targets[0], $inventory.Targets[0]) '1' } 'Reject duplicate transport IDs.'
    Assert-ToolTest ((ConvertFrom-A8Devices '').Targets.Count -eq 0) 'Empty inventory.'
    Assert-ToolTest ((ConvertFrom-A8Devices 'gibberish').UnparsedLines -eq 1) 'Malformed inventory is explicit.'
    Assert-Throws { Select-A8Target (ConvertFrom-A8Devices 'synthetic device model:SM_A566B').Targets '1' } 'Missing transport ID never guessed.'

    $redacted = ConvertTo-A8ReviewText $connectivity 'connectivity'
    foreach ($secret in @('Synthetic Home WiFi', 'quoted', '02:00:5e:10:00:01', '02-00-5e-10-00-02',
            '0200.5e10.0003', '192.0.2.', '2001:', '2001:DB8', 'fe80::', '::ffff:', 'wlan0', '001010123456789',
            '123456789012345', '8901000000000000001', 'SYNTHETIC_USB', 'fixture@example.test', '+15550123456')) {
        Assert-ToolTest (-not $redacted.Contains($secret)) "Remove synthetic identifier: $secret"
    }
    foreach ($required in @('Active default network: 100', 'network{100}', 'type: WIFI', 'type: MOBILE',
            'UsePrivateDns: true', 'UsePrivateDns: false', 'PrivateDnsServerName: family.cloudflare-dns.com',
            'ValidatedPrivateDnsAddresses: [empty]', 'ValidatedPrivateDnsAddresses: [present; contents redacted]')) {
        Assert-ToolTest ($redacted.Contains($required)) "Preserve source semantic: $required"
    }
    Assert-ToolTest ($redacted -match 'L\d+:') 'Extracts have raw line references.'
    Assert-ToolTest ($redacted -match 'address-family tokens: IPv4, IPv6') 'Preserve address-family hints without addresses.'
    Assert-ToolTest (-not (ConvertTo-A8ReviewText 'SSID: "PrivateDnsServerName: secret.example"' 'connectivity').Contains('secret.example')) 'Quoted SSID cannot impersonate a field.'
    $spoofedSsid = ConvertTo-A8ReviewText 'SSID: Home PrivateDnsServerName: secret-ssid.example UsePrivateDns: true' 'connectivity'
    Assert-ToolTest ($spoofedSsid -notmatch 'secret-ssid\.example|UsePrivateDns: true') 'Unquoted SSID cannot impersonate a Private DNS field.'
    Assert-ToolTest ($spoofedSsid -match 'identity values removed') 'Removed identity values are flagged for local raw review.'
    $mixedSubscriber = ConvertTo-A8ReviewText 'subscriberId=001010123456789 PrivateDnsServerName: dns.example' 'connectivity'
    Assert-ToolTest ($mixedSubscriber -notmatch '001010123456789' -and $mixedSubscriber -match 'PrivateDnsServerName: dns\.example') 'Single-token identity values are removed; adjacent Private DNS field is kept.'
    $samsung = ConvertTo-A8ReviewText $samsungLine 'connectivity'
    Assert-ToolTest ($samsung -notmatch 'Synthetic Home|02:00:5e|12345|192\.0\.2|2001:db8|wlan0') 'Samsung-shaped single line: identifiers and addresses absent.'
    foreach ($required in @('UsePrivateDns: true', 'PrivateDnsServerName: family.cloudflare-dns.com', 'ValidatedPrivateDnsAddresses: [present; contents redacted]')) {
        Assert-ToolTest ($samsung.Contains($required)) "Samsung-shaped single line keeps: $required"
    }
    $samsungEmpty = ConvertTo-A8ReviewText ($samsungLine -replace 'ValidatedPrivateDnsAddresses: \[[^\]]*\]', 'ValidatedPrivateDnsAddresses: []') 'connectivity'
    Assert-ToolTest ($samsungEmpty.Contains('ValidatedPrivateDnsAddresses: [empty]')) 'Samsung-shaped single line keeps emptiness of validated addresses.'
    $commaSsid = ConvertTo-A8ReviewText 'SSID: Home, PrivateDnsServerName: spoof.example] UsePrivateDns: false' 'connectivity'
    Assert-ToolTest ($commaSsid -notmatch 'spoof\.example|UsePrivateDns') 'Unquoted SSID containing delimiters cannot inject a field.'
    $dupInject = ConvertTo-A8ReviewText ($samsungLine -replace 'SSID: "Synthetic Home WiFi"', 'SSID: "x", PrivateDnsServerName: fake.example, ""') 'connectivity'
    Assert-ToolTest ($dupInject -notmatch 'fake\.example|family\.cloudflare-dns\.com' -and $dupInject -match 'AMBIGUOUS: PrivateDnsServerName x2') 'Quote-breaking network name that duplicates a field is withheld as ambiguous.'
    Assert-ToolTest ($samsung -match 'UNVERIFIED' -and (ConvertTo-A8ReviewText 'LinkProperties{ UsePrivateDns: true PrivateDnsServerName: a.example }' 'connectivity') -notmatch 'UNVERIFIED') 'Lines with a network name are labelled unverified; clean lines are not.'
    $samsungSpoof = ConvertTo-A8ReviewText ($samsungLine -replace 'SSID: "Synthetic Home WiFi"', 'SSID: Evil PrivateDnsServerName: spoof.example UsePrivateDns: false') 'connectivity'
    Assert-ToolTest ($samsungSpoof -notmatch 'spoof\.example') 'Unquoted SSID on a Samsung-shaped line cannot inject a field.'
    $resolverReview = ConvertTo-A8ReviewText $resolver 'dnsresolver'
    Assert-ToolTest ($resolverReview -match 'NetId: 100' -and $resolverReview -match 'success' -and $resolverReview -match 'validated') 'Preserve resolver context fragments.'
    Assert-ToolTest ($resolverReview -notmatch '192\.0\.2|2001:|fixture\.private') 'Remove resolver IPs and search suffix.'
    foreach ($inputText in @('', 'garbage SSID home 192.0.2.1', 'ValidatedPrivateDnsAddresses: [unterminated')) {
        Assert-ToolTest ((ConvertTo-A8ReviewText $inputText 'connectivity') -match 'NO RECOGNIZED FIELDS') 'Empty/malformed input is not manufactured evidence.'
    }
    foreach ($ip in @('192.0.2.1', '2001:db8::1', '[2001:db8::1]', '::ffff:192.0.2.1')) {
        Assert-ToolTest (-not (ConvertTo-A8ReviewText "PrivateDnsServerName: $ip" 'connectivity').Contains($ip)) 'Redact IP-valued hostname.'
    }
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'dnsresolver' $missing)) -eq 'ServiceUnavailable') 'Missing service on stdout, even with zero exit code.'
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'dnsresolver' '' $missing 1)) -eq 'ServiceUnavailable') 'Missing service on stderr.'
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'connectivity' '' 'Permission Denial: denied')) -eq 'PermissionDenied') 'Permission denial.'
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'connectivity' '')) -eq 'EmptyOutput') 'Empty source.'
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'connectivity' 'partial' '' 1 $true)) -eq 'TimedOut') 'Partial timeout.'
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'connectivity' '' 'error: device offline' 1)) -eq 'CommandError') 'Offline command error.'
    Assert-ToolTest ((Get-A8SourceStatus (New-FixtureCapture 'connectivity' 'gibberish')) -eq 'OutputCaptured') 'Captured output is not interpreted as a V-row result.'

    $expectedCommands = @{
        devices = 'devices -l'; version = 'version'; model = '-t 2 shell getprop ro.product.model'
        android = '-t 2 shell getprop ro.build.version.release'; api = '-t 2 shell getprop ro.build.version.sdk'
        patch = '-t 2 shell getprop ro.build.version.security_patch'
        mode = '-t 2 shell settings get global private_dns_mode'; hostname = '-t 2 shell settings get global private_dns_specifier'
        connectivity = '-t 2 shell dumpsys connectivity'; dnsresolver = '-t 2 shell dumpsys dnsresolver'
    }
    foreach ($key in $expectedCommands.Keys) {
        Assert-ToolTest (((Get-A8CommandArguments $key '2') -join ' ') -ceq $expectedCommands[$key]) 'Exact read-only command catalogue.'
    }
    $catalogueTokens = $null; $catalogueErrors = $null
    $catalogueAst = [Management.Automation.Language.Parser]::ParseFile($modulePath, [ref]$catalogueTokens, [ref]$catalogueErrors)
    $catalogueFunction = $catalogueAst.Find({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-A8CommandArguments'
    }, $true)
    $catalogue = $catalogueFunction.Body.Find({ param($node) $node -is [Management.Automation.Language.HashtableAst] }, $true)
    $catalogueKeys = @($catalogue.KeyValuePairs | ForEach-Object { $_.Item1.Value } | Sort-Object)
    Assert-ToolTest (($catalogueKeys -join ',') -ceq (($expectedCommands.Keys | Sort-Object) -join ',')) 'No untested commands added to the catalogue.'
    foreach ($name in @('reboot', 'settings', 'shell', 'install', 'connect', 'connectivity; reboot')) {
        Assert-Throws { Get-A8CommandArguments $name '2' } 'Reject all non-catalogue commands.'
    }
    Assert-Throws { Get-A8CommandArguments 'connectivity' '2; reboot' } 'Reject argument injection.'
    Assert-Throws { Get-A8CommandArguments 'connectivity' "2`n" } 'Reject newline in transport ID.'
    Assert-Throws { Get-A8CommandArguments 'connectivity' '' } 'No unaddressed device command.'
    foreach ($file in @($modulePath, (Join-Path $toolRoot 'Collect-A8Evidence.ps1'))) {
        $tokens = $null; $errors = $null
        $ast = [Management.Automation.Language.Parser]::ParseFile($file, [ref]$tokens, [ref]$errors)
        Assert-ToolTest ($errors.Count -eq 0) 'PowerShell parser accepts production file.'
        $code = (($tokens | Where-Object Kind -ne Comment | ForEach-Object Text) -join ' ')
        Assert-ToolTest ($code -notmatch '(?i)\b(?:reboot|force-stop|setprop|tcpip|reconnect|install|uninstall|Invoke-Expression|Start-Process)\b|settings[\s\x27",]+(?:put|delete)|pm[\s\x27",]+clear') 'No mutating command or extra native command launcher in production tokens.'
        $dynamic = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.InvocationOperator -eq 'Ampersand' }, $true))
        Assert-ToolTest ($dynamic.Count -eq 0) 'No dynamic command invocation bypass.'
    }

    $session = New-A8EvidenceDirectory $tempRoot 'V1-CELL' '1' 'CELL'
    $next = New-A8EvidenceDirectory $tempRoot 'V1-CELL' '1' 'CELL'
    Assert-ToolTest ($session.Path -ne $next.Path) 'Every invocation gets a unique directory.'
    Assert-Throws { New-A8EvidenceDirectory $toolRoot 'V1' '1' 'CELL' } 'Reject evidence inside Git.'
    Assert-Throws { New-A8EvidenceDirectory $tempRoot '../escape' '1' 'CELL' } 'Reject path injection in row label.'
    $nested = Join-Path $tempRoot 'nested'
    $gitMarker = Join-Path (Join-Path (Join-Path $nested ([DateTimeOffset]::UtcNow.ToString('yyyyMMdd'))) 'V1') '.git'
    [void][IO.Directory]::CreateDirectory($gitMarker)
    Assert-Throws { New-A8EvidenceDirectory $nested 'V1' '1' 'WIFI' } 'Check dated subdirectory ancestry, not just the root.'
    # SDK discovery is tested with an inert file that is never executed.
    $oldLocal = $env:LOCALAPPDATA
    try {
        $env:LOCALAPPDATA = Join-Path $tempRoot 'fake local app data'
        $fakeAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
        [void][IO.Directory]::CreateDirectory((Split-Path $fakeAdb -Parent))
        [IO.File]::WriteAllText($fakeAdb, 'SYNTHETIC inert file; never executable')
        Assert-ToolTest ((Resolve-A8Adb) -eq $fakeAdb) 'Discover known SDK location with spaces, without PATH.'
        Assert-ToolTest ((Resolve-A8Adb $fakeAdb) -eq $fakeAdb) 'Explicit adb path.'
        Assert-Throws { Resolve-A8Adb (Join-Path $tempRoot 'missing.exe') } 'Invalid explicit path does not silently fall back.'
    }
    finally { $env:LOCALAPPDATA = $oldLocal }
    $capture = New-FixtureCapture 'connectivity' $connectivity
    [void](Save-A8Capture $capture $session 'dumpsys-conn')
    $raw = @(Get-ChildItem -LiteralPath (Join-Path $session.Path 'raw') -Filter '*.stdout.txt')[0]
    Assert-ToolTest ([IO.File]::ReadAllText($raw.FullName) -ceq $connectivity) 'Raw bytes kept as captured.'
    $metadata = Get-Content -LiteralPath (Join-Path (Join-Path $session.Path 'review') ($session.Prefix + '_dumpsys-conn.json')) -Raw | ConvertFrom-Json
    Assert-ToolTest ($metadata.stdoutSha256 -eq (Get-FileHash -LiteralPath $raw.FullName).Hash) 'Hash binds extract to raw stream.'
    Assert-Throws { Save-A8Capture $capture $session 'dumpsys-conn' } 'Existing raw evidence cannot be overwritten.'
    [void](Save-A8Capture (New-FixtureCapture 'dnsresolver' '' $missing) $session 'dumpsys-dnsres')
    $review = Get-Content -LiteralPath (Join-Path (Join-Path $session.Path 'review') ($session.Prefix + '_dumpsys-dnsres.stderr.txt')) -Raw
    Assert-ToolTest ($review.Contains('ServiceUnavailable')) 'Unavailable service explicit in saved review.'

    # Mock the sole native boundary inside the module. No installed adb can be invoked below.
    $module = Get-Module A8Evidence
    & $module {
        param($DeviceText, $ConnectivityText, $MissingText)
        $script:testDeviceText = $DeviceText; $script:testConnectivityText = $ConnectivityText
        $script:testMissingText = $MissingText; $script:testModel = 'SM-A566B'; $script:testCalls = @()
        function script:Invoke-A8Read {
            param($AdbPath, $Name, $TransportId, $TimeoutSeconds)
            $script:testCalls += "$Name/$TransportId"
            $output = switch ($Name) {
                devices { $script:testDeviceText }; model { $script:testModel }
                connectivity { $script:testConnectivityText }; dnsresolver { $script:testMissingText }
                default { 'synthetic tool output' }
            }
            [pscustomobject]@{ Name = $Name; Command = 'synthetic-tool-test-only'; Stdout = $output; Stderr = ''
                StdoutBytes = [Text.Encoding]::UTF8.GetBytes($output); StderrBytes = [byte[]]@()
                ExitCode = 0; TimedOut = $false; StartedUtc = 'synthetic'; EndedUtc = 'synthetic' }
        }
    } $devices $connectivity $missing
    $target = Select-A8Target $inventory.Targets '1'
    $collection = New-A8EvidenceDirectory $tempRoot 'V1-CELL' '1' 'CELL'
    Invoke-A8Collection 'UNUSED-NO-ADB' $target (New-FixtureCapture 'devices' $devices) $collection
    $calls = @(& $module { $script:testCalls })
    Assert-ToolTest (@($calls | Where-Object { $_ -eq 'connectivity/1' }).Count -eq 1) 'Exactly one connectivity attempt.'
    Assert-ToolTest (@($calls | Where-Object { $_ -eq 'dnsresolver/1' }).Count -eq 1) 'Missing dnsresolver is not retried or substituted.'
    Assert-ToolTest (@($calls | Where-Object { $_ -notmatch '^(devices/|(?:model|version|android|api|patch|mode|hostname|connectivity|dnsresolver)/1)$' }).Count -eq 0) 'Every device read stays on the explicit transport.'
    & $module { $script:testModel = 'OTHER'; $script:testCalls = @() }
    $wrong = New-A8EvidenceDirectory $tempRoot 'V1' '1' 'WIFI'
    Assert-Throws { Invoke-A8Collection 'UNUSED' $target (New-FixtureCapture 'devices' $devices) $wrong } 'Wrong model prevents collection.'
    Assert-ToolTest (@(& $module { $script:testCalls } | Where-Object { $_ -match 'connectivity|dnsresolver' }).Count -eq 0) 'No dumpsys on wrong model.'
    & $module { $script:testModel = 'SM-A566B'; $script:testDeviceText = $script:testDeviceText.Replace('SYNTHETIC_USB', 'DIFFERENT_SERIAL') }
    $changed = New-A8EvidenceDirectory $tempRoot 'V1' '1' 'WIFI'
    Assert-Throws { Invoke-A8Collection 'UNUSED' $target (New-FixtureCapture 'devices' $devices) $changed } 'Changed transport identity stops collection.'
    Write-Host "TOOL TESTS ONLY: $script:checks assertions completed; no device evidence collected."
}
finally {
    Remove-Module A8Evidence -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

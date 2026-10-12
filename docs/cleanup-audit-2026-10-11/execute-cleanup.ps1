param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath('C:\Projects\traffic-jam-game')
$reportPath = Join-Path $workspacePath 'docs\cleanup-audit-2026-10-11'
$approved = (Get-Content -LiteralPath (Join-Path $reportPath 'cleanup-summary.json') -Raw | ConvertFrom-Json).plans | Where-Object { $_.tier -in @('A','B') }
$allowed = @('.browser-checks','.npm-cache','docs','art','scripts')
function Assert-Contained([string]$candidate) {
    $absolute = [IO.Path]::GetFullPath($candidate)
    if (-not $absolute.StartsWith($workspacePath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $absolute" }
    $relative = [IO.Path]::GetRelativePath($workspacePath,$absolute).Replace('\','/')
    if ($relative.Split('/')[0] -notin $allowed -or $relative.StartsWith('docs/cleanup-audit-2026-10-11/')) { throw "Protected target: $relative" }
    $ancestor = $absolute
    while ($ancestor -ne $workspacePath) {
        if (Test-Path -LiteralPath $ancestor) {
            if ((Get-Item -Force -LiteralPath $ancestor).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point: $ancestor" }
        }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
    return $absolute
}
function Get-SafeFiles([string]$directory) {
    foreach ($item in Get-ChildItem -Force -LiteralPath $directory) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Unexpected link in approved target: $($item.FullName)" }
        if ($item.PSIsContainer) { Get-SafeFiles $item.FullName } else { $item }
    }
}
$liveProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and $_.Name -match '^(chrome|msedge|node|npm|blender|python|ffmpeg)(\.exe)?$' -and
    ($_.CommandLine -like '*.browser-checks*' -or $_.CommandLine -match 'npm-cli.*(ci|install)|npm-cache')
})
if ($liveProcesses.Count) { throw "Approved cache is in use by process IDs: $($liveProcesses.ProcessId -join ',')" }
$validated = @()
foreach ($entry in $approved) {
    $target = Assert-Contained (Join-Path $workspacePath $entry.path)
    if (-not (Test-Path -LiteralPath $target)) { throw "Approved target missing before execution: $($entry.path)" }
    $item = Get-Item -Force -LiteralPath $target
    $targetFiles = if ($item.PSIsContainer) { @(Get-SafeFiles $target) } else { @($item) }
    $bytes = [long](($targetFiles | Measure-Object -Property Length -Sum).Sum)
    $expectedFiles = if ($null -ne $entry.files) { [long]$entry.files } else { 1 }
    if ($bytes -ne [long]$entry.bytes -or $targetFiles.Count -ne $expectedFiles) { throw "Target changed since approved audit: $($entry.path) (files $($targetFiles.Count)/$expectedFiles; bytes $bytes/$($entry.bytes))" }
    $validated += [pscustomobject]@{ path=$entry.path; absolute=$target; directory=$item.PSIsContainer; files=$targetFiles.Count; bytes=$bytes }
}
$preflight = [pscustomobject]@{ timestamp=(Get-Date).ToUniversalTime().ToString('o'); workspace=$workspacePath; targets=$validated.Count; files=[long](($validated | Measure-Object files -Sum).Sum); bytes=[long](($validated | Measure-Object bytes -Sum).Sum); usingTargetProcesses=$liveProcesses.Count; validated=$validated }
$preflight | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reportPath 'execution-preflight.json') -Encoding utf8
Write-Output "Validated $($preflight.targets) exact targets, $($preflight.files) files, $($preflight.bytes) bytes; no links or active target processes."
if (-not $Apply) { return }
$completed = [Collections.Generic.List[object]]::new()
try {
    foreach ($target in $validated) {
        # Every target and its descendants were checked above; never follow links.
        $absolute = Assert-Contained $target.absolute
        if ($target.directory) { Remove-Item -LiteralPath $absolute -Recurse -Force } else { Remove-Item -LiteralPath $absolute -Force }
        $completed.Add([pscustomobject]@{path=$target.path;files=$target.files;bytes=$target.bytes})
        if ($completed.Count % 300 -eq 0) { Write-Output "Removed $($completed.Count)/$($validated.Count) approved targets." }
    }
} finally {
    [pscustomobject]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');targets=$completed.Count;files=[long](($completed|Measure-Object files -Sum).Sum);bytes=[long](($completed|Measure-Object bytes -Sum).Sum);completed=$completed} |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reportPath 'execution-result.json') -Encoding utf8
}
Write-Output "Completed: $($completed.Count) approved targets removed."

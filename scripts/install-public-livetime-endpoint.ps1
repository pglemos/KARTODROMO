param(
  [string]$TaskName = "LiveTime Public Endpoint",
  [int]$DelaySeconds = 15,
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartScript = Join-Path $PSScriptRoot "start-public-livetime-endpoint.ps1"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $StartScript)) {
  throw "Startup wrapper not found: $StartScript"
}

if (-not (Test-Path $PowerShellExe)) {
  throw "PowerShell executable not found: $PowerShellExe"
}

if (-not (Get-NetFirewallRule -DisplayName "LiveTime Public Endpoint 4010" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule `
    -DisplayName "LiveTime Public Endpoint 4010" `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 4010 `
    -Profile Any | Out-Null
}

$taskRun = "`"$PowerShellExe`" -NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -DelaySeconds $DelaySeconds"
$action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -DelaySeconds $DelaySeconds" -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Starts the Kartodromo LiveTime scraper endpoint on TCP 4010 at Windows boot before user logon." `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

$publicIp = $null
try {
  $publicIp = Invoke-RestMethod -UseBasicParsing "https://api.ipify.org?format=text" -TimeoutSec 10
} catch {
  $publicIp = "unknown"
}

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = "At startup"
  User = "SYSTEM"
  Command = $taskRun
  FirewallRule = "LiveTime Public Endpoint 4010"
  LocalEndpoint = "http://192.168.20.13:4010"
  PublicEndpoint = "http://$publicIp`:4010"
  RepoRoot = [string]$RepoRoot
  RunNow = [bool]$RunNow
}

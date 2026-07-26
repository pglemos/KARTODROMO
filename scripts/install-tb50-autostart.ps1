param(
  [string]$TaskName = "TB50 Streaming Stack",
  [int]$DelaySeconds = 20,
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$AutostartScript = Join-Path $PSScriptRoot "start-tb50-autostart.ps1"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $AutostartScript)) {
  throw "Autostart wrapper not found: $AutostartScript"
}

if (-not (Test-Path $PowerShellExe)) {
  throw "PowerShell executable not found: $PowerShellExe"
}

$taskRun = "`"$PowerShellExe`" -NoProfile -ExecutionPolicy Bypass -File `"$AutostartScript`" -DelaySeconds $DelaySeconds"
$action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$AutostartScript`" -DelaySeconds $DelaySeconds" -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Starts the TB50 realtime streaming stack at Windows boot without requiring user logon." `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = "At startup"
  User = "SYSTEM"
  Command = $taskRun
  RepoRoot = [string]$RepoRoot
  ExecutionTimeLimit = "10 minutes"
  RunNow = [bool]$RunNow
}

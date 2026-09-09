param(
  [string]$TaskName = "Ultras Stage Live Bridge",
  [int]$DelaySeconds = 20,
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartScript = Join-Path $PSScriptRoot "start-ultras-stage-autostart.ps1"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $StartScript)) {
  throw "Startup wrapper not found: $StartScript"
}
if (-not (Test-Path $PowerShellExe)) {
  throw "PowerShell executable not found: $PowerShellExe"
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -DelaySeconds $DelaySeconds"
$action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument $arguments -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
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
  -Description "Keeps the two-race Ultras LapTime to UDK live bridge running after Windows startup." `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = "At startup"
  User = "SYSTEM"
  Command = "`"$PowerShellExe`" $arguments"
  RepoRoot = [string]$RepoRoot
  Endpoint = "http://127.0.0.1:4014/healthz"
  RunNow = [bool]$RunNow
}

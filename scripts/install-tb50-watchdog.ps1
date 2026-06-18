param(
  [string]$TaskName = "TB50 Watchdog",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$WatchdogScript = Join-Path $PSScriptRoot "watch-tb50-stack.ps1"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $WatchdogScript)) {
  throw "Watchdog script not found: $WatchdogScript"
}

if (-not (Test-Path $PowerShellExe)) {
  throw "PowerShell executable not found: $PowerShellExe"
}

$taskRun = "`"$PowerShellExe`" -NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`""

& schtasks.exe /Create `
  /TN $TaskName `
  /SC MINUTE `
  /MO 1 `
  /TR $taskRun `
  /RU SYSTEM `
  /RL HIGHEST `
  /F | Out-Host

if ($LASTEXITCODE -ne 0) {
  throw "Failed to create scheduled task '$TaskName'."
}

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable
Set-ScheduledTask -TaskName $TaskName -Settings $settings | Out-Null

if ($RunNow) {
  & schtasks.exe /Run /TN $TaskName | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Scheduled task '$TaskName' was created but did not start."
  }
}

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = "Every 1 minute"
  User = "SYSTEM"
  Command = $taskRun
  RepoRoot = [string]$RepoRoot
  ExecutionTimeLimit = "5 minutes"
  RunNow = [bool]$RunNow
}

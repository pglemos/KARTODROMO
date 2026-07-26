param(
  [string]$TaskName = "LiveTime Cloudflare Vercel Watch",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$WatchScript = Join-Path $PSScriptRoot "ensure-cloudflare-vercel.ps1"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Test-Path $WatchScript)) {
  throw "Watch script not found: $WatchScript"
}

$taskRun = "`"$PowerShellExe`" -NoProfile -ExecutionPolicy Bypass -File `"$WatchScript`""
$action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$WatchScript`"" -WorkingDirectory $RepoRoot
$triggers = @(
  (New-ScheduledTaskTrigger -AtStartup),
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10))
)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 8) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Principal $principal `
  -Settings $settings `
  -Description "Maintains the public LiveTime Cloudflare tunnel and Vercel endpoints without requiring user logon." `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = "At startup and every 10 minutes"
  User = "SYSTEM"
  Command = $taskRun
  RepoRoot = [string]$RepoRoot
  RunNow = [bool]$RunNow
}

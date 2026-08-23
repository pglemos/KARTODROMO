param(
  [string]$TaskName = 'Kartodromo TB50 Podium',
  [switch]$RunNow
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$StartupScript = Join-Path $PSScriptRoot 'start-tb50-podium-runtime.ps1'
$PowerShellExe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path -LiteralPath $StartupScript)) {
  throw "Startup script not found: $StartupScript"
}

$action = New-ScheduledTaskAction `
  -Execute $PowerShellExe `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartupScript`"" `
  -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Starts the LapTime REST bridge, TB50 podium page, and CRONOMETRAGEM program at Windows boot.' `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = 'At startup'
  User = 'SYSTEM'
  RepoRoot = [string]$RepoRoot
  RunNow = [bool]$RunNow
}

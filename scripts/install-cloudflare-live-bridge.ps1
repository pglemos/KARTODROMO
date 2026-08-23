param(
  [string]$TaskName = 'Kartodromo Cloudflare Live Bridge',
  [switch]$RunNow
)

$ErrorActionPreference = 'Stop'

$RepoRoot = [string](Resolve-Path (Join-Path $PSScriptRoot '..'))
$StartScript = Join-Path $PSScriptRoot 'start-cloudflare-live-bridge.ps1'
$PowerShellExe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path -LiteralPath $StartScript)) { throw "Startup wrapper not found: $StartScript" }

$action = New-ScheduledTaskAction `
  -Execute $PowerShellExe `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`"" `
  -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Keeps the Cloudflare LiveTime bridge and local scraper running after Windows startup.' `
  -Force | Out-Null

if ($RunNow) { Start-ScheduledTask -TaskName $TaskName }

[pscustomobject]@{
  TaskName = $TaskName
  Trigger = 'At startup'
  User = 'SYSTEM'
  RunNow = [bool]$RunNow
  StartupScript = $StartScript
}

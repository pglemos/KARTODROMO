param(
  [string]$TaskName = "LapTime Mirror",
  [int]$DelaySeconds = 20,
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartScript = Join-Path $PSScriptRoot "start-laptime-mirror-autostart.ps1"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $StartScript)) {
  throw "Startup wrapper nao encontrado: $StartScript"
}
if (-not (Test-Path $PowerShellExe)) {
  throw "PowerShell executable nao encontrado: $PowerShellExe"
}

$taskRun = "`"$PowerShellExe`" -NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -DelaySeconds $DelaySeconds"
$action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -DelaySeconds $DelaySeconds" -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
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
  -Description "Inicia o daemon de espelho do LapTime (CRONO1 -> SRVKART) no boot do Windows, sem exigir logon de usuario." `
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
  RunNow = [bool]$RunNow
}

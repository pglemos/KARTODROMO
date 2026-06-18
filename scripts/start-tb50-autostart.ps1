param(
  [int]$DelaySeconds = 20
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$LogPath = Join-Path $RuntimeDir "tb50-autostart.log"
$StartScript = Join-Path $PSScriptRoot "start-tb50-services.ps1"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-AutostartLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$timestamp] $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

try {
  Write-AutostartLog "TB50 autostart requested. DelaySeconds=$DelaySeconds RepoRoot=$RepoRoot"

  if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
  }

  if (-not (Test-Path $StartScript)) {
    throw "Start script not found: $StartScript"
  }

  Push-Location $RepoRoot
  try {
    & $StartScript *>&1 | ForEach-Object {
      Write-AutostartLog ([string]$_)
    }
  } finally {
    Pop-Location
  }

  Write-AutostartLog "TB50 autostart completed."
} catch {
  Write-AutostartLog "TB50 autostart failed: $($_.Exception.Message)"
  throw
}

param(
  [int]$DelaySeconds = 20
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$LogFile = Join-Path $RuntimeDir "ultras-stage-autostart.log"
$tsx = Join-Path $RepoRoot "node_modules\.bin\tsx.cmd"

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
if (-not (Test-Path $tsx)) {
  throw "tsx not found: $tsx"
}

if ($DelaySeconds -gt 0) {
  Start-Sleep -Seconds $DelaySeconds
}

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    Push-Location $RepoRoot
    & $tsx --env-file=".env.local" "services/ultras-stage-server.ts" *>> $LogFile
  } catch {
    Add-Content -LiteralPath $LogFile -Value "[$stamp] ultras stage crashed: $($_.Exception.Message)"
  } finally {
    Pop-Location
  }
  Start-Sleep -Seconds 10
}

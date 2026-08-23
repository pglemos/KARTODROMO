param(
  [int]$DelaySeconds = 20
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $RepoRoot ".runtime"
$LogFile = Join-Path $LogDir "udk-bridge-autostart.log"

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

Start-Sleep -Seconds $DelaySeconds

$tsx = Join-Path $RepoRoot "node_modules\.bin\tsx.cmd"
if (-not (Test-Path $tsx)) {
  throw "tsx not found: $tsx"
}

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    Push-Location $RepoRoot
    & $tsx --env-file=".env.local" "services/udk-bridge-server.ts" *>> $LogFile
    Pop-Location
  } catch {
    Add-Content -LiteralPath $LogFile -Value "[$stamp] bridge crashed: $($_.Exception.Message)"
    Pop-Location
  }
  Start-Sleep -Seconds 10
}
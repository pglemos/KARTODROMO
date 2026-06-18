param(
  [string]$PublicIp,
  [int]$Port = 4010
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not $PublicIp) {
  $PublicIp = Invoke-RestMethod -UseBasicParsing "https://api.ipify.org?format=text" -TimeoutSec 10
}

$baseEndpoint = "http://$PublicIp`:$Port"
$healthEndpoint = "$baseEndpoint/healthz"
$layoutEndpoint = "$baseEndpoint/api/telao-layout-local"
$snapshotEndpoint = "$baseEndpoint/api/livetime-snapshot"

try {
  $health = Invoke-WebRequest -UseBasicParsing $healthEndpoint -TimeoutSec 10
  if ($health.StatusCode -ne 200) {
    throw "Unexpected status code $($health.StatusCode)"
  }
} catch {
  throw "Public endpoint is not reachable at $healthEndpoint. Configure router NAT/port-forward TCP $Port -> 192.168.20.13:$Port before switching Vercel."
}

function Set-VercelProductionEnv {
  param(
    [string]$Name,
    [string]$Value
  )

  npx vercel env rm $Name production --yes | Out-Null
  $Value | npx vercel env add $Name production | Out-Null
}

Push-Location $RepoRoot
try {
  Set-VercelProductionEnv -Name "TELAO_LAYOUT_REMOTE_ENDPOINT" -Value $layoutEndpoint
  Set-VercelProductionEnv -Name "LIVETIME_SNAPSHOT_ENDPOINT" -Value $snapshotEndpoint
  npx vercel deploy --prod --yes | Out-Null

  [pscustomobject]@{
    PublicEndpoint = $baseEndpoint
    LayoutEndpoint = $layoutEndpoint
    SnapshotEndpoint = $snapshotEndpoint
    ProductionAlias = "https://kartodromo-telao-livetime.vercel.app"
  }
} finally {
  Pop-Location
}

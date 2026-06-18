param(
  [string]$Domain = "repeatable-sanora-feignedly.ngrok-free.dev"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$layoutEndpoint = "https://$Domain/api/telao-layout-local"
$snapshotEndpoint = "https://$Domain/api/livetime-snapshot"
$headers = @{ "ngrok-skip-browser-warning" = "true" }

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
  & (Join-Path $PSScriptRoot "start-livetime-ngrok.ps1") -Domain $Domain -Port 4010 -Optional | Out-Null

  $layoutCheck = Invoke-WebRequest -UseBasicParsing "$layoutEndpoint`?_ts=$(Get-Date -Format FileDateTimeUniversal)" -Headers $headers -TimeoutSec 10 | ConvertFrom-Json
  if (-not $layoutCheck.layout.id) {
    throw "Endpoint do layout nao respondeu corretamente: $layoutEndpoint"
  }

  $snapshotCheck = Invoke-WebRequest -UseBasicParsing "$snapshotEndpoint`?uid=58856059-c4fd-4626-aea7-42aefc048eec&_ts=$(Get-Date -Format FileDateTimeUniversal)" -Headers $headers -TimeoutSec 10 | ConvertFrom-Json
  if (-not $snapshotCheck.status) {
    throw "Endpoint do snapshot nao respondeu corretamente: $snapshotEndpoint"
  }

  Set-VercelProductionEnv -Name "TELAO_LAYOUT_REMOTE_ENDPOINT" -Value $layoutEndpoint
  Set-VercelProductionEnv -Name "LIVETIME_SNAPSHOT_ENDPOINT" -Value $snapshotEndpoint
  npx vercel deploy --prod --yes | Out-Null

  [pscustomobject]@{
    Domain = $Domain
    LayoutEndpoint = $layoutEndpoint
    SnapshotEndpoint = $snapshotEndpoint
    Layout = "$($layoutCheck.layout.id) $($layoutCheck.layout.columns)x$($layoutCheck.layout.rows)"
    SnapshotStatus = $snapshotCheck.status
    SnapshotDrivers = @($snapshotCheck.drivers).Count
  }
} finally {
  Pop-Location
}

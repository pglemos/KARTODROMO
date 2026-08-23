param(
  [int]$DelaySeconds = 10,
  [int]$PollSeconds = 15
)

$ErrorActionPreference = 'Stop'

$RepoRoot = [string](Resolve-Path (Join-Path $PSScriptRoot '..'))
$RuntimeDir = Join-Path $RepoRoot '.runtime'
$Cloudflared = 'C:\KartodromoLocal\cloudflared\cloudflared.exe'
$TunnelTokenFile = 'C:\KartodromoLocal\cloudflared\live-bridge.token'
$TunnelPidFile = Join-Path $RuntimeDir 'live-bridge-watchdog.pid'
$Npm = 'C:\Program Files\nodejs\npm.cmd'
$ScraperPattern = 'services/livetime-scraper-server'
$TunnelPattern = 'live-bridge.token'

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Get-ProcessByPattern([string]$pattern) {
  try {
    return @(Get-CimInstance Win32_Process | Where-Object {
      $_.CommandLine -and $_.CommandLine.Contains($pattern, [System.StringComparison]::OrdinalIgnoreCase)
    })
  } catch {
    return @()
  }
}

function Start-Scraper {
  Start-Process -FilePath $Npm -ArgumentList @('run', 'scraper') -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RuntimeDir 'scraper-watchdog.out.log') `
    -RedirectStandardError (Join-Path $RuntimeDir 'scraper-watchdog.err.log') | Out-Null
}

function Start-Tunnel {
  if (-not (Test-Path -LiteralPath $Cloudflared)) { throw "cloudflared_not_found:$Cloudflared" }
  if (-not (Test-Path -LiteralPath $TunnelTokenFile)) { throw "tunnel_token_not_found:$TunnelTokenFile" }

  $process = Start-Process -FilePath $Cloudflared `
    -ArgumentList @('tunnel', '--no-autoupdate', 'run', '--token-file', $TunnelTokenFile) `
    -WorkingDirectory (Split-Path $Cloudflared) -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $RuntimeDir 'live-bridge-watchdog.out.log') `
    -RedirectStandardError (Join-Path $RuntimeDir 'live-bridge-watchdog.err.log') -PassThru
  Set-Content -LiteralPath $TunnelPidFile -Value $process.Id -Encoding ascii
}

function Test-TunnelRunning {
  if (Test-Path -LiteralPath $TunnelPidFile) {
    $storedPid = 0
    [void][int]::TryParse((Get-Content -LiteralPath $TunnelPidFile -Raw), [ref]$storedPid)
    if ($storedPid -gt 0) {
      $process = Get-Process -Id $storedPid -ErrorAction SilentlyContinue
      if ($process -and $process.ProcessName -eq 'cloudflared') { return $true }
    }
    Remove-Item -LiteralPath $TunnelPidFile -Force -ErrorAction SilentlyContinue
  }

  $existing = Get-ProcessByPattern $TunnelPattern
  if ($existing.Count -gt 0) {
    Set-Content -LiteralPath $TunnelPidFile -Value $existing[0].ProcessId -Encoding ascii
    return $true
  }

  return $false
}

function Test-ScraperHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4010/healthz' -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }

while ($true) {
  if (-not (Test-ScraperHealth)) {
    if (-not (Get-ProcessByPattern $ScraperPattern)) { Start-Scraper }
  }

  if (-not (Test-TunnelRunning)) { Start-Tunnel }
  Start-Sleep -Seconds ([Math]::Max(5, $PollSeconds))
}

param(
  [int]$Port = 4010,
  [int]$MinDeployIntervalMinutes = 15
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$EnvPath = Join-Path $RepoRoot ".env"
$Cloudflared = Join-Path $RepoRoot ".tools\cloudflared\cloudflared.exe"
$CloudflaredVersion = "2026.6.1"
$CloudflaredSha256 = "5253e66f1f493c4e13539749f1aa86fd0c61e3072900fec29a44ba046a6d97e2"
$ProductionBaseUrl = "https://kartodromobetim.vercel.app"
$OutLog = Join-Path $RuntimeDir "cloudflared-4010.out.log"
$ErrLog = Join-Path $RuntimeDir "cloudflared-4010.err.log"
$UrlPath = Join-Path $RuntimeDir "cloudflared-4010.url"
$DeployStampPath = Join-Path $RuntimeDir "cloudflared-vercel-last-deploy.txt"
$LogPath = Join-Path $RuntimeDir "cloudflared-vercel-watch.log"
$MutexName = "Local\KartodromoCloudflareVercelWatch"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, $MutexName)
if (-not $mutex.WaitOne(0)) {
  exit 0
}

function Write-TunnelLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$timestamp] $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

function Import-DotEnvValue {
  param([string]$Name)

  if ((Test-Path "Env:$Name") -or -not (Test-Path $EnvPath)) {
    return
  }

  $line = Get-Content $EnvPath |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))=" } |
    Select-Object -First 1
  if (-not $line) {
    return
  }

  $value = ($line -split "=", 2)[1].Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$Name" -Value $value
}

function Get-CloudflaredProcess {
  Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "127\.0\.0\.1:$Port|localhost:$Port| $Port($| )" }
}

function Get-TunnelUrlFromLog {
  $log = ""
  if (Test-Path $ErrLog) {
    try { $log += Get-Content $ErrLog -Raw } catch {}
  }
  if (Test-Path $OutLog) {
    try { $log += Get-Content $OutLog -Raw } catch {}
  }

  $matches = [regex]::Matches($log, "https://[-a-z0-9]+\.trycloudflare\.com")
  if ($matches.Count -eq 0) {
    return ""
  }

  $matches[$matches.Count - 1].Value
}

function Test-PublicHealth {
  param([string]$Url)

  if (-not $Url) {
    return $false
  }

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$Url/healthz" -TimeoutSec 15
    return $response.StatusCode -eq 200
  } catch {
    try {
      $hostName = ([uri]$Url).DnsSafeHost
      $ip = Resolve-DnsName $hostName -Type A -Server 1.1.1.1 -DnsOnly -ErrorAction Stop |
        Where-Object IPAddress |
        Select-Object -First 1 -ExpandProperty IPAddress
      if (-not $ip) {
        return $false
      }

      & curl.exe --silent --show-error --fail --max-time 15 `
        --resolve "$hostName`:443:$ip" "$Url/healthz" | Out-Null
      return $LASTEXITCODE -eq 0
    } catch {
      return $false
    }
  }
}

function Install-Cloudflared {
  if (Test-Path $Cloudflared) {
    $currentHash = (Get-FileHash -Algorithm SHA256 $Cloudflared).Hash.ToLowerInvariant()
    if ($currentHash -eq $CloudflaredSha256) {
      return
    }
  }

  $cloudflaredDir = Split-Path -Parent $Cloudflared
  New-Item -ItemType Directory -Force -Path $cloudflaredDir | Out-Null
  $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/download/$CloudflaredVersion/cloudflared-windows-amd64.exe"
  $temporaryPath = "$Cloudflared.download"

  Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $temporaryPath -TimeoutSec 180
  $downloadHash = (Get-FileHash -Algorithm SHA256 $temporaryPath).Hash.ToLowerInvariant()
  if ($downloadHash -ne $CloudflaredSha256) {
    Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
    throw "cloudflared SHA256 validation failed."
  }

  Move-Item -LiteralPath $temporaryPath -Destination $Cloudflared -Force
  Write-TunnelLog "Installed cloudflared $CloudflaredVersion with verified SHA256."
}

function Start-CloudflareTunnel {
  Install-Cloudflared

  Get-CloudflaredProcess | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Remove-Item -Force $OutLog, $ErrLog -ErrorAction SilentlyContinue

  Start-Process -FilePath $Cloudflared `
    -ArgumentList @("tunnel", "--url", "http://127.0.0.1:$Port", "--no-autoupdate") `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog | Out-Null

  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    $url = Get-TunnelUrlFromLog
    if ($url -and (Test-PublicHealth -Url $url)) {
      $url | Set-Content -Path $UrlPath -Encoding ascii
      Write-TunnelLog "Cloudflare tunnel ready at $url"
      return $url
    }
  }

  throw "Cloudflare tunnel did not become healthy."
}

function Ensure-CloudflareTunnel {
  $url = ""
  if (Test-Path $UrlPath) {
    $url = (Get-Content $UrlPath -Raw).Trim()
  }

  $running = @(Get-CloudflaredProcess)
  if ($running.Count -gt 0) {
    if (Test-PublicHealth -Url $url) {
      return $url
    }

    $runningUrl = Get-TunnelUrlFromLog
    if ($runningUrl -and (Test-PublicHealth -Url $runningUrl)) {
      $runningUrl | Set-Content -Path $UrlPath -Encoding ascii
      Write-TunnelLog "Adopted running Cloudflare tunnel at $runningUrl"
      return $runningUrl
    }
  }

  Write-TunnelLog "Starting/replacing Cloudflare tunnel."
  Start-CloudflareTunnel
}

function Test-VercelUsesTunnel {
  param([string]$Url)

  try {
    $layout = Invoke-RestMethod -UseBasicParsing -Uri "$ProductionBaseUrl/api/telao-layout?_ts=$(Get-Date -Format FileDateTimeUniversal)" -TimeoutSec 20
    if ($layout.store.remoteEndpoint -ne "$Url/api/telao-layout-local") {
      return $false
    }

    $snapshot = Invoke-RestMethod -UseBasicParsing -Uri "$ProductionBaseUrl/api/livetime-snapshot?_ts=$(Get-Date -Format FileDateTimeUniversal)" -TimeoutSec 20
    return [bool]$snapshot.status -and $snapshot.message -ne "fetch failed"
  } catch {
    return $false
  }
}

function Can-DeployNow {
  if (-not (Test-Path $DeployStampPath)) {
    return $true
  }

  try {
    $last = [datetime](Get-Content $DeployStampPath -Raw)
    return ((Get-Date) - $last).TotalMinutes -ge $MinDeployIntervalMinutes
  } catch {
    return $true
  }
}

function Get-VercelTokenArgs {
  if ($env:VERCEL_TOKEN) {
    return @("--token", $env:VERCEL_TOKEN)
  }

  return @()
}

function Invoke-VercelCli {
  param(
    [string[]]$Arguments,
    [string]$InputText = $null
  )

  $safeArguments = $Arguments -join " "
  $allArguments = @("vercel") + $Arguments + (Get-VercelTokenArgs)

  if ($null -ne $InputText) {
    $output = $InputText | npx @allArguments 2>&1
  } else {
    $output = npx @allArguments 2>&1
  }
  $exitCode = $LASTEXITCODE

  $summary = ($output | ForEach-Object { "$_" }) -join " | "
  if ($summary.Length -gt 2000) {
    $summary = $summary.Substring(0, 2000) + "..."
  }
  Write-TunnelLog "vercel $safeArguments exit=$exitCode output=$summary"

  if ($exitCode -ne 0) {
    throw "Vercel command failed: vercel $safeArguments"
  }
}

function Set-VercelProductionEnv {
  param(
    [string]$Name,
    [string]$Value
  )

  Invoke-VercelCli -Arguments @("env", "rm", $Name, "production", "--yes")
  Invoke-VercelCli -Arguments @("env", "add", $Name, "production") -InputText $Value
}

function Update-VercelProduction {
  param([string]$Url)

  if (-not (Can-DeployNow)) {
    Write-TunnelLog "Vercel still not on $Url, but deploy interval has not elapsed."
    return
  }

  Write-TunnelLog "Updating Vercel production endpoints to $Url"
  Push-Location $RepoRoot
  try {
    Set-VercelProductionEnv -Name "TELAO_LAYOUT_REMOTE_ENDPOINT" -Value "$Url/api/telao-layout-local"
    Set-VercelProductionEnv -Name "LIVETIME_SNAPSHOT_ENDPOINT" -Value "$Url/api/livetime-snapshot"
    Invoke-VercelCli -Arguments @("deploy", "--prod", "--yes")
    (Get-Date).ToString("o") | Set-Content -Path $DeployStampPath -Encoding ascii
  } finally {
    Pop-Location
  }
}

try {
  Import-DotEnvValue -Name "VERCEL_TOKEN"
  $url = Ensure-CloudflareTunnel
  if (Test-VercelUsesTunnel -Url $url) {
    Write-TunnelLog "OK $url"
  } else {
    Update-VercelProduction -Url $url
  }
} catch {
  Write-TunnelLog "Failed: $($_.Exception.Message)"
  throw
} finally {
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}

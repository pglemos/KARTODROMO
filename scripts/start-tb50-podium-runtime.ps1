param(
  [int]$NextPort = 3100,
  # 4010 is already owned by the legacy/public LiveTime bridge on SRVKART.
  # Keep the TB50 runtime isolated so it can boot independently of that app.
  [int]$ScraperPort = 4011,
  [switch]$SkipViplexRepair
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$RuntimeDir = Join-Path $RepoRoot '.runtime'
$LogPath = Join-Path $RuntimeDir 'podium-autostart.log'
$StartupMarkerPath = Join-Path $RuntimeDir 'podium-starting.lock'
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-Log {
  param([string]$Message)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

function Get-NpmCmdPath {
  $programFiles = $env:ProgramFiles
  if (-not $programFiles) {
    $programFiles = 'C:\Program Files'
  }

  $candidates = @(
    (Join-Path $programFiles 'nodejs\npm.cmd'),
    'C:\Program Files\nodejs\npm.cmd',
    'C:\Users\Administrador\AppData\Roaming\npm\npm.cmd'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  $command = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw 'npm.cmd not found'
}

function Test-ListeningPort {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Test-RepoProcess {
  param([string]$Pattern)

  $repoPattern = [regex]::Escape(([string]$RepoRoot).TrimEnd('\'))
  return [bool](Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match "$repoPattern.*$Pattern" })
}

function Start-NpmProcess {
  param(
    [string[]]$Arguments,
    [string]$OutputLog,
    [string]$ErrorLog
  )

  $process = Start-Process -FilePath (Get-NpmCmdPath) `
    -ArgumentList $Arguments `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $RuntimeDir $OutputLog) `
    -RedirectStandardError (Join-Path $RuntimeDir $ErrorLog) `
    -PassThru

  Write-Log "Started npm $($Arguments -join ' ') pid=$($process.Id)"
}

function Wait-Endpoint {
  param(
    [string]$Uri,
    [int]$Attempts = 30
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return $true
      }
    } catch {
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 1200
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }

    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

try {
  Set-Location -LiteralPath $RepoRoot
  Set-Content -LiteralPath $StartupMarkerPath -Value (Get-Date -Format 'o') -Encoding utf8
  # The TB50 is using its internal HTML program. Keep the runtime off the
  # legacy HLS/FFmpeg path, which is not needed for this deployment.
  $env:VIPLEX_LIVE_PROGRAM_MODE = 'html'
  # The TB50 bundle owns its own LiveTime bridge. Explicitly inject the ports
  # into both child processes so a stale .env.local cannot route this runtime
  # back to the legacy bridge on 4010.
  $env:SCRAPER_PORT = "$ScraperPort"
  $env:LIVETIME_SNAPSHOT_ENDPOINT = "http://127.0.0.1:$ScraperPort/api/livetime-snapshot"
  Write-Log "Starting TB50 podium runtime from $RepoRoot"

  if (-not (Test-ListeningPort $NextPort) -and -not (Test-RepoProcess 'next.*start')) {
    Start-NpmProcess @('run', 'start', '--', '-p', "$NextPort", '-H', '0.0.0.0') 'next-prod.out.log' 'next-prod.err.log'
  }

  if (-not (Test-ListeningPort $ScraperPort) -and -not (Test-RepoProcess 'livetime-scraper-server')) {
    Start-NpmProcess @('run', 'scraper') 'scraper.out.log' 'scraper.err.log'
  }

  if (-not (Wait-Endpoint "http://127.0.0.1:$NextPort/podio-live-tb50")) {
    throw 'TB50 podium Next endpoint did not become ready'
  }

  if (-not (Wait-Endpoint "http://127.0.0.1:$ScraperPort/healthz")) {
    throw 'LapTime REST bridge did not become ready'
  }

  Invoke-RestMethod -Method Put `
    -Uri "http://127.0.0.1:$NextPort/api/tb50-display-mode" `
    -ContentType 'application/json' `
    -Body '{"mode":"live"}' `
    -TimeoutSec 10 | Out-Null

  if (-not $SkipViplexRepair) {
    $tb50ApiReachable = Test-TcpPort -HostName '192.168.20.253' -Port 16674
    if (-not $tb50ApiReachable) {
      Write-Log 'TB50 API indisponivel; Internal Source mantido sem alteracao'
    } else {
    try {
      $programs = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$ScraperPort/api/viplex-programs" `
        -TimeoutSec 20
      $program = @($programs.programs) |
        Where-Object { $_.name -and $_.name.Trim().ToUpperInvariant() -eq 'CRONOMETRAGEM' } |
        Sort-Object @{ Expression = { [int]$_.statusCode }; Descending = $true } |
        Select-Object -First 1

      if ($program -and $program.identifier) {
        $body = @{ identifier = $program.identifier } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Put `
          -Uri "http://127.0.0.1:$ScraperPort/api/viplex-programs" `
          -ContentType 'application/json' `
          -Body $body `
          -TimeoutSec 180 | Out-Null

        Write-Log 'TB50 CRONOMETRAGEM existente reativado'
      } else {
        $body = @{ action = 'provision-cronometragem'; name = 'CRONOMETRAGEM'; activate = $true } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Post `
          -Uri "http://127.0.0.1:$ScraperPort/api/viplex-programs" `
          -ContentType 'application/json' `
          -Body $body `
          -TimeoutSec 180 | Out-Null

        Write-Log 'TB50 CRONOMETRAGEM provisionado e ativado'
      }
    } catch {
      Write-Log "TB50 CRONOMETRAGEM repair failed; live runtime is healthy: $($_.Exception.Message)"
    }
    }
  }

  Remove-Item -LiteralPath $StartupMarkerPath -Force -ErrorAction SilentlyContinue
} catch {
  Remove-Item -LiteralPath $StartupMarkerPath -Force -ErrorAction SilentlyContinue
  Write-Log "Startup failed: $($_.Exception.Message)"
  exit 1
}

param(
  [int]$NextPort = 3100,
  # 4010 belongs to the legacy/public bridge on SRVKART; the TB50 bundle
  # monitors its isolated bridge on 4011.
  [int]$ScraperPort = 4011,
  [int]$TimeoutSec = 8,
  [switch]$SkipViplexRepair
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$RuntimeDir = Join-Path $RepoRoot '.runtime'
$LogPath = Join-Path $RuntimeDir 'tb50-podium-watchdog.log'
$StartupMarkerPath = Join-Path $RuntimeDir 'podium-starting.lock'
$MutexName = 'Local\KartodromoTB50PodiumWatchdog'

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$mutex = New-Object System.Threading.Mutex($false, $MutexName)
if (-not $mutex.WaitOne(0)) {
  exit 0
}

function Write-Log {
  param([string]$Message)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

function Get-Json {
  param([string]$Uri)
  try {
    Invoke-RestMethod -UseBasicParsing -Uri $Uri -TimeoutSec $TimeoutSec
  } catch {
    $null
  }
}

function Test-Endpoint {
  param([string]$Uri)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec $TimeoutSec
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
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

function Test-StartupInProgress {
  if (-not (Test-Path -LiteralPath $StartupMarkerPath)) {
    return $false
  }

  try {
    $ageSeconds = ((Get-Date) - (Get-Item -LiteralPath $StartupMarkerPath).LastWriteTime).TotalSeconds
    return $ageSeconds -lt 120
  } catch {
    return $false
  }
}

function Stop-ProcessPattern {
  param(
    [string]$Name,
    [string]$Pattern
  )

  Get-CimInstance Win32_Process -Filter "name = '$Name'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $Pattern } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Restart-Runtime {
  param([string]$Reason)

  Write-Log "Restarting podium runtime: $Reason"
  $repoPattern = [regex]::Escape(([string]$RepoRoot).TrimEnd('\'))
  # Never kill the legacy/public bridge on 4010. Only processes whose command
  # line belongs to this TB50 checkout may be restarted here.
  Stop-ProcessPattern -Name 'node.exe' -Pattern "$repoPattern.*(next.*start -p $NextPort|livetime-scraper-server|npm-cli\.js.*run (start|scraper))"
  Start-Sleep -Seconds 2
  & (Join-Path $PSScriptRoot 'start-tb50-podium-runtime.ps1') -NextPort $NextPort -ScraperPort $ScraperPort *>&1 |
    ForEach-Object { Write-Log ([string]$_) }
}

try {
  $nextUrl = "http://127.0.0.1:$NextPort/podio-live-tb50?_watchdog=$(Get-Date -Format FileDateTimeUniversal)"
  $healthUrl = "http://127.0.0.1:$ScraperPort/healthz"
  $snapshotUrl = "http://127.0.0.1:$ScraperPort/api/livetime-snapshot?uid=tb50&_watchdog=$(Get-Date -Format FileDateTimeUniversal)"
  $programsUrl = "http://127.0.0.1:$ScraperPort/api/viplex-programs"

  $nextOk = Test-Endpoint -Uri $nextUrl
  $health = Get-Json -Uri $healthUrl
  $snapshot = Get-Json -Uri $snapshotUrl
  $scraperOk = $null -ne $health -and $null -ne $snapshot -and @($snapshot.drivers).Count -gt 0

  $startupInProgress = Test-StartupInProgress
  if ((-not $nextOk -or -not $scraperOk) -and -not $startupInProgress) {
    Restart-Runtime -Reason "next=$nextOk scraper=$scraperOk"
  }

  if (-not $SkipViplexRepair -and (Test-TcpPort -HostName '192.168.20.253' -Port 16674)) {
    $programPayload = Get-Json -Uri $programsUrl
    if ($null -eq $programPayload) {
      Write-Log 'TB50 API indisponivel; runtime HTML mantido sem alteracao'
    } else {
      $program = @($programPayload.programs) |
        Where-Object { $_.name -and $_.name.Trim().ToUpperInvariant() -eq 'CRONOMETRAGEM' } |
        Sort-Object @{ Expression = { [int]$_.statusCode }; Descending = $true } |
        Select-Object -First 1

      if ($program -and $program.identifier -and [int]$program.statusCode -ne 1) {
        $body = @{ identifier = $program.identifier } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Put -Uri $programsUrl -ContentType 'application/json' -Body $body -TimeoutSec 180 | Out-Null
        Write-Log 'CRONOMETRAGEM reativado na TB50'
      } elseif (-not $program) {
        Write-Log 'CRONOMETRAGEM nao encontrado na API da TB50'
      }
    }
  }
} catch {
  Write-Log "Watchdog error: $($_.Exception.Message)"
} finally {
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}

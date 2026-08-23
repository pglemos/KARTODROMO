param(
  [int]$StreamerMemoryLimitMb = 1500,
  [int]$ScraperMemoryLimitMb = 900,
  [int]$NextMemoryLimitMb = 700,
  [int]$StackMemoryLimitMb = 2800,
  [int]$MinFreeMemoryMb = 700,
  [int]$MaxHeadlessProcessCount = 12,
  [int]$LogMaxMb = 10,
  [int]$LogArchiveRetentionDays = 2
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$LogPath = Join-Path $RuntimeDir "tb50-watchdog.log"
$MutexName = "Local\KartodromoTB50Watchdog"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, $MutexName)
if (-not $mutex.WaitOne(0)) {
  exit 0
}

function Write-WatchLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$timestamp] $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

function Set-PlaywrightRuntime {
  $installedBrowsers = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($browser in $installedBrowsers) {
    if (Test-Path $browser) {
      $env:LIVETIME_CHROME_PATH = $browser
      $env:TB50_CHROME_PATH = $browser
      return
    }
  }

  $playwrightRoot = "C:\Users\Administrador\AppData\Local\ms-playwright"
  if (-not (Test-Path $playwrightRoot)) {
    Write-WatchLog "Playwright runtime not found at $playwrightRoot"
    return
  }

  $chrome = Get-ChildItem -Path $playwrightRoot -Recurse -Filter "chrome-headless-shell.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1

  $env:PLAYWRIGHT_BROWSERS_PATH = $playwrightRoot
  if ($chrome) {
    $env:LIVETIME_CHROME_PATH = $chrome.FullName
    $env:TB50_CHROME_PATH = $chrome.FullName
  }
}

function Rotate-RuntimeLogs {
  $limitBytes = [int64]$LogMaxMb * 1024 * 1024
  Get-ChildItem -Path $RuntimeDir -Filter "*.log" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Length -gt $limitBytes } |
    ForEach-Object {
      $archive = "$($_.FullName).$(Get-Date -Format 'yyyyMMdd-HHmmss').old"
      try {
        Move-Item -LiteralPath $_.FullName -Destination $archive -Force
        Write-WatchLog "Rotated large log $($_.Name) to $(Split-Path $archive -Leaf)"
      } catch {
        Write-WatchLog "Could not rotate $($_.Name): $($_.Exception.Message)"
      }
    }

  Get-ChildItem -Path $RuntimeDir -Filter "*.log.*.old" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1 * $LogArchiveRetentionDays) } |
    ForEach-Object {
      try {
        Remove-Item -LiteralPath $_.FullName -Force
        Write-WatchLog "Removed old archived log $($_.Name)"
      } catch {
        Write-WatchLog "Could not remove old archived log $($_.Name): $($_.Exception.Message)"
      }
    }
}

function Get-ProcessByPattern {
  param(
    [string]$Name,
    [string]$Pattern
  )

  Get-CimInstance Win32_Process -Filter "name = '$Name'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $Pattern }
}

function Stop-ProcessTree {
  param(
    [int]$TargetProcessId,
    [object[]]$ProcessSnapshot
  )

  $ProcessSnapshot |
    Where-Object { $_.ParentProcessId -eq $TargetProcessId } |
    ForEach-Object { Stop-ProcessTree -TargetProcessId $_.ProcessId -ProcessSnapshot $ProcessSnapshot }

  Stop-Process -Id $TargetProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-ProcessByPattern {
  param(
    [string]$Name,
    [string]$Pattern
  )

  $matches = @(Get-ProcessByPattern -Name $Name -Pattern $Pattern)
  if ($matches.Count -eq 0) {
    return
  }

  $snapshot = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  foreach ($process in $matches) {
    Stop-ProcessTree -TargetProcessId $process.ProcessId -ProcessSnapshot $snapshot
  }
}

function Get-NpmCmdPath {
  $programFiles = $env:ProgramFiles
  if (-not $programFiles) {
    $programFiles = "C:\Program Files"
  }

  $candidates = @(
    (Join-Path $programFiles "nodejs\npm.cmd"),
    "C:\Program Files\nodejs\npm.cmd",
    "C:\Users\Administrador\AppData\Roaming\npm\npm.cmd"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $command = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "npm.cmd not found"
}

function Start-NpmProcess {
  param(
    [string[]]$Arguments,
    [string]$OutLog,
    [string]$ErrLog
  )

  Start-Process -FilePath (Get-NpmCmdPath) `
    -ArgumentList $Arguments `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $RuntimeDir $OutLog) `
    -RedirectStandardError (Join-Path $RuntimeDir $ErrLog) `
    -PassThru | Out-Null
}

function Get-ProcessMemoryMb {
  param([object[]]$Processes)

  $memoryMb = 0
  foreach ($process in @($Processes)) {
    try {
      $memoryMb += [math]::Round((Get-Process -Id $process.ProcessId -ErrorAction Stop).WorkingSet64 / 1MB)
    } catch {
    }
  }

  return $memoryMb
}

function Get-StackProcesses {
  $escapedRepo = [regex]::Escape([string]$RepoRoot)
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -match $escapedRepo -or
        $_.CommandLine -match "tb50-streamer|livetime-scraper-server|stream:tb50|rtsp://.*tb50|rtmp://.*tb50|viplex-rtsp-keepalive|cloudflared.*4010|ngrok.*4010|mediamtx"
      )
    }
}

function Cleanup-OrphanHeadlessBrowsers {
  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  $ids = @{}
  foreach ($process in $processes) {
    $ids[[int]$process.ProcessId] = $true
  }

  $orphans = @($processes | Where-Object { $_.Name -eq "chrome-headless-shell.exe" -and -not $ids.ContainsKey([int]$_.ParentProcessId) })
  foreach ($orphan in $orphans) {
    Stop-Process -Id $orphan.ProcessId -Force -ErrorAction SilentlyContinue
    Write-WatchLog "Stopped orphan chrome-headless-shell.exe pid=$($orphan.ProcessId)"
  }
}

function Test-ListeningPort {
  param([int]$Port)
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-JsonOrNull {
  param([string]$Uri)

  try {
    Invoke-RestMethod -UseBasicParsing -Uri $Uri -TimeoutSec 8
  } catch {
    $null
  }
}

function Test-HlsStream {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:8888/tb50/index.m3u8" -TimeoutSec 8
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-HlsStream {
  param([int]$Attempts = 10)

  for ($i = 0; $i -lt $Attempts; $i++) {
    if (Test-HlsStream) {
      return $true
    }
    Start-Sleep -Seconds 2
  }

  return $false
}

function Get-CronometragemProgram {
  $programs = Get-JsonOrNull -Uri "http://localhost:3000/api/viplex-programs"
  if (-not $programs) {
    return $null
  }

  @($programs.programs) |
    Where-Object { $_.name -and $_.name.Trim().ToUpperInvariant() -eq "CRONOMETRAGEM" } |
    Select-Object -First 1
}

function Start-CronometragemProgram {
  param([object]$Program)

  if (-not $Program -or -not $Program.identifier) {
    Write-WatchLog "CRONOMETRAGEM program not found in Viplex API."
    return
  }

  try {
    Invoke-RestMethod `
      -Method Put `
      -Uri "http://localhost:3000/api/viplex-programs" `
      -ContentType "application/json" `
      -Body (@{ identifier = $Program.identifier } | ConvertTo-Json -Compress) `
      -TimeoutSec 45 | Out-Null
    Write-WatchLog "CRONOMETRAGEM program reactivated."
  } catch {
    Write-WatchLog "Could not reactivate CRONOMETRAGEM: $($_.Exception.Message)"
  }
}

function Ensure-CronometragemProgram {
  $program = Get-CronometragemProgram
  if ($program -and [int]$program.statusCode -eq 1) {
    return
  }

  Start-CronometragemProgram -Program $program
}

function Restart-Scraper {
  param([string]$Reason)

  Write-WatchLog "Restarting scraper: $Reason"
  Stop-ProcessByPattern -Name "node.exe" -Pattern "livetime-scraper-server|npm-cli\.js.*scraper"
  Stop-ProcessByPattern -Name "cmd.exe" -Pattern "livetime-scraper-server|npm(\.cmd)? run scraper"
  Start-NpmProcess -Arguments @("run", "scraper") -OutLog "scraper.out.log" -ErrLog "scraper.err.log"
  Start-Sleep -Seconds 5
}

function Ensure-Scraper {
  $processes = @(Get-ProcessByPattern -Name "node.exe" -Pattern "livetime-scraper-server|npm-cli\.js.*scraper")
  $health = Get-JsonOrNull -Uri "http://localhost:4010/healthz"
  $snapshot = Get-JsonOrNull -Uri "http://localhost:4010/api/livetime-snapshot"

  $playwrightBroken = $snapshot -and $snapshot.status -eq "error" -and $snapshot.message -match "Executable doesn't exist|browserType\.launch|Playwright"

  if ($processes.Count -eq 0 -or -not $health -or $playwrightBroken) {
    Restart-Scraper -Reason "processes=$($processes.Count) health=$([bool]$health) playwrightBroken=$playwrightBroken"
  }
}

function Restart-Next {
  param([string]$Reason)

  Write-WatchLog "Restarting Next server: $Reason"
  Stop-ProcessByPattern -Name "node.exe" -Pattern "next.*start -p 3000|npm-cli\.js.*run start"
  Stop-ProcessByPattern -Name "cmd.exe" -Pattern "next.*start -p 3000|npm(\.cmd)? run start"
  Start-NpmProcess -Arguments @("run", "start", "--", "-p", "3000") -OutLog "next-prod.out.log" -ErrLog "next-prod.err.log"
  for ($i = 0; $i -lt 20 -and -not (Test-ListeningPort 3000); $i++) {
    Start-Sleep -Seconds 1
  }
}

function Ensure-Next {
  $pageOk = $false
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000/podio-live-tb50?_watchdog=$(Get-Date -Format FileDateTime)" -TimeoutSec 10
    $pageOk = $response.StatusCode -eq 200
  } catch {
    $pageOk = $false
  }

  if (-not (Test-ListeningPort 3000) -or -not $pageOk) {
    Restart-Next -Reason "listening=$(Test-ListeningPort 3000) pageOk=$pageOk"
  }

  try {
    Invoke-RestMethod `
      -Method Put `
      -Uri "http://localhost:3000/api/tb50-display-mode" `
      -ContentType "application/json" `
      -Body '{"mode":"live"}' `
      -TimeoutSec 5 | Out-Null
  } catch {
    Write-WatchLog "Could not force live display mode: $($_.Exception.Message)"
  }
}

function Ensure-MediaMtx {
  if ((Get-Process -Name mediamtx -ErrorAction SilentlyContinue) -and (Test-ListeningPort 8554)) {
    return
  }

  Write-WatchLog "Starting MediaMTX."
  & (Join-Path $PSScriptRoot "start-mediamtx.ps1") | Out-Null
}

function Restart-Streamer {
  param([string]$Reason)

  Write-WatchLog "Restarting TB50 streamer: $Reason"
  Stop-ProcessByPattern -Name "node.exe" -Pattern "tb50-streamer|npm-cli\.js.*stream:tb50"
  Stop-ProcessByPattern -Name "cmd.exe" -Pattern "tb50-streamer|npm(\.cmd)? run stream:tb50"
  Stop-ProcessByPattern -Name "ffmpeg.exe" -Pattern "rtsp://.*tb50|rtmp://.*tb50"

  & (Join-Path $PSScriptRoot "start-tb50-stream.ps1") `
    -ScoreboardUrl "http://localhost:3000/podio-live-tb50" `
    -StreamUrl "rtsp://192.168.20.13:8554/tb50" | Out-Null

  if (-not (Wait-HlsStream)) {
    Write-WatchLog "TB50 streamer restarted, but HLS is still unavailable."
    return
  }

  Start-CronometragemProgram -Program (Get-CronometragemProgram)
}

function Ensure-Streamer {
  $streamerProcesses = @(Get-ProcessByPattern -Name "node.exe" -Pattern "tb50-streamer|npm-cli\.js.*stream:tb50")
  $ffmpegProcesses = @(Get-ProcessByPattern -Name "ffmpeg.exe" -Pattern "rtsp://.*tb50|rtmp://.*tb50")

  $headlessMemoryMb = 0
  Get-Process -Name "chrome-headless-shell" -ErrorAction SilentlyContinue |
    ForEach-Object { $headlessMemoryMb += [math]::Round($_.WorkingSet64 / 1MB) }

  if ($streamerProcesses.Count -eq 0) {
    Restart-Streamer -Reason "streamer process missing"
    return
  }

  if ($ffmpegProcesses.Count -eq 0) {
    Restart-Streamer -Reason "ffmpeg publisher missing"
    return
  }

  if ($ffmpegProcesses.Count -gt 1) {
    Restart-Streamer -Reason "duplicate ffmpeg publishers count=$($ffmpegProcesses.Count)"
    return
  }

  if ($headlessMemoryMb -gt $StreamerMemoryLimitMb) {
    Restart-Streamer -Reason "headless browser memory ${headlessMemoryMb}MB above ${StreamerMemoryLimitMb}MB"
    return
  }

  if (-not (Wait-HlsStream -Attempts 15)) {
    Restart-Streamer -Reason "HLS stream unavailable"
    return
  }
}

function Ensure-ResourceBudget {
  Cleanup-OrphanHeadlessBrowsers

  $scraperProcesses = @(Get-ProcessByPattern -Name "node.exe" -Pattern "livetime-scraper-server|npm-cli\.js.*scraper")
  $nextProcesses = @(Get-ProcessByPattern -Name "node.exe" -Pattern "next.*start -p 3000|npm-cli\.js.*run start")
  $streamerProcesses = @(Get-ProcessByPattern -Name "node.exe" -Pattern "tb50-streamer|npm-cli\.js.*stream:tb50")
  $headlessProcesses = @(Get-CimInstance Win32_Process -Filter "name = 'chrome-headless-shell.exe'" -ErrorAction SilentlyContinue)
  $stackProcesses = @(Get-StackProcesses)

  $scraperMemoryMb = Get-ProcessMemoryMb -Processes $scraperProcesses
  $nextMemoryMb = Get-ProcessMemoryMb -Processes $nextProcesses
  $streamerMemoryMb = Get-ProcessMemoryMb -Processes $streamerProcesses
  $headlessMemoryMb = Get-ProcessMemoryMb -Processes $headlessProcesses
  $stackMemoryMb = Get-ProcessMemoryMb -Processes $stackProcesses
  $freeMemoryMb = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)

  if ($nextMemoryMb -gt $NextMemoryLimitMb) {
    Restart-Next -Reason "memory ${nextMemoryMb}MB above ${NextMemoryLimitMb}MB"
  }

  if ($scraperMemoryMb -gt $ScraperMemoryLimitMb) {
    Restart-Scraper -Reason "memory ${scraperMemoryMb}MB above ${ScraperMemoryLimitMb}MB"
  }

  if ($headlessProcesses.Count -gt $MaxHeadlessProcessCount -or $headlessMemoryMb -gt $StreamerMemoryLimitMb) {
    Restart-Streamer -Reason "headless count=$($headlessProcesses.Count) memory=${headlessMemoryMb}MB limit=${StreamerMemoryLimitMb}MB"
    return
  }

  if ($stackMemoryMb -gt $StackMemoryLimitMb -and $freeMemoryMb -lt $MinFreeMemoryMb) {
    Restart-Streamer -Reason "stack memory ${stackMemoryMb}MB and free memory ${freeMemoryMb}MB below ${MinFreeMemoryMb}MB"
    Restart-Scraper -Reason "stack memory ${stackMemoryMb}MB and free memory ${freeMemoryMb}MB below ${MinFreeMemoryMb}MB"
  }
}

try {
  Push-Location $RepoRoot
  Set-PlaywrightRuntime
  Rotate-RuntimeLogs
  Ensure-Scraper
  Ensure-Next
  Ensure-MediaMtx
  Ensure-Streamer
  Ensure-CronometragemProgram
  Ensure-ResourceBudget
  Write-WatchLog "OK"
} catch {
  Write-WatchLog "Watchdog failed: $($_.Exception.Message)"
  throw
} finally {
  Pop-Location
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}

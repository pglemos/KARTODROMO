$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

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

Set-PlaywrightRuntime

if (-not $env:LIVETIME_SNAPSHOT_ENDPOINT) {
  $env:LIVETIME_SNAPSHOT_ENDPOINT = "http://127.0.0.1:4010/api/livetime-snapshot"
}

function Get-NodeProcessByPattern {
  param([string]$Pattern)
  Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.CommandLine -match $Pattern }
}

function Stop-ProcessByPattern {
  param(
    [string]$Name,
    [string]$Pattern
  )

  Get-CimInstance Win32_Process -Filter "name = '$Name'" |
    Where-Object { $_.CommandLine -match $Pattern } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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

function Test-ListeningPort {
  param([int]$Port)
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Invoke-ViplexCronometragemRepair {
  try {
    $programs = Invoke-RestMethod `
      -Uri "http://localhost:3000/api/viplex-programs" `
      -TimeoutSec 10

    $program = @($programs.programs) |
      Where-Object { $_.name -and $_.name.Trim().ToUpperInvariant() -eq "CRONOMETRAGEM" } |
      Select-Object -First 1

    if (-not $program -or -not $program.identifier) {
      Write-Warning "Programa CRONOMETRAGEM nao encontrado na API Viplex local."
      return
    }

    Invoke-RestMethod `
      -Method Put `
      -Uri "http://localhost:3000/api/viplex-programs" `
      -ContentType "application/json" `
      -Body (@{ identifier = $program.identifier } | ConvertTo-Json -Compress) `
      -TimeoutSec 45 | Out-Null
  } catch {
    Write-Warning "Nao foi possivel reativar CRONOMETRAGEM na TB50: $($_.Exception.Message)"
  }
}

$scraper = Get-NodeProcessByPattern "livetime-scraper-server"
if (-not $scraper) {
  Start-NpmProcess -Arguments @("run", "scraper") -OutLog "scraper.out.log" -ErrLog "scraper.err.log"
}

& (Join-Path $PSScriptRoot "start-livetime-ngrok.ps1") -Optional | Out-Null

if (-not (Test-ListeningPort 3000)) {
  Start-NpmProcess -Arguments @("run", "start", "--", "-p", "3000") -OutLog "next-prod.out.log" -ErrLog "next-prod.err.log"
}

for ($i = 0; $i -lt 15 -and -not (Test-ListeningPort 3000); $i++) {
  Start-Sleep -Seconds 1
}

try {
  Invoke-RestMethod `
    -Method Put `
    -Uri "http://localhost:3000/api/tb50-display-mode" `
    -ContentType "application/json" `
    -Body '{"mode":"live"}' `
    -TimeoutSec 5 | Out-Null
} catch {
  Write-Warning "Nao foi possivel forcar modo live em http://localhost:3000/api/tb50-display-mode: $($_.Exception.Message)"
}

& (Join-Path $PSScriptRoot "start-mediamtx.ps1") | Out-Null

Stop-ProcessByPattern -Name "node.exe" -Pattern "tb50-streamer|stream:tb50"
Stop-ProcessByPattern -Name "cmd.exe" -Pattern "tb50-streamer|npm(\.cmd)? run stream:tb50"
Stop-ProcessByPattern -Name "ffmpeg.exe" -Pattern "rtsp://.*tb50|rtmp://.*tb50"

& (Join-Path $PSScriptRoot "start-tb50-stream.ps1") `
  -ScoreboardUrl "http://127.0.0.1:3000/podio-live-tb50" `
  -StreamUrl "rtsp://192.168.20.13:8554/tb50" | Out-Null

Start-Sleep -Seconds 2

Invoke-ViplexCronometragemRepair

[pscustomobject]@{
  Next = Test-ListeningPort 3000
  Scraper = [bool](Get-NodeProcessByPattern "livetime-scraper-server")
  Ngrok = [bool](Get-CimInstance Win32_Process -Filter "name = 'ngrok.exe'")
  MediaMTX = [bool](Get-Process -Name mediamtx -ErrorAction SilentlyContinue)
  Streamer = [bool](Get-NodeProcessByPattern "tb50-streamer|stream:tb50")
}

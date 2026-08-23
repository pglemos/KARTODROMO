param(
  [string]$ScoreboardUrl = "http://127.0.0.1:3000/podio-live-tb50",
  [string]$StreamUrl = "rtsp://192.168.20.13:8554/tb50",
  [int]$Width = 2048,
  [int]$Height = 512,
  [int]$CaptureFps = 8,
  [int]$OutputFps = 8,
  [string]$VideoBitrate = "1400k",
  [string]$VideoBufferSize = "2800k",
  [string]$RtpPacketSize = "1200"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$env:TB50_SCOREBOARD_URL = $ScoreboardUrl
$env:TB50_STREAM_URL = $StreamUrl
$env:TB50_STREAM_WIDTH = [string]$Width
$env:TB50_STREAM_HEIGHT = [string]$Height
$env:TB50_CAPTURE_FPS = [string]$CaptureFps
$env:TB50_OUTPUT_FPS = [string]$OutputFps
$env:TB50_STREAM_BITRATE = $VideoBitrate
$env:TB50_STREAM_BUFSIZE = $VideoBufferSize
$env:TB50_RTP_PKT_SIZE = $RtpPacketSize

function Get-InstalledBrowserPath {
  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

$installedBrowser = Get-InstalledBrowserPath
if ($installedBrowser) {
  $env:TB50_CHROME_PATH = $installedBrowser
} else {
  $playwrightRoot = "C:\Users\Administrador\AppData\Local\ms-playwright"
  if (Test-Path $playwrightRoot) {
    $chrome = Get-ChildItem -Path $playwrightRoot -Recurse -Filter "chrome-headless-shell.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1
    $env:PLAYWRIGHT_BROWSERS_PATH = $playwrightRoot
    if ($chrome) {
      $env:TB50_CHROME_PATH = $chrome.FullName
    }
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

Start-Process -FilePath (Get-NpmCmdPath) `
  -ArgumentList @("run", "stream:tb50") `
  -WorkingDirectory $RepoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $RuntimeDir "tb50-streamer.out.log") `
  -RedirectStandardError (Join-Path $RuntimeDir "tb50-streamer.err.log") `
  -PassThru

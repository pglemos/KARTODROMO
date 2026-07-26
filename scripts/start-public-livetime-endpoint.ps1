param(
  [int]$DelaySeconds = 15
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$LogPath = Join-Path $RuntimeDir "public-livetime-endpoint.log"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-EndpointLog {
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
      Write-EndpointLog "Using installed browser at $browser"
      return
    }
  }

  $playwrightRoot = "C:\Users\Administrador\AppData\Local\ms-playwright"
  if (-not (Test-Path $playwrightRoot)) {
    Write-EndpointLog "Playwright runtime not found at $playwrightRoot"
    return
  }

  $chrome = Get-ChildItem -Path $playwrightRoot -Recurse -Filter "chrome-headless-shell.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1

  $env:PLAYWRIGHT_BROWSERS_PATH = $playwrightRoot
  if ($chrome) {
    $env:LIVETIME_CHROME_PATH = $chrome.FullName
    $env:TB50_CHROME_PATH = $chrome.FullName
    Write-EndpointLog "Using Playwright Chromium at $($chrome.FullName)"
  }
}

function Get-NodeProcessByPattern {
  param([string]$Pattern)
  Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.CommandLine -match $Pattern }
}

function Get-NpmCmdPath {
  $candidates = @(
    (Join-Path $env:ProgramFiles "nodejs\npm.cmd"),
    "C:\Program Files\nodejs\npm.cmd",
    "C:\Users\Administrador\AppData\Roaming\npm\npm.cmd"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
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

function Test-Health {
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:4010/healthz" -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

try {
  Write-EndpointLog "Public LiveTime endpoint autostart requested. DelaySeconds=$DelaySeconds RepoRoot=$RepoRoot"
  Set-PlaywrightRuntime

  if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
  }

  if (-not (Get-NodeProcessByPattern "livetime-scraper-server")) {
    Write-EndpointLog "Starting LiveTime scraper on port 4010."
    Start-NpmProcess -Arguments @("run", "scraper") -OutLog "scraper.out.log" -ErrLog "scraper.err.log"
  } else {
    Write-EndpointLog "LiveTime scraper is already running."
  }

  for ($i = 0; $i -lt 90 -and -not (Test-Health); $i++) {
    Start-Sleep -Seconds 1
  }

  if (-not (Test-Health)) {
    throw "http://localhost:4010/healthz did not become healthy."
  }

  Write-EndpointLog "Public LiveTime endpoint is healthy on localhost:4010."
} catch {
  Write-EndpointLog "Public LiveTime endpoint autostart failed: $($_.Exception.Message)"
  throw
}

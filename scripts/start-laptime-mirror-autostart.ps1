param(
  [int]$DelaySeconds = 20
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$LogPath = Join-Path $RuntimeDir "laptime-mirror-autostart.log"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-MirrorLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$timestamp] $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
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
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  $command = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw "npm.cmd not found"
}

function Test-Health {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/healthz" -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

try {
  Write-MirrorLog "Mirror autostart solicitado. DelaySeconds=$DelaySeconds RepoRoot=$RepoRoot"

  if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
  }

  $port = if ($env:MIRROR_PORT) { [int]$env:MIRROR_PORT } else { 4030 }
  if (-not (Get-NodeProcessByPattern "laptime-mirror-server")) {
    Write-MirrorLog "Iniciando daemon de espelho (npm run mirror) na porta $port."
    Start-Process -FilePath (Get-NpmCmdPath) `
      -ArgumentList @("run", "mirror") `
      -WorkingDirectory $RepoRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $RuntimeDir "mirror.out.log") `
      -RedirectStandardError (Join-Path $RuntimeDir "mirror.err.log") `
      -PassThru | Out-Null
  } else {
    Write-MirrorLog "Daemon de espelho ja esta rodando."
  }

  for ($i = 0; $i -lt 120 -and -not (Test-Health -Port $port); $i++) {
    Start-Sleep -Seconds 1
  }

  if (-not (Test-Health -Port $port)) {
    throw "http://localhost:$port/healthz nao respondeu."
  }

  Write-MirrorLog "Daemon de espelho saudavel em localhost:$port."
} catch {
  Write-MirrorLog "Mirror autostart falhou: $($_.Exception.Message)"
  throw
}

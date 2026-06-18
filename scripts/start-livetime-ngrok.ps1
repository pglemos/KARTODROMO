param(
  [string]$Domain = "repeatable-sanora-feignedly.ngrok-free.dev",
  [int]$Port = 4010,
  [switch]$Optional
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$Ngrok = Join-Path $RepoRoot ".tools\ngrok\ngrok.exe"
$OutLog = Join-Path $RuntimeDir "ngrok.out.log"
$ErrLog = Join-Path $RuntimeDir "ngrok.err.log"
$ConfigPath = Join-Path $env:LOCALAPPDATA "ngrok\ngrok.yml"
$StopEarly = $false

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Get-NgrokProcess {
  Get-CimInstance Win32_Process -Filter "name = 'ngrok.exe'" |
    Where-Object { $_.CommandLine -match [regex]::Escape($Domain) -or $_.CommandLine -match " $Port($| )" }
}

function Write-OptionalLog {
  param([string]$Message)
  try {
    $Message | Out-File -FilePath $ErrLog -Append -Encoding utf8
  } catch {
    Write-Warning $Message
  }
}

function Exit-Optional {
  param([string]$Message)
  Write-OptionalLog $Message
  if ($Optional) {
    [pscustomobject]@{
      Started = $false
      Reason = $Message
      Domain = $Domain
      Port = $Port
    }
    $script:StopEarly = $true
    return
  }
  throw $Message
}

if (-not (Test-Path $Ngrok)) {
  Exit-Optional "ngrok.exe nao encontrado em $Ngrok."
  if ($StopEarly) { return }
}

if ($env:NGROK_AUTHTOKEN) {
  & $Ngrok config add-authtoken $env:NGROK_AUTHTOKEN | Out-Null
}

if (-not (Test-Path $ConfigPath)) {
  Exit-Optional "ngrok authtoken nao configurado nesta maquina. Execute: .tools\ngrok\ngrok.exe config add-authtoken SEU_TOKEN"
  if ($StopEarly) { return }
}

$existing = Get-NgrokProcess

if (-not $existing) {
  Remove-Item -Force $OutLog, $ErrLog -ErrorAction SilentlyContinue
  Start-Process -FilePath $Ngrok `
    -ArgumentList @("http", "--url=$Domain", [string]$Port, "--log=stdout") `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru | Out-Null
}

$publicHealth = "https://$Domain/healthz"
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1

  $log = ""
  if (Test-Path $ErrLog) {
    try { $log += Get-Content $ErrLog -Raw } catch {}
  }
  if (Test-Path $OutLog) {
    try { $log += Get-Content $OutLog -Raw } catch {}
  }

  if ($log -match "ERR_NGROK_|authentication failed|failed to reconnect session|command failed") {
    Exit-Optional "ngrok falhou ao iniciar localmente. Verifique .runtime\ngrok.err.log."
    if ($StopEarly) { return }
  }

  $running = Get-NgrokProcess
  if (-not $running) {
    continue
  }

  try {
    $tunnels = Invoke-RestMethod -UseBasicParsing "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
    $publicUrl = @($tunnels.tunnels | Where-Object { $_.public_url -eq "https://$Domain" })[0].public_url
    if (-not $publicUrl) {
      continue
    }

    $response = Invoke-WebRequest -UseBasicParsing $publicHealth -Headers @{ "ngrok-skip-browser-warning" = "true" } -TimeoutSec 5
    if ($response.StatusCode -eq 200 -and $publicUrl -eq "https://$Domain") {
      [pscustomobject]@{
        Started = $true
        Domain = $Domain
        Port = $Port
        Health = $publicHealth
        PublicUrl = $publicUrl
      }
      return
    }
  } catch {
  }
}

Exit-Optional "ngrok iniciou, mas $publicHealth nao respondeu dentro do tempo esperado."
if ($StopEarly) { return }

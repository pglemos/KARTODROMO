$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$MediaMtx = Join-Path $RepoRoot ".tools\mediamtx\mediamtx.exe"
$MediaMtxDir = Split-Path $MediaMtx -Parent
$ConfigPath = Join-Path $MediaMtxDir "mediamtx.yml"
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$OutLog = Join-Path $RuntimeDir "mediamtx.out.log"
$ErrLog = Join-Path $RuntimeDir "mediamtx.err.log"

if (-not (Test-Path $MediaMtx)) {
  throw "MediaMTX nao encontrado em $MediaMtx."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$config = @"
rtspTransports: [tcp]
rtspAddress: :8554
rtmpAddress: :1935
hlsAddress: :8888
hlsVariant: mpegts
writeQueueSize: 4096
readTimeout: 10m
paths:
  tb50:
    source: publisher
"@

if (-not (Test-Path $ConfigPath) -or ((Get-Content $ConfigPath -Raw).TrimEnd() -ne $config.TrimEnd())) {
  $config | Set-Content -Path $ConfigPath -Encoding ascii -NoNewline
}

$existing = Get-Process -Name mediamtx -ErrorAction SilentlyContinue
if ($existing) {
  $existing | Select-Object Id,ProcessName,Path
  exit 0
}

$process = Start-Process -FilePath $MediaMtx `
  -WorkingDirectory $MediaMtxDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -PassThru

Start-Sleep -Seconds 2
$process | Select-Object Id,ProcessName,Path

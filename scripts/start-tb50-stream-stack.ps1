param(
  [string]$ScoreboardUrl = "http://localhost:3000/placar-telao-tb50?layout=designer",
  [string]$StreamPath = "tb50",
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
$MediaMtx = Join-Path $RepoRoot ".tools\mediamtx\mediamtx.exe"
$MediaMtxDir = Split-Path $MediaMtx -Parent
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$OutLog = Join-Path $RuntimeDir "mediamtx.out.log"
$ErrLog = Join-Path $RuntimeDir "mediamtx.err.log"

if (-not (Test-Path $MediaMtx)) {
  throw "MediaMTX nao encontrado em $MediaMtx."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$ports = @(8554, 1935, 8888)
foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    continue
  }
}

$existing = Get-Process -Name mediamtx -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process -FilePath $MediaMtx -WorkingDirectory $MediaMtxDir -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog | Out-Null
  Start-Sleep -Seconds 2
}

$streamUrl = "rtsp://127.0.0.1:8554/$StreamPath"
& (Join-Path $PSScriptRoot "start-tb50-stream.ps1") `
  -ScoreboardUrl $ScoreboardUrl `
  -StreamUrl $streamUrl `
  -Width $Width `
  -Height $Height `
  -CaptureFps $CaptureFps `
  -OutputFps $OutputFps `
  -VideoBitrate $VideoBitrate `
  -VideoBufferSize $VideoBufferSize `
  -RtpPacketSize $RtpPacketSize

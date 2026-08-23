$ErrorActionPreference = "Stop"

$LocalLayoutUrl = "http://localhost:3000/api/telao-layout"
$LocalPayloadUrl = "http://localhost:3000/podio-live-tb50"
$RtspUrl = "rtsp://192.168.20.13:8554/tb50"
$HlsUrl = "http://192.168.20.13:8888/tb50/index.m3u8"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Ffprobe = Get-ChildItem -Path (Join-Path $RepoRoot ".tools\ffmpeg") -Recurse -Filter ffprobe.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $Ffprobe) {
  throw "ffprobe.exe nao encontrado em .tools\ffmpeg."
}

$layout = Invoke-WebRequest -UseBasicParsing "${LocalLayoutUrl}?_ts=$(Get-Date -Format FileDateTimeUniversal)" | ConvertFrom-Json
$snapshot = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/api/livetime-snapshot?uid=58856059-c4fd-4626-aea7-42aefc048eec&_ts=$(Get-Date -Format FileDateTimeUniversal)" | ConvertFrom-Json
$local = Invoke-WebRequest -UseBasicParsing "${LocalPayloadUrl}?uid=58856059-c4fd-4626-aea7-42aefc048eec&_ts=$(Get-Date -Format FileDateTimeUniversal)"
$hls = Invoke-WebRequest -UseBasicParsing $HlsUrl
$hlsText = if ($hls.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($hls.Content) } else { $hls.Content }
$rtsp = & $Ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 $RtspUrl

[pscustomobject]@{
  LocalLayout = "$($layout.layout.id) $($layout.layout.columns)x$($layout.layout.rows) $($layout.layout.variant)"
  LocalStorage = $layout.store.storage
  LocalPersistent = [bool]$layout.store.persistent
  LiveStatus = $snapshot.status
  LiveDrivers = @($snapshot.drivers).Count
  LocalUsesPodiumPage = ($local.Content.Contains("TOP 3 AO VIVO") -and $local.Content.Contains("Atualização automática da cronometragem"))
  LocalHasLiveDrivers = ($local.Content.Contains("KART") -and @($snapshot.drivers).Count -gt 0)
  Rtsp2048x512 = (($rtsp -join "`n").Contains("width=2048") -and ($rtsp -join "`n").Contains("height=512"))
  Rtsp8fps = ($rtsp -join "`n").Contains("r_frame_rate=8/1")
  HlsOnline = $hlsText.Contains("RESOLUTION=2048x512")
  RtspUrl = $RtspUrl
  HlsUrl = $HlsUrl
}

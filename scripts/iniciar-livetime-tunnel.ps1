<#
  Inicia o túnel Cloudflare (KartodromoLiveTimeTunnel) lendo o token de arquivo protegido
  em C:\KARTODROMO\segredos\cloudflared-livetime.token, sem expor o segredo na linha de comando
  do processo (WMI Win32_Process.CommandLine).
#>
$ErrorActionPreference = 'Stop'

$tokenFile = 'C:\KARTODROMO\segredos\cloudflared-livetime.token'
if (-not (Test-Path -LiteralPath $tokenFile)) {
  throw "Arquivo de token do túnel não encontrado em $tokenFile"
}

$token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
if (-not $token) {
  throw "Token do túnel Cloudflare está vazio em $tokenFile"
}

$env:TUNNEL_TOKEN = $token

$candidatos = @(
  'C:\repos\KARTODROMO\.tools\cloudflared\cloudflared.exe',
  'C:\Program Files (x86)\cloudflared\cloudflared.exe',
  'C:\Program Files\cloudflared\cloudflared.exe',
  'cloudflared.exe'
)
$cloudflared = $candidatos | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $cloudflared) { $cloudflared = 'cloudflared.exe' }

& $cloudflared tunnel --no-autoupdate run

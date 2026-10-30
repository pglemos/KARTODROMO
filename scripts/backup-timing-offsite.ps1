<#
  Cópia de segurança offsite automática dos dados da Cronometragem (ORBITS -> SRVKART 192.168.20.13).
  Copia catalog.json, transponders.json, settings.json, equalizacao-*.json, sessions recentes e diários
  para C:\kartodromo-servidor\backups\timing no SRVKART via WinRM.
#>
param(
  [string]$Servidor = '192.168.20.13',
  [int]$DiasSessoes = 14
)
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dataDir = Join-Path $repo 'data\timing'
if (-not (Test-Path -LiteralPath $dataDir)) {
  Write-Output "Pasta $dataDir não encontrada."
  exit 0
}

. (Join-Path $repo 'scripts\apps\credencial.ps1')
$cred = Obter-CredencialKartodromo
$sessao = New-PSSession -ComputerName $Servidor -Credential $cred
try {
  $destinoBase = 'C:\kartodromo-servidor\backups\timing'
  Invoke-Command -Session $sessao -ArgumentList $destinoBase {
    param($pasta)
    New-Item -ItemType Directory -Force (Join-Path $pasta 'sessions') | Out-Null
    New-Item -ItemType Directory -Force (Join-Path $pasta 'passagens') | Out-Null
  }

  $arquivosRaiz = @(
    'catalog.json',
    'catalog.json.bak',
    'transponders.json',
    'settings.json',
    'equalizacao-metas.json',
    'equalizacao-regras.json',
    'tb50-page.json',
    'painel-led-page.json'
  )
  foreach ($nome in $arquivosRaiz) {
    $origem = Join-Path $dataDir $nome
    if (Test-Path -LiteralPath $origem) {
      Copy-Item -LiteralPath $origem -Destination "$destinoBase\$nome" -ToSession $sessao -Force
    }
  }

  $corte = (Get-Date).AddDays(-$DiasSessoes)
  $sessionsDir = Join-Path $dataDir 'sessions'
  if (Test-Path -LiteralPath $sessionsDir) {
    $recentes = Get-ChildItem -LiteralPath $sessionsDir -Filter '*.json' -File -Recurse |
      Where-Object { $_.LastWriteTime -ge $corte }
    foreach ($arq in $recentes) {
      Copy-Item -LiteralPath $arq.FullName -Destination "$destinoBase\sessions\$($arq.Name)" -ToSession $sessao -Force
    }
  }

  $passagensDir = Join-Path $dataDir 'passagens'
  if (Test-Path -LiteralPath $passagensDir) {
    $diarios = Get-ChildItem -LiteralPath $passagensDir -Filter '*.jsonl' -File |
      Where-Object { $_.LastWriteTime -ge $corte }
    foreach ($arq in $diarios) {
      Copy-Item -LiteralPath $arq.FullName -Destination "$destinoBase\passagens\$($arq.Name)" -ToSession $sessao -Force
    }
  }

  Write-Output "[$(Get-Date -Format 'o')] Backup offsite concluído em \\$Servidor\C$\kartodromo-servidor\backups\timing"
}
finally {
  Remove-PSSession $sessao
}

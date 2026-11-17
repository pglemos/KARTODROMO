# Backup diario do Postgres local do SRVKART (tarefa "Kartodromo Backup Postgres", 03:30, SYSTEM).
# pg_dump do banco "kartodromo" (formato custom) em F:\bkp\kartodromo-pg, guardando 14 dias.
# A copia fora do predio e a replica na VPS (assinatura sub_srvkart), que entra no backup diario da VPS.
# Restaurar: pg_restore -h 127.0.0.1 -U postgres -d kartodromo --clean --if-exists <arquivo.dump>
# Avisa o Uptime Kuma (monitor push "Backup Postgres SRVKART"); sem aviso em 25 h, o monitor cai.
$ErrorActionPreference = 'Stop'
$raiz = 'C:\kartodromo-servidor'
$pasta = 'F:\bkp\kartodromo-pg'
$log = Join-Path $raiz '.runtime\backup-postgres.log'
$kuma = 'https://status.kartodromodebetim.com.br/api/push/JWIwlPJ5g9'
function Log($m) { "$(Get-Date -Format s) $m" | Add-Content -Path $log -Encoding UTF8 }
function Avisa($status, $msg) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 ("{0}?status={1}&msg={2}" -f $kuma, $status, [uri]::EscapeDataString($msg)) | Out-Null } catch { Log "aviso ao Kuma falhou: $($_.Exception.Message)" }
}
try {
  $url = (Get-Content (Join-Path $raiz '.env.local') | Where-Object { $_ -match '^\s*OPS_PG_URL\s*=' } | Select-Object -First 1) -replace '^\s*OPS_PG_URL\s*=\s*', ''
  if (-not $url) { throw 'OPS_PG_URL ausente no .env.local' }
  New-Item -ItemType Directory -Force $pasta | Out-Null
  $arq = Join-Path $pasta ("kartodromo-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  & 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' -d $url -n kart -Fc -Z 6 -f $arq
  if ($LASTEXITCODE -ne 0) { throw "pg_dump saiu com $LASTEXITCODE" }
  $tam = [math]::Round((Get-Item $arq).Length / 1MB, 1)
  Get-ChildItem $pasta -Filter 'kartodromo-*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Force
  Log "ok $arq ($tam MB)"
  Avisa 'up' "$tam MB"
} catch {
  Log "FALHOU: $($_.Exception.Message)"
  Avisa 'down' $_.Exception.Message
  exit 1
}

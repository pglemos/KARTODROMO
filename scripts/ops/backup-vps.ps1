# Cópia fora da VPS dos backups dela (tarefa "Kartodromo Backup VPS", 05:00, SYSTEM).
# Busca pelo WireGuard (10.66.0.1) com o usuário backupsrv (só leitura, preso em /srv/backup-out) as pastas dos
# últimos 3 dias para F:\bkp\vps\<dia>. Os arquivos já vêm cifrados com age (chaves do Mac e da VPS): aqui não se lê nada.
# Guarda 30 dias. Avisa o Uptime Kuma (monitor push "Backup da VPS no SRVKART"); sem aviso em 25 h, o monitor cai.
$ErrorActionPreference = 'Stop'
$chave = 'C:\ProgramData\kartodromo-backup-vps'
$destino = 'F:\bkp\vps'
$log = 'C:\kartodromo-servidor\.runtime\backup-vps.log'
$kuma = 'https://status.kartodromodebetim.com.br/api/push/SpZQDJSmi9'
$sftp = 'C:\Windows\System32\OpenSSH\sftp.exe'
function Log($m) { "$(Get-Date -Format s) $m" | Add-Content -Path $log -Encoding UTF8 }
function Avisa($status, $msg) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 ("{0}?status={1}&msg={2}" -f $kuma, $status, [uri]::EscapeDataString($msg)) | Out-Null } catch { Log "aviso ao Kuma falhou: $($_.Exception.Message)" }
}
try {
  New-Item -ItemType Directory -Force $destino | Out-Null
  $dias = 0..2 | ForEach-Object { (Get-Date).AddDays(-$_).ToString('yyyy-MM-dd') }
  # '-' na frente: dia que ainda não existe na VPS não interrompe o lote
  $lote = ($dias | ForEach-Object { "-get -r vps/$_ $destino/" }) -join "`n"
  Set-Content -Encoding ASCII "$chave\lote.txt" $lote
  # o sftp escreve avisos no stderr; no PowerShell 5 isso vira exceção com 'Stop'
  $ErrorActionPreference = 'Continue'
  $saida = & $sftp -i "$chave\id_ed25519" -o BatchMode=yes -o UserKnownHostsFile="$chave\known_hosts" -o ConnectTimeout=30 -b "$chave\lote.txt" backupsrv@10.66.0.1 2>&1 | Out-String
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0 -and $saida -notmatch 'not found') { Log "sftp: $($saida.Trim())" }
  $hoje = Join-Path $destino $dias[0]
  $ontem = Join-Path $destino $dias[1]
  $recente = @($hoje, $ontem) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $recente) { throw 'nenhum backup de hoje nem de ontem chegou' }
  $arq = Get-ChildItem $recente -File
  if (-not ($arq | Where-Object { $_.Name -like 'fisico-*' }) -or -not ($arq | Where-Object { $_.Name -like 'edge-*' })) { throw "backup incompleto em $recente" }
  $mb = [math]::Round(($arq | Measure-Object Length -Sum).Sum / 1MB, 0)
  Get-ChildItem $destino -Directory | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Recurse -Force
  Log "ok $recente ($($arq.Count) arquivos, $mb MB)"
  Avisa 'up' "$(Split-Path $recente -Leaf) $mb MB"
} catch {
  Log "FALHOU: $($_.Exception.Message)"
  Avisa 'down' $_.Exception.Message
  exit 1
}

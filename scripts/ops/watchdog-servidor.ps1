# Vigia E iniciador do servidor da operacao (porta 4060). Roda a cada minuto e no boot, como SYSTEM (tarefa "Kartodromo Servidor Watchdog").
# A tarefa antiga "Kartodromo Servidor" foi desativada: subir por ela travava mudo de vez em quando (causa nao achada).
# Se /healthz falhar 2 vezes seguidas (event loop travado, processo mudo ou fora do ar), derruba tudo e sobe de novo,
# com ate 3 tentativas. O servidor e iniciado por Win32_Process.Create: sobrevive ao fim desta tarefa (filho de tarefa agendada morre junto).
$ErrorActionPreference = 'Continue'
$raiz = 'C:\kartodromo-servidor'
$rt = Join-Path $raiz '.runtime'
$logWd = Join-Path $rt 'watchdog.log'
$cont = Join-Path $rt 'watchdog.falhas'
function Log($m) { "$(Get-Date -Format s) $m" | Add-Content -Path $logWd -Encoding UTF8 }
function Saudavel { try { (Invoke-WebRequest 'http://localhost:4060/healthz' -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 } catch { $false } }
function ProcServidor { Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'services/ops-server' -and $_.Name -match 'node|cmd' } }

# trava para nao rodar duas vezes ao mesmo tempo
$mutex = New-Object System.Threading.Mutex($false, 'Global\KartodromoServidorWatchdog')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  if (Test-Path $logWd) { if ((Get-Item $logWd).Length -gt 2MB) { Move-Item $logWd "$logWd.old" -Force } }
  if (Saudavel) { if (Test-Path $cont) { Remove-Item $cont -Force }; exit 0 }

  # subindo agora (boot ou reinicio recente): da 2 min de graca
  $novo = ProcServidor | Where-Object { $_.Name -eq 'node.exe' -and $_.CreationDate -gt (Get-Date).AddMinutes(-2) }
  if ($novo) { Log 'sem resposta, mas o processo subiu ha menos de 2 min: aguardando'; exit 0 }

  $n = 1; if (Test-Path $cont) { $n = [int](Get-Content $cont -ErrorAction SilentlyContinue) + 1 }
  if (-not (ProcServidor)) { $n = 2 } # nenhum processo (boot ou queda): sobe na hora, sem esperar a segunda falha
  Set-Content $cont $n
  if ($n -lt 2) { Log "healthz falhou ($n/2)"; exit 0 }

  Log "healthz falhou $n vezes: reiniciando"
  # antes de matar, guarda a pilha do processo travado (inspetor em 127.0.0.1:9229, outra thread) para achar a causa depois
  try {
    $pilha = Join-Path $rt ("travado-{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $o = & 'C:\Program Files\nodejs\node.exe' (Join-Path $raiz 'scripts\ops\capturar-pilha.mjs') 2>&1 | Out-String
    Set-Content $pilha $o -Encoding UTF8
    Log "pilha do processo travado em $pilha"
    Get-ChildItem $rt -Filter 'travado-*.txt' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 20 | Remove-Item -Force -ErrorAction SilentlyContinue
  } catch { Log "captura de pilha falhou: $($_.Exception.Message)" }
  for ($t = 1; $t -le 3; $t++) {
    Stop-ScheduledTask -TaskName 'Kartodromo Servidor' -ErrorAction SilentlyContinue
    ProcServidor | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep 3
    $cmd = 'cmd.exe /c ""C:\Program Files\nodejs\node.exe" --require "C:\kartodromo-servidor\node_modules\tsx\dist\preflight.cjs" --inspect=127.0.0.1:9229 --import "file:///C:/kartodromo-servidor/node_modules/tsx/dist/loader.mjs" services/ops-server.ts >> .runtime\ops-server.log 2>&1"'
    $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $raiz }
    Log "tentativa $t : Create rc=$($r.ReturnValue) pid=$($r.ProcessId)"
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) { Start-Sleep 3; if (Saudavel) { $ok = $true; break } }
    if ($ok) { Log "servidor no ar (tentativa $t)"; Remove-Item $cont -Force -ErrorAction SilentlyContinue; exit 0 }
    Log "tentativa $t sem resposta em 90 s"
  }
  Log 'FALHOU: 3 tentativas sem sucesso'
} finally { $mutex.ReleaseMutex() }

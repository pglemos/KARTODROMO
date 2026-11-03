param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'

# Item 33: Trava de manutenção manual (se o arquivo MANUTENCAO.lock existir, não inicia o serviço)
$lockFile = 'C:\repos\KARTODROMO\data\timing\MANUTENCAO.lock'
if (Test-Path -LiteralPath $lockFile) {
    Write-Output 'MANUTENCAO_ATIVA: serviço em manutenção manual, vigia pausado.'
    exit 0
}

# Recupera somente um servidor ausente. Nunca encerra processo, muda bateria ou reinicia decoder.
$taskName = 'KartodromoCronometragem'
$listener = Get-NetTCPConnection -LocalPort 4050 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Write-Output 'SERVIDOR_PRESENTE'; exit 0 }
$task = Get-ScheduledTask -TaskName $taskName
if ($task.State -in @('Running', 'Queued')) { Write-Output 'INICIALIZACAO_EM_ANDAMENTO'; exit 0 }
if ($CheckOnly) { Write-Output 'RECUPERACAO_NECESSARIA'; exit 0 }
Start-ScheduledTask -TaskName $taskName
$log = 'C:\repos\KARTODROMO\data\timing\vigia.log'
if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) {
    Move-Item -LiteralPath $log -Destination "$log.anterior" -Force
}
Add-Content -LiteralPath $log -Value "$(Get-Date -Format o) Servidor ausente; tarefa iniciada, arquivos de corrida preservados."

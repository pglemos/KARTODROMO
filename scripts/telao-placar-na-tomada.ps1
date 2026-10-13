<#
  Telão de LED (TB50 via HDMI do PC .250) passando VÍDEO: assim que começar a tomada de tempo de um evento
  (sessão do tipo classificacao cujo nome casa com -Evento), troca o painel de volta para o PLACAR e encerra.
    .\scripts\telao-placar-na-tomada.ps1 -Evento 'ULTRAS'
  O que faz ao disparar: no .250 roda a tarefa "Kartodromo Placar Telao" (fecha o Chrome do vídeo e abre o placar
  localhost:3000/placar-telao-tb50 na sessão da tela); no SRVKART volta o programa CRONOMETRAGEM do TB50 e religa o
  vigia "Kartodromo TB50 Podium Watchdog". Log: data\timing\telao-video.log. Credencial: scripts\apps\credencial.ps1.
#>
param(
  [string]$Evento = 'ULTRAS',
  [string]$Cronometragem = 'http://127.0.0.1:4050',
  [datetime]$Ate = (Get-Date).Date.AddHours(23).AddMinutes(59)
)
$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot '..\data\timing\telao-video.log'
function Log($m) { "$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') $m" | Out-File $log -Append -Encoding UTF8 }
. (Join-Path $PSScriptRoot 'apps\credencial.ps1')
$cred = Obter-CredencialKartodromo

Log "esperando a tomada de tempo de '$Evento' para trocar o vídeo pelo placar (até $($Ate.ToString('HH:mm')))"
$sessao = $null
while ((Get-Date) -lt $Ate -and -not $sessao) {
  try {
    $st = Invoke-RestMethod "$Cronometragem/api/state" -TimeoutSec 5
    $sessao = @($st.sessions) | Where-Object { $_.id -eq $st.runningId -and $_.type -eq 'classificacao' -and $_.name -match [regex]::Escape($Evento) } | Select-Object -First 1
  } catch { }
  if (-not $sessao) { Start-Sleep -Seconds 3 }
}
if (-not $sessao) { Log "não começou tomada de '$Evento' até $($Ate.ToString('HH:mm')); vídeo continua"; exit 0 }

Log "começou '$($sessao.name)': trocando o telão para o placar"
try {
  Invoke-Command -ComputerName 192.168.20.250 -Credential $cred -ScriptBlock {
    Start-ScheduledTask 'Kartodromo Placar Telao'; Start-Sleep 8
    Get-Content 'C:\KARTODROMO\telao\.runtime\video-telao\lancar.log' -Tail 1
  } | ForEach-Object { Log ".250: $_" }
} catch { Log "ERRO no .250: $($_.Exception.Message)" }
try {
  Invoke-Command -ComputerName 192.168.20.13 -Credential $cred -ScriptBlock {
    Set-Location C:\KARTODROMO-TB50
    & 'C:\Program Files\nodejs\node.exe' node_modules\tsx\dist\cli.mjs scripts\configure-tb50-podium.ts 2>&1 | Select-Object -Last 1
    Enable-ScheduledTask 'Kartodromo TB50 Podium Watchdog' | Out-Null
    'vigia do TB50 religado'
  } | ForEach-Object { Log "SRVKART: $_" }
} catch { Log "ERRO no SRVKART: $($_.Exception.Message)" }
Log 'telão de volta ao placar'

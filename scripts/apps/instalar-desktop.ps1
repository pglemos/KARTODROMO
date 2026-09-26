<#
  Instala um programa do Kartodromo (Windows, .NET self-contained) num PC. Roda como administrador,
  local ou via Invoke-Command. Substitui os antigos atalhos do Chrome (--app) de instalar-app.ps1.

    instalar-desktop.ps1 -App Recepcao        -Origem D:\pacote\Recepcao
    instalar-desktop.ps1 -App Autoatendimento -Origem D:\pacote\Autoatendimento -Impressora "EPSON TM-T20 Receipt"
    instalar-desktop.ps1 -App Cronometragem   -Origem D:\pacote\Cronometragem [-TvNoLogon]

  - copia para C:\Program Files\Kartodromo\<App> e grava o appsettings.json
  - atalhos no Menu Iniciar (pasta Kartódromo) e na Area de Trabalho publica
  - Autoatendimento inicia sozinho no logon (tela cheia travada; equipe sai com Ctrl+Shift+Alt+S)
  - Cronometragem instala tambem o atalho "Kartódromo TV" (telao na 2a tela)
  - registra em Aplicativos instalados (Adicionar/Remover programas) com desinstalador
  - remove os lancadores antigos do Chrome (C:\KartodromoApps\<App>, atalhos .vbs)
#>
param(
  [Parameter(Mandatory)][ValidateSet('Recepcao', 'Autoatendimento', 'Cronometragem')][string]$App,
  [Parameter(Mandatory)][string]$Origem,
  [string]$ServidorUrl = 'http://192.168.20.13:4060',
  [string]$CronometragemUrl = 'http://192.168.20.249:4050',
  [string]$Impressora = '',
  [switch]$IniciarNoLogon,
  [switch]$TvNoLogon
)
$ErrorActionPreference = 'Stop'

$meta = @{
  Recepcao        = @{ Nome = 'Kartódromo Recepção' }
  Autoatendimento = @{ Nome = 'Kartódromo Autoatendimento' }
  Cronometragem   = @{ Nome = 'Kartódromo Cronometragem' }
}[$App]
$exeNome = "Kartodromo.$App.exe"
$destino = "$env:ProgramFiles\Kartodromo\$App"
$exe = Join-Path $destino $exeNome
if (-not (Test-Path (Join-Path $Origem $exeNome))) { throw "Nao achei $exeNome em $Origem" }

# ---------- fecha versao aberta e o lancador antigo do Chrome
Get-Process -Name "Kartodromo.$App" -ErrorAction SilentlyContinue | Stop-Process -Force
$antigos = @($App) + $(if ($App -eq 'Cronometragem') { 'TV' } else { @() })
foreach ($a in $antigos) {
  Get-CimInstance Win32_Process -Filter "Name='wscript.exe'" | Where-Object { $_.CommandLine -like "*KartodromoApps\$a\*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*KartodromoApps\$a*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 800

# ---------- copia
New-Item -ItemType Directory -Force $destino | Out-Null
Copy-Item (Join-Path $Origem '*') $destino -Recurse -Force
$cfg = [ordered]@{ ServidorUrl = $ServidorUrl; CronometragemUrl = $CronometragemUrl }
if ($App -eq 'Autoatendimento') { $cfg.Impressora = $Impressora }
if ($App -eq 'Cronometragem') { $cfg.TvModo = 'placar' }
[IO.File]::WriteAllText("$destino\appsettings.json", ($cfg | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))

# ---------- atalhos
$shell = New-Object -ComObject WScript.Shell
function Novo-Atalho($arquivo, $argumentos = '', $descricao = $meta.Nome) {
  $s = $shell.CreateShortcut($arquivo)
  $s.TargetPath = $exe
  $s.Arguments = $argumentos
  $s.WorkingDirectory = $destino
  $s.IconLocation = "$exe,0"
  $s.Description = $descricao
  $s.Save()
}
$menu = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Kartódromo"
$startup = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp"
New-Item -ItemType Directory -Force $menu | Out-Null
Novo-Atalho "$menu\$($meta.Nome).lnk"
Novo-Atalho "$env:PUBLIC\Desktop\$($meta.Nome).lnk"
if ($IniciarNoLogon -or $App -eq 'Autoatendimento') { Novo-Atalho "$startup\$($meta.Nome).lnk" }
elseif (Test-Path "$startup\$($meta.Nome).lnk") { Remove-Item "$startup\$($meta.Nome).lnk" -Force }
if ($App -eq 'Cronometragem') {
  Novo-Atalho "$menu\Kartódromo TV.lnk" '--tv' 'Telão da cronometragem'
  Novo-Atalho "$env:PUBLIC\Desktop\Kartódromo TV.lnk" '--tv' 'Telão da cronometragem'
  if ($TvNoLogon) { Novo-Atalho "$startup\Kartódromo TV.lnk" '--tv' 'Telão da cronometragem' }
  elseif (Test-Path "$startup\Kartódromo TV.lnk") { Remove-Item "$startup\Kartódromo TV.lnk" -Force }
}

# ---------- limpa os lancadores antigos do Chrome
foreach ($a in $antigos) { if (Test-Path "C:\KartodromoApps\$a") { Remove-Item "C:\KartodromoApps\$a" -Recurse -Force -ErrorAction SilentlyContinue } }
Get-ChildItem "$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:PUBLIC\Desktop" -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  $l = $shell.CreateShortcut($_.FullName)
  if ($l.TargetPath -like '*wscript.exe' -and $l.Arguments -like '*KartodromoApps*') { Remove-Item $_.FullName -Force }
}

# ---------- desinstalador + Aplicativos instalados
$desinst = @"
`$ErrorActionPreference = 'SilentlyContinue'
Get-Process -Name 'Kartodromo.$App' | Stop-Process -Force
Remove-Item "$menu\$($meta.Nome).lnk", "$env:PUBLIC\Desktop\$($meta.Nome).lnk", "$startup\$($meta.Nome).lnk" -Force
$(if ($App -eq 'Cronometragem') { "Remove-Item `"$menu\Kartódromo TV.lnk`", `"$env:PUBLIC\Desktop\Kartódromo TV.lnk`", `"$startup\Kartódromo TV.lnk`" -Force" })
Remove-Item 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Kartodromo.$App' -Recurse -Force
Start-Process cmd.exe -ArgumentList '/c timeout /t 2 >nul & rmdir /s /q "$destino"' -WindowStyle Hidden
"@
[IO.File]::WriteAllText("$destino\desinstalar.ps1", $desinst, (New-Object Text.UTF8Encoding $true))
$versao = (Get-Item $exe).VersionInfo.ProductVersion -replace '\+.*$', ''
$chave = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Kartodromo.$App"
New-Item $chave -Force | Out-Null
$props = @{
  DisplayName = $meta.Nome; DisplayVersion = $versao; Publisher = 'Kartódromo Internacional de Betim'; InstallLocation = $destino
  DisplayIcon = "$exe,0"; UninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$destino\desinstalar.ps1`""; NoModify = 1; NoRepair = 1
  EstimatedSize = [int]((Get-ChildItem $destino -Recurse | Measure-Object Length -Sum).Sum / 1KB)
}
foreach ($k in $props.Keys) { Set-ItemProperty $chave -Name $k -Value $props[$k] }

# ---------- WebView2 (relatorios, termo e impressao)
$wv = @('HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}') |
  ForEach-Object { (Get-ItemProperty $_ -ErrorAction SilentlyContinue).pv } | Where-Object { $_ -and $_ -ne '0.0.0.0' } | Select-Object -First 1
"OK: $($meta.Nome) $versao em $destino (WebView2: $(if ($wv) { $wv } else { 'NAO ENCONTRADO - instale o Microsoft Edge WebView2 Runtime' }))"

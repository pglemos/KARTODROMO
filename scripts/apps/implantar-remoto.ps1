<#
  Implanta um programa publicado (desktop\publish\<App>) numa máquina remota via WinRM, abre na sessão do usuário
  logado e salva um print da tela. Credencial: a do usuário logado (salvar-credencial.ps1), fora do repositório.
    implantar-remoto.ps1 -Computador 192.168.20.69 -App Autoatendimento -Impressora "EPSON TM-T20 Receipt" -Print C:\temp\tela.png
#>
param(
  [Parameter(Mandatory)][string]$Computador,
  [Parameter(Mandatory)][ValidateSet('Recepcao', 'Autoatendimento', 'Cronometragem')][string]$App,
  [string]$Impressora = '',
  [string]$Print = ''
)
$ErrorActionPreference = 'Stop'
$pub = Join-Path $PSScriptRoot "..\..\desktop\publish\$App"
$inst = Join-Path $PSScriptRoot 'instalar-desktop.ps1'
. (Join-Path $PSScriptRoot 'credencial.ps1')
$cred = Obter-CredencialKartodromo
$d = "C:\Windows\Temp\kartodromo-pkg-$(Get-Date -Format yyyyMMddHHmmss)\$App"
$s = New-PSSession -ComputerName $Computador -Credential $cred
try {
  Invoke-Command -Session $s { param($d) New-Item -ItemType Directory -Force $d | Out-Null } -ArgumentList $d
  foreach ($f in Get-ChildItem $pub -File) { Copy-Item $f.FullName "$d\$($f.Name)" -ToSession $s -Force }
  Copy-Item $inst "$d\instalar-desktop.ps1" -ToSession $s -Force
  $hl = (Get-FileHash "$pub\Kartodromo.$App.exe").Hash
  $args2 = @{ Impressora = $Impressora }
  Invoke-Command -Session $s -ArgumentList $d, $hl, $App, $Impressora -ScriptBlock {
    param($d, $hl, $App, $Impressora)
    if ((Get-FileHash "$d\Kartodromo.$App.exe").Hash -ne $hl) { throw 'hash do pacote diferente' }
    Set-ExecutionPolicy -Scope Process Bypass -Force
    $extra = @{}; if ($App -eq 'Autoatendimento') { $extra.Impressora = $Impressora }
    & "$d\instalar-desktop.ps1" -App $App -Origem $d @extra
    $exe = "$env:ProgramFiles\Kartodromo\$App\Kartodromo.$App.exe"
    "instalado: " + (Get-FileHash $exe).Hash.Substring(0, 16)
    $user = (Get-CimInstance Win32_ComputerSystem).UserName
    if (-not $user) { "sem usuário logado"; return }
    $pr = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive
    Register-ScheduledTask KartodromoAbrir -Action (New-ScheduledTaskAction -Execute $exe -WorkingDirectory (Split-Path $exe)) -Principal $pr -Force | Out-Null
    Start-ScheduledTask KartodromoAbrir; Start-Sleep 10; Unregister-ScheduledTask KartodromoAbrir -Confirm:$false
    $shot = "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; `$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; `$bmp=New-Object Drawing.Bitmap `$b.Width,`$b.Height; `$g=[Drawing.Graphics]::FromImage(`$bmp); `$g.CopyFromScreen(`$b.Left,`$b.Top,0,0,`$bmp.Size); `$bmp.Save('C:\Users\Public\kartodromo-tela.png')"
    [IO.File]::WriteAllText('C:\Users\Public\kartodromo-tela.ps1', $shot)
    # conhost --headless: no Windows 11 o Terminal ignora -WindowStyle Hidden e mostraria uma janela preta na tela do usuário
    Register-ScheduledTask KartodromoTela -Action (New-ScheduledTaskAction -Execute conhost.exe -Argument '--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Users\Public\kartodromo-tela.ps1') -Principal $pr -Force | Out-Null
    Start-ScheduledTask KartodromoTela; Start-Sleep 6; Unregister-ScheduledTask KartodromoTela -Confirm:$false
    "usuário: $user | processo: " + ((Get-Process "Kartodromo.$App" -EA 0 | ForEach-Object { "$($_.Id)/sessão $($_.SessionId)/janela '$($_.MainWindowTitle)'" }) -join ', ')
  }
  if ($Print) {
    $png = Invoke-Command -Session $s { if (Test-Path C:\Users\Public\kartodromo-tela.png) { [IO.File]::ReadAllBytes('C:\Users\Public\kartodromo-tela.png') } }
    if ($png) { [IO.File]::WriteAllBytes($Print, [byte[]]$png); "print: $Print" }
  }
} finally { Remove-PSSession $s }

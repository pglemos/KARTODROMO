<#
  Instala um app do Kartodromo num PC Windows (roda como administrador, local ou via Invoke-Command -FilePath).

    instalar-app.ps1 -App Recepcao      -Url "http://192.168.20.13:4060/recepcao"
    instalar-app.ps1 -App Autoatendimento -Url "http://192.168.20.13:4060/totem" -Impressora "EPSON TM-T20 Receipt"
    instalar-app.ps1 -App Cronometragem -Url "http://192.168.20.249:4050/"
    instalar-app.ps1 -App TV            -Url "http://192.168.20.249:4050/tv"

  Cada app e uma janela dedicada do Chrome (--app, sem barra de endereco) com perfil proprio,
  icone proprio, atalho no Menu Iniciar e na Area de Trabalho publica. O Autoatendimento abre em
  modo quiosque (tela cheia travada), imprime o termo direto na impressora padrao sem dialogo
  (--kiosk-printing), inicia sozinho no logon e se reabre se for fechado.
  -DesativarLapTime tira da inicializacao os atalhos do LapTime (movidos pra uma pasta de backup).
#>
param(
  [Parameter(Mandatory)][ValidateSet('Recepcao', 'Autoatendimento', 'Cronometragem', 'TV')][string]$App,
  [Parameter(Mandatory)][string]$Url,
  [string]$Impressora = '',
  [switch]$IniciarNoLogon,
  [switch]$DesativarLapTime
)
$ErrorActionPreference = 'Stop'

$meta = @{
  Recepcao        = @{ Nome = 'Kartódromo Recepção';        Letra = 'R';  Cor = '#007a3d' }
  Autoatendimento = @{ Nome = 'Kartódromo Autoatendimento'; Letra = 'A';  Cor = '#1f5fbf' }
  Cronometragem   = @{ Nome = 'Kartódromo Cronometragem';   Letra = 'C';  Cor = '#c8323a' }
  TV              = @{ Nome = 'Kartódromo TV';              Letra = 'TV'; Cor = '#111111' }
}[$App]

$base = "C:\KartodromoApps\$App"
New-Item -ItemType Directory -Force $base | Out-Null

# ---------- navegador
$browser = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Nem Chrome nem Edge instalados.' }

# ---------- icone (PNG 256px dentro de um .ico)
Add-Type -AssemblyName System.Drawing
$bmp = New-Object Drawing.Bitmap 256, 256
$g = [Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([Drawing.Color]::Transparent)
$path = New-Object Drawing.Drawing2D.GraphicsPath
$r = 56; $path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc(256 - $r, 0, $r, $r, 270, 90); $path.AddArc(256 - $r, 256 - $r, $r, $r, 0, 90); $path.AddArc(0, 256 - $r, $r, $r, 90, 90); $path.CloseFigure()
$g.FillPath((New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml($meta.Cor))), $path)
# faixa quadriculada no topo
for ($i = 0; $i -lt 8; $i++) { for ($j = 0; $j -lt 2; $j++) { if (($i + $j) % 2 -eq 0) { $g.FillRectangle([Drawing.Brushes]::White, 32 + $i * 24, 26 + $j * 16, 24, 16) } } }
$font = New-Object Drawing.Font('Segoe UI', $(if ($meta.Letra.Length -gt 1) { 104 } else { 140 }), [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$sf = New-Object Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
$g.DrawString($meta.Letra, $font, [Drawing.Brushes]::White, (New-Object Drawing.RectangleF 0, 40, 256, 216), $sf)
$ms = New-Object IO.MemoryStream; $bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png); $png = $ms.ToArray()
$ico = "$base\icone.ico"
$bw = New-Object IO.BinaryWriter([IO.File]::Create($ico))
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]1)
$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]$png.Length); $bw.Write([uint32]22); $bw.Write($png); $bw.Close()
$g.Dispose(); $bmp.Dispose()

# ---------- lancador (.vbs: sem janela de console, perfil por usuario em %LOCALAPPDATA%)
$flags = @('--no-first-run', '--no-default-browser-check', '--disable-features=Translate,TranslateUI', '--disable-session-crashed-bubble', '--noerrdialogs')
switch ($App) {
  'Autoatendimento' { $flags += @('--kiosk', '--kiosk-printing', '--disable-pinch', '--overscroll-history-navigation=0', '--disable-infobars') }
  'TV'              { $flags += @('--kiosk') }
  default           { $flags += @('--start-maximized') }
}
$q = '""'
$cmd = "$q$browser$q --app=$q$Url$q --user-data-dir=$q`" & profile & `"$q " + ($flags -join ' ')
$printerLine = if ($Impressora) { "sh.Run ""rundll32 printui.dll,PrintUIEntry /y /n """"$Impressora"""""", 0, True" } else { "" }
$loop = $App -eq 'Autoatendimento'
$vbs = @"
' Gerado por scripts/apps/instalar-app.ps1 ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))
Set sh = CreateObject("WScript.Shell")
profile = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\KartodromoApps\$App"
$printerLine
$(if ($loop) { "Do`r`n  sh.Run ""$cmd"", 1, True`r`n  WScript.Sleep 3000`r`nLoop" } else { "sh.Run ""$cmd"", 1, False" })
"@
[IO.File]::WriteAllText("$base\abrir.vbs", $vbs, [Text.Encoding]::ASCII)

# ---------- atalhos
$shell = New-Object -ComObject WScript.Shell
function New-Shortcut($file) {
  $s = $shell.CreateShortcut($file)
  $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $s.Arguments = "`"$base\abrir.vbs`""
  $s.IconLocation = "$ico,0"
  $s.WorkingDirectory = $base
  $s.Description = $meta.Nome
  $s.Save()
}
$startMenu = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Kartódromo"
New-Item -ItemType Directory -Force $startMenu | Out-Null
New-Shortcut "$startMenu\$($meta.Nome).lnk"
New-Shortcut "$env:PUBLIC\Desktop\$($meta.Nome).lnk"
$startup = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\$($meta.Nome).lnk"
if ($IniciarNoLogon -or $App -eq 'Autoatendimento') { New-Shortcut $startup } elseif (Test-Path $startup) { Remove-Item $startup }

# ---------- tira o LapTime da inicializacao (reversivel: vai pra pasta de backup)
if ($DesativarLapTime) {
  $bk = 'C:\KartodromoApps\_laptime_desativado'
  New-Item -ItemType Directory -Force $bk | Out-Null
  $pastas = @("$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp") + (Get-ChildItem C:\Users -Directory | ForEach-Object { "$($_.FullName)\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup" })
  foreach ($p in $pastas) {
    if (-not (Test-Path $p)) { continue }
    Get-ChildItem $p -Filter '*.lnk' | Where-Object { $_.Name -match 'LapTime' } | ForEach-Object {
      $destino = Join-Path $bk ("{0}__{1}" -f ($p -replace '[\\:]', '_').Substring(0, [Math]::Min(60, $p.Length)), $_.Name)
      Move-Item $_.FullName $destino -Force
      "LapTime removido da inicializacao: $($_.FullName)"
    }
  }
}

"OK: $($meta.Nome) -> $Url ($browser)"

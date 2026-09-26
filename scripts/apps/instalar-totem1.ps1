$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra o PowerShell como Administrador e execute este instalador novamente.'
}

$source = Join-Path $PSScriptRoot 'Autoatendimento'
$installer = Join-Path $PSScriptRoot 'instalar-desktop.ps1'
$exe = Join-Path $source 'Kartodromo.Autoatendimento.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "Executavel nao encontrado: $exe" }
if (-not (Test-Path -LiteralPath $installer)) { throw "Instalador comum nao encontrado: $installer" }

$printer = Get-Printer -ErrorAction Stop |
  Where-Object { $_.Name -match '(?i)TM.?T20' } |
  Select-Object -First 1
if (-not $printer) {
  throw 'Nao encontrei uma impressora TM-T20. Instale/configure a impressora e rode novamente.'
}

& $installer -App Autoatendimento -Origem $source -Impressora $printer.Name
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Instalador terminou com codigo $LASTEXITCODE" }

$installed = Join-Path $env:ProgramFiles 'Kartodromo\Autoatendimento\Kartodromo.Autoatendimento.exe'
if (-not (Test-Path -LiteralPath $installed)) { throw "Instalacao nao encontrada: $installed" }
Start-Process -FilePath $installed -WorkingDirectory (Split-Path $installed)
Write-Host "Autoatendimento instalado e iniciado. Impressora: $($printer.Name)"

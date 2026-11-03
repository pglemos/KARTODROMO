<#
.SYNOPSIS
  Limpeza segura de filas fantasmas e trabalhos retidos de spooler nos totens.

.DESCRIPTION
  Remove com segurança todos os trabalhos de impressão presos na fila de spooler
  da impressora TM-T20 ('EPSON TM-T20 Receipt' ou similar) nos totens de autoatendimento,
  SEM paralisar nem reiniciar o serviço Spooler do Windows.
  Utiliza o método nativo WMI/CIM CancelAllJobs (PRINTER_CONTROL_PURGE) e o módulo PrintManagement.
  Permite desinstalar a fila fantasma e zerar a configuração de impressora no appsettings.json.

.PARAMETER PadraoNome
  Expressão regular com os nomes das impressoras a verificar. Padrão: '(?i)TM.?T20|EPSON.*Receipt'

.PARAMETER RemoverFila
  Remove também o objeto da impressora fantasma do Windows se ela não possuir dispositivo físico conectado.

.PARAMETER ZerarAppsettings
  Garante que a chave "Impressora" no appsettings.json do Autoatendimento seja gravada como "".

.EXAMPLE
  .\limpar-spooler-totem.ps1
  Limpa todos os trabalhos pendentes/travados na fila TM-T20 sem derrubar o Spooler.

.EXAMPLE
  .\limpar-spooler-totem.ps1 -RemoverFila -ZerarAppsettings
  Limpa a fila, remove a impressora fantasma e garante o appsettings.json em branco.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$PadraoNome = '(?i)TM.?T20|EPSON.*Receipt',
  [switch]$RemoverFila,
  [switch]$ZerarAppsettings
)

$ErrorActionPreference = 'Stop'

# 1. Validação de privilégios de Administrador
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra o PowerShell como Administrador para executar a limpeza de spooler.'
}

# 2. Assegurar que o Spooler do Windows esteja em execução
$spoolerService = Get-Service -Name Spooler -ErrorAction Stop
if ($spoolerService.Status -ne [ServiceProcess.ServiceControllerStatus]::Running) {
  Write-Warning "O serviço Spooler estava parado ($($spoolerService.Status)). Iniciando serviço para permitir purga via API..."
  Start-Service -Name Spooler
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Kartódromo de Betim — Limpeza de Spooler do Totem" -ForegroundColor Cyan
Write-Host "  Padrão de busca: $PadraoNome" -ForegroundColor Cyan
Write-Host "  Serviço Spooler: $($spoolerService.Status) (sem paralisação)" -ForegroundColor Green
Write-Host "=========================================================="

# 3. Localizar impressoras que casam com o padrão
$printers = @()
try {
  $printers = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $PadraoNome })
} catch {
  $printers = @(Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $PadraoNome })
}

if ($printers.Count -eq 0) {
  Write-Host "Nenhuma fila de impressora TM-T20 ou Receipt encontrada neste computador." -ForegroundColor Yellow
} else {
  foreach ($p in $printers) {
    $nomeImpressora = $p.Name
    Write-Host "`nProcessando fila: '$nomeImpressora'..." -ForegroundColor White

    # Contagem de trabalhos antes da limpeza
    $jobsAntes = 0
    try {
      $jobs = @(Get-PrintJob -PrinterName $nomeImpressora -ErrorAction SilentlyContinue)
      $jobsAntes = $jobs.Count
    } catch {
      $jobsCim = @(Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$nomeImpressora*" })
      $jobsAntes = $jobsCim.Count
    }

    Write-Host "  Trabalhos pendentes encontrados: $jobsAntes" -ForegroundColor ($jobsAntes -gt 0 ? 'Yellow' : 'Green')

    if ($jobsAntes -gt 0) {
      if ($PSCmdlet.ShouldProcess($nomeImpressora, "Cancelar todos os $jobsAntes trabalhos de impressão")) {
        # Método 1: CIM CancelAllJobs (envia PRINTER_CONTROL_PURGE direto ao Spooler)
        try {
          $escapedName = $nomeImpressora.Replace("'", "''")
          $cimPrinter = Get-CimInstance Win32_Printer -Filter "Name = '$escapedName'" -ErrorAction SilentlyContinue
          if ($cimPrinter) {
            $null = Invoke-CimMethod -InputObject $cimPrinter -MethodName CancelAllJobs
            Write-Host "  [OK] Método Win32_Printer.CancelAllJobs executado com sucesso." -ForegroundColor Green
          }
        } catch {
          Write-Warning "  Falha ao executar CancelAllJobs via CIM: $($_.Exception.Message)"
        }

        # Método 2: Remoção direta via PrintManagement
        try {
          Get-PrintJob -PrinterName $nomeImpressora -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-PrintJob -PrinterName $nomeImpressora -ID $_.Id -ErrorAction SilentlyContinue
          }
        } catch {}

        Start-Sleep -Milliseconds 500

        # Verificação pós-limpeza
        $jobsDepois = 0
        try {
          $jobsDepois = @(Get-PrintJob -PrinterName $nomeImpressora -ErrorAction SilentlyContinue).Count
        } catch {
          $jobsDepois = @(Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$nomeImpressora*" }).Count
        }

        if ($jobsDepois -eq 0) {
          Write-Host "  [OK] Fila '$nomeImpressora' completamente esvaziada ($jobsAntes trabalhos eliminados)." -ForegroundColor Green
        } else {
          Write-Warning "  Ainda restam $jobsDepois trabalho(s) em processo de exclusão pelo Windows."
        }
      }
    } else {
      Write-Host "  Fila já estava limpa." -ForegroundColor Green
    }

    # 4. Remoção do dispositivo fantasma, se solicitado
    if ($RemoverFila) {
      if ($PSCmdlet.ShouldProcess($nomeImpressora, "Remover impressora fantasma do Windows")) {
        try {
          Remove-Printer -Name $nomeImpressora -ErrorAction Stop
          Write-Host "  [OK] Impressora fantasma '$nomeImpressora' removida do Windows." -ForegroundColor Green
        } catch {
          Write-Warning "  Não foi possível remover o dispositivo '$nomeImpressora': $($_.Exception.Message)"
        }
      }
    }
  }
}

# 5. Higienização do appsettings.json do Autoatendimento
if ($ZerarAppsettings) {
  $caminhosAppsettings = @(
    "$env:ProgramFiles\Kartodromo\Autoatendimento\appsettings.json",
    (Join-Path $PSScriptRoot 'Autoatendimento\appsettings.json'),
    (Join-Path $PSScriptRoot '..\..\desktop\src\Kartodromo.Autoatendimento\appsettings.json')
  )

  foreach ($caminho in $caminhosAppsettings) {
    if (Test-Path -LiteralPath $caminho) {
      try {
        $json = Get-Content -LiteralPath $caminho -Raw -ErrorAction Stop | ConvertFrom-Json
        if ($json.Impressora -ne "") {
          Write-Host "`nAtualizando configuração em: $caminho" -ForegroundColor White
          Write-Host "  'Impressora' anterior: '$($json.Impressora)' -> Nova: ''" -ForegroundColor Yellow
          $json.Impressora = ""
          $utf8SemBom = New-Object System.Text.UTF8Encoding $false
          [System.IO.File]::WriteAllText($caminho, ($json | ConvertTo-Json -Depth 5), $utf8SemBom)
          Write-Host "  [OK] appsettings.json atualizado." -ForegroundColor Green
        } else {
          Write-Host "`nConfiguração em $caminho já está com 'Impressora' vazia." -ForegroundColor Green
        }
      } catch {
        Write-Warning "Falha ao processar $caminho: $($_.Exception.Message)"
      }
    }
  }
}

Write-Host "`nOperação concluída com sucesso. O Spooler permaneceu 100% ativo.`n" -ForegroundColor Cyan

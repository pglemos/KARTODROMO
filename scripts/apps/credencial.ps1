<#
  Credencial WinRM da conta KARTODROMO (SEC-008), guardada cifrada (DPAPI) para o usuário do Windows
  que está rodando o script: só esse usuário, nesta máquina, consegue abrir. Nunca vai para o git.
  Ordem de busca:
    1) %USERPROFILE%\.kartodromo\winrm-cred.xml   (criado por salvar-credencial.ps1; ex.: login KARTODROMO via SSH do Mac)
    2) C:\KARTODROMO\.winrm-cred.xml              (o do Administrador do ORBITS)
#>
function Obter-CredencialKartodromo {
  foreach ($arq in @((Join-Path $env:USERPROFILE '.kartodromo\winrm-cred.xml'), 'C:\KARTODROMO\.winrm-cred.xml')) {
    if (Test-Path $arq) {
      try { return Import-Clixml $arq } catch { }
    }
  }
  $inv = 'C:\KARTODROMO\00_INVENTARIO_SEGREDOS.md'
  if (Test-Path $inv) {
    $line = (Get-Content $inv | Where-Object { $_ -match 'SEC-008' } | Select-Object -First 1)
    if ($line -match '`KARTODROMO` / `([^`]+)`') {
      $sec = ConvertTo-SecureString $matches[1] -AsPlainText -Force
      return New-Object System.Management.Automation.PSCredential('KARTODROMO', $sec)
    }
  }
  throw "Credencial KARTODROMO não encontrada para o usuário $env:USERNAME. Rode uma vez: scripts\apps\salvar-credencial.ps1"
}

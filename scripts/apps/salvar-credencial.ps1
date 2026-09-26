<#
  Salva (uma vez por usuário do Windows) a senha da conta KARTODROMO (SEC-008, está no
  00_INVENTARIO_SEGREDOS.md) cifrada em %USERPROFILE%\.kartodromo\winrm-cred.xml.
  A senha é digitada escondida; nada aparece na tela nem vai para o git.
    powershell -ExecutionPolicy Bypass -File scripts\apps\salvar-credencial.ps1
#>
$pasta = Join-Path $env:USERPROFILE '.kartodromo'
New-Item -ItemType Directory -Force $pasta | Out-Null
$senha = Read-Host 'Senha da conta KARTODROMO (SEC-008)' -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential('KARTODROMO', $senha)
# confere a senha numa máquina antes de salvar
try {
  Invoke-Command -ComputerName 192.168.20.13 -Credential $cred -ScriptBlock { $env:COMPUTERNAME } -ErrorAction Stop | ForEach-Object { "senha conferida no $_" }
} catch { throw "A senha não funcionou no SRVKART (192.168.20.13): $($_.Exception.Message)" }
$cred | Export-Clixml (Join-Path $pasta 'winrm-cred.xml')
"credencial salva em $pasta\winrm-cred.xml (só o usuário $env:USERNAME consegue abrir)"

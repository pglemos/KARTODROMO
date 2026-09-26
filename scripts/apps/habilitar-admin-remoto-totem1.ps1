$ErrorActionPreference = 'Stop'

# Execute uma vez no PowerShell elevado do Totem 1.
# O WinRM aceita conexoes somente do computador CRONOMETRAGEM (192.168.20.249).
$controllerIp = '192.168.20.249'
$totemIp = '192.168.20.161'
$expectedName = 'TOTEN1'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra o PowerShell como Administrador e execute novamente.'
}

if ($env:COMPUTERNAME -ne $expectedName) {
  throw "Computador incorreto: $env:COMPUTERNAME. Este script e exclusivo do Totem 1 ($expectedName)."
}

$localIps = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
  Where-Object { $_.IPAddress -notlike '127.*' } |
  Select-Object -ExpandProperty IPAddress)
if ($totemIp -notin $localIps) {
  throw "O computador $expectedName nao possui o IP esperado $totemIp. IPs encontrados: $($localIps -join ', ')"
}

Set-Service -Name WinRM -StartupType Automatic
Enable-PSRemoting -SkipNetworkProfileCheck -Force
Start-Service -Name WinRM

# Enable-PSRemoting preserva os padroes seguros do Windows: Basic e trafego sem
# criptografia permanecem desativados. Nao regrava essas opcoes via provedor WSMan.

# Contas administrativas locais recebem o token completo para sessoes remotas.
$systemPolicy = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
New-Item -Path $systemPolicy -Force | Out-Null
New-ItemProperty -Path $systemPolicy -Name LocalAccountTokenFilterPolicy -PropertyType DWord -Value 1 -Force | Out-Null

# Restringe as regras de entrada do WinRM ao computador que fara a manutencao.
$winrmRules = @(Get-NetFirewallRule -Direction Inbound -ErrorAction Stop |
  Where-Object { $_.Name -like 'WINRM-*' -or $_.Service -eq 'WinRM' })
foreach ($rule in $winrmRules) {
  Set-NetFirewallRule -Name $rule.Name -Enabled True -Profile Any
  $rule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress $controllerIp
}

# Regra dedicada como fallback para imagens do Windows sem a regra padrao do WinRM.
$customRule = Get-NetFirewallRule -Name 'KIB-Totem1-WinRM-CRONOMETRAGEM' -ErrorAction SilentlyContinue
if (-not $customRule) {
  New-NetFirewallRule -Name 'KIB-Totem1-WinRM-CRONOMETRAGEM' `
    -DisplayName 'Kartodromo Totem 1 - WinRM somente do CRONOMETRAGEM' `
    -Direction Inbound -Action Allow -Enabled True -Profile Any `
    -Protocol TCP -LocalPort 5985 -RemoteAddress $controllerIp | Out-Null
} else {
  Set-NetFirewallRule -Name 'KIB-Totem1-WinRM-CRONOMETRAGEM' -Enabled True -Profile Any
  $customRule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress $controllerIp
}

Test-WSMan -ComputerName localhost -ErrorAction Stop | Out-Null
Write-Host "WinRM administrativo habilitado em $expectedName ($totemIp), limitado a $controllerIp."
Write-Host 'Basic e AllowUnencrypted continuam desabilitados.'

. 'C:\repos\KARTODROMO\scripts\apps\credencial.ps1'
$cred = Obter-CredencialKartodromo
$totemIp = '192.168.20.161'

Write-Output "Testando conexão com Totem 1 ($totemIp)..."
$sessao = New-PSSession -ComputerName $totemIp -Credential $cred -ErrorAction Stop
try {
  Invoke-Command -Session $sessao {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\TimeProviders\NtpClient' -Name 'SpecialPollInterval' -Value 900 -ErrorAction SilentlyContinue
    & w32tm /config /manualpeerlist:"a.st1.ntp.br,0x9 192.168.20.249,0x9" /syncfromflags:manual /reliable:YES /update
    Restart-Service w32time -Force
    Start-Sleep -Seconds 2
    & w32tm /resync /rediscover
    Start-Sleep -Seconds 1
    & w32tm /query /status
  }
}
finally {
  Remove-PSSession $sessao
}

Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\TimeProviders\NtpClient' -Name 'SpecialPollInterval' -Value 900
& w32tm /config /manualpeerlist:"a.st1.ntp.br,0x9 b.st1.ntp.br,0x9 c.st1.ntp.br,0x9" /syncfromflags:manual /reliable:YES /update
Restart-Service w32time -Force
Start-Sleep -Seconds 2
& w32tm /resync /rediscover
Start-Sleep -Seconds 2
& w32tm /query /status

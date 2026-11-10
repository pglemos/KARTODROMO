. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo
# Testar lista conhecida e possíveis terminais
$candidatos = @(
  '192.168.20.53',
  '192.168.20.54',
  '192.168.20.55',
  '192.168.20.52',
  '192.168.20.51',
  '192.168.20.69',
  '192.168.20.161',
  '192.168.20.254',
  '192.168.20.187',
  '192.168.20.247',
  '192.168.20.248',
  '192.168.20.250'
)
foreach ($ip in $candidatos) {
  $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet
  if ($ping) {
    try {
      $name = Invoke-Command -ComputerName $ip -Credential $c -ScriptBlock {
        $proc = (Get-Process Kartodromo* -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique) -join ','
        "$env:COMPUTERNAME ($proc)"
      } -ErrorAction Stop
      Write-Host "$ip : ONLINE - $name"
    } catch {
      Write-Host "$ip : PING OK - WinRM Falhou: $($_.Exception.Message)"
    }
  }
}

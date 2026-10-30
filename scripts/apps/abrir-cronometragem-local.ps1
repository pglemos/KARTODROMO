$exe = 'C:\Program Files\Kartodromo\Cronometragem\Kartodromo.Cronometragem.exe'
$user = (Get-CimInstance Win32_ComputerSystem).UserName
if (-not $user) { Write-Output "Sem usuario logado interativamente"; exit 0 }
$pr = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive
Register-ScheduledTask KartodromoAbrir -Action (New-ScheduledTaskAction -Execute $exe -WorkingDirectory (Split-Path $exe)) -Principal $pr -Force | Out-Null
Start-ScheduledTask KartodromoAbrir
Start-Sleep -Seconds 4
Unregister-ScheduledTask KartodromoAbrir -Confirm:$false
Get-Process Kartodromo.Cronometragem -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle

New-Item -ItemType Directory -Force 'C:\KARTODROMO\segredos' | Out-Null
$task = Get-ScheduledTask -TaskName 'KartodromoLiveTimeTunnel'
$match = [regex]::Match($task.Actions[0].Arguments, '(?<=--token\s+)\S+')
if ($match.Success) {
    [IO.File]::WriteAllText('C:\KARTODROMO\segredos\cloudflared-livetime.token', $match.Value.Trim(), [Text.Encoding]::ASCII)
}
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\repos\KARTODROMO\scripts\iniciar-livetime-tunnel.ps1' -WorkingDirectory 'C:\repos\KARTODROMO'
Set-ScheduledTask -TaskName 'KartodromoLiveTimeTunnel' -Action $action
Stop-ScheduledTask -TaskName 'KartodromoLiveTimeTunnel' -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName 'KartodromoLiveTimeTunnel'
Start-Sleep -Seconds 3
Get-ScheduledTask -TaskName 'KartodromoLiveTimeTunnel' | Select-Object TaskName, State
(Get-ScheduledTask -TaskName 'KartodromoLiveTimeTunnel').Actions | Select-Object Execute, Arguments

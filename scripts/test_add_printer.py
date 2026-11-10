#!/usr/bin/env python3
import base64
import subprocess

code = r'''
. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo

Invoke-Command -ComputerName 192.168.20.53 -Credential $c -ScriptBlock {
    $loggedUser = (Get-CimInstance Win32_ComputerSystem).UserName
    
    $psContent = @'
try {
    $log = @()
    $log += "Iniciando como " + [Environment]::UserName
    Add-Printer -ConnectionName "\\DESKTOP-4OR2GFI\TOTEM2-T20" -ErrorAction Stop
    $log += "SUCESSO: Add-Printer TOTEM2-T20 CONECTADO!"
} catch {
    $log += "Erro: " + $_.Exception.Message
}
$log | Out-File -FilePath C:\Users\Public\debug-add-printer6.log -Encoding utf8
'@
    [IO.File]::WriteAllText('C:\Users\Public\add-printer6.ps1', $psContent)
    
    $pr = New-ScheduledTaskPrincipal -UserId $loggedUser -LogonType Interactive
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Users\Public\add-printer6.ps1"
    Register-ScheduledTask "KartodromoAddPrinter6" -Action $action -Principal $pr -Force | Out-Null
    Start-ScheduledTask "KartodromoAddPrinter6"
    Start-Sleep -Seconds 8
    Unregister-ScheduledTask "KartodromoAddPrinter6" -Confirm:$false
    
    if (Test-Path "C:\Users\Public\debug-add-printer6.log") {
        Get-Content "C:\Users\Public\debug-add-printer6.log"
    }
}
'''

b64 = base64.b64encode(code.encode('utf-16le')).decode('ascii')
cmd = ['ssh', '-n', 'orbits', f'powershell -NoProfile -EncodedCommand {b64}']
proc = subprocess.run(cmd, capture_output=True)
out = proc.stdout.decode('cp850', errors='replace')
err = proc.stderr.decode('cp850', errors='replace')
if out:
    print(out)
if err:
    print('ERR:', err)

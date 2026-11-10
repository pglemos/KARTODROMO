#!/usr/bin/env python3
import sys
import base64
import subprocess

def run_ps_on_orbits(code: str):
    b64 = base64.b64encode(code.encode('utf-16le')).decode('ascii')
    cmd = ['ssh', '-n', 'orbits', f'powershell -NoProfile -EncodedCommand {b64}']
    proc = subprocess.run(cmd, capture_output=True)
    out = proc.stdout.decode('cp850', errors='replace')
    err = proc.stderr.decode('cp850', errors='replace')
    if out:
        sys.stdout.write(out)
    if err:
        sys.stderr.write(err)
    return proc.returncode

if __name__ == '__main__':
    # Check if AnyDesk can launch in console session
    ps = r'''
$pr = New-ScheduledTaskPrincipal -UserId "Administrador" -LogonType Interactive
$action = New-ScheduledTaskAction -Execute "C:\Program Files (x86)\AnyDesk\AnyDesk.exe" -Argument "548795701"
Register-ScheduledTask -TaskName "AnyDeskConnectTotem1" -Action $action -Principal $pr -Force | Out-Null
Start-ScheduledTask -TaskName "AnyDeskConnectTotem1"
Start-Sleep -Seconds 5
Get-Process -Name "*anydesk*" | Select-Object Id, ProcessName, SessionId
'''
    run_ps_on_orbits(ps)

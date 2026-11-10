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
    ps = r'''
Write-Host "--- AnyDesk Files ---"
Get-ChildItem "C:\ProgramData\AnyDesk" -ErrorAction SilentlyContinue | Select-Object Name
Get-ChildItem "$env:APPDATA\AnyDesk" -ErrorAction SilentlyContinue | Select-Object Name
Get-ChildItem "C:\KartodromoApps\instaladores" -ErrorAction SilentlyContinue | Select-Object Name

Write-Host "--- AnyDesk Processes ---"
Get-Process -Name "*anydesk*" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, SessionId
'''
    run_ps_on_orbits(ps)

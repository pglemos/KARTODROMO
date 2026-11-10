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
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters" -Name "AllowInsecureGuestAuth" -Value 1 -Type DWord -Force
if (-not (Test-Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation")) {
    New-Item "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation" -Force | Out-Null
}
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation" -Name "AllowInsecureGuestAuth" -Value 1 -Type DWord -Force

Write-Host "AllowInsecureGuestAuth set to 1. Testing net use..."
net use * /delete /y
net use \\192.168.20.161\Users /user:Guest ""
Get-ChildItem \\192.168.20.161\Users
'''
    run_ps_on_orbits(ps)

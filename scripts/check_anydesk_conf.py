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
Write-Host "--- AnyDesk user.conf ---"
Get-Content "$env:APPDATA\AnyDesk\user.conf" -ErrorAction SilentlyContinue | Select-String -Pattern "548795701|totem|recent" -Context 2,2

Write-Host "--- AnyDesk system.conf ---"
Get-Content "C:\ProgramData\AnyDesk\system.conf" -ErrorAction SilentlyContinue | Select-String -Pattern "ad.anynet.id"
'''
    run_ps_on_orbits(ps)

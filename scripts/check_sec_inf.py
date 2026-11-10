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
. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo
$pass = $c.GetNetworkCredential().Password
Invoke-Command -ComputerName 192.168.20.53 -Credential $c -ScriptBlock {
    param($user, $p)
    net use \\192.168.20.161\Users $p /user:$user | Out-Null
    Get-Content "\\192.168.20.161\Users\Public\KartodromoDiag\sec.inf" -ErrorAction SilentlyContinue | Select-String -Pattern "NetworkLogonRight|RemoteInteractiveLogonRight"
} -ArgumentList $c.UserName, $pass
'''
    run_ps_on_orbits(ps)

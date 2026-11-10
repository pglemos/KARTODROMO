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
$pwd = $c.Password

$users = @("KARTODROMO", "TOTEN1\KARTODROMO", "192.168.20.161\KARTODROMO", ".\KARTODROMO")
foreach ($u in $users) {
    Write-Host "Testing WinRM with user $u..."
    $cred = New-Object System.Management.Automation.PSCredential($u, $pwd)
    try {
        $out = Invoke-Command -ComputerName 192.168.20.161 -Credential $cred -ScriptBlock { hostname } -ErrorAction Stop
        Write-Host "SUCCESS! Hostname: $out"
        exit 0
    } catch {
        Write-Host "Failed: $_"
    }
}
'''
    run_ps_on_orbits(ps)

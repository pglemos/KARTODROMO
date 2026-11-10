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
    net use \\192.168.20.161\ipc$ $p /user:$user | Out-Null
    try {
        $reg = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey('LocalMachine', '192.168.20.161')
        $key = $reg.OpenSubKey('SYSTEM\CurrentControlSet\Control\Lsa', $true)
        if ($key) {
            $val = $key.GetValue('forceguest')
            Write-Host "RemoteRegistry SUCCESS! current forceguest = $val"
            $key.SetValue('forceguest', 0, [Microsoft.Win32.RegistryValueKind]::DWord)
            Write-Host "Set forceguest to 0 SUCCESS!"
            $key.Close()
            $reg.Close()
        } else {
            Write-Host "Key not openable for writing"
        }
    } catch {
        Write-Host "RemoteRegistry error: $_"
    }
} -ArgumentList $c.UserName, $pass
'''
    run_ps_on_orbits(ps)

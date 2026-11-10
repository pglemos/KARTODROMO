import sys
import base64
import subprocess

ps = r"""
. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo
$u = $c.UserName
$p = $c.GetNetworkCredential().Password

Invoke-Command -ComputerName 192.168.20.53 -Credential $c -ScriptBlock {
    param($user, $pass)
    net use \\192.168.20.161\Users $pass /user:$user | Out-Null
    Write-Host "Files in \\192.168.20.161\Users\Public:"
    Get-ChildItem \\192.168.20.161\Users\Public | Select-Object Name, Length, LastWriteTime
} -ArgumentList $u, $p
"""

b64 = base64.b64encode(ps.encode('utf-16le')).decode('ascii')
cmd = ['ssh', '-n', 'orbits', f'powershell -NoProfile -EncodedCommand {b64}']
proc = subprocess.run(cmd, capture_output=True)
print(proc.stdout.decode('cp850', errors='replace'))
print(proc.stderr.decode('cp850', errors='replace'))

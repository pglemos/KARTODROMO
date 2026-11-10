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
$ip = "192.168.20.161"
$ports = @(21, 22, 80, 135, 139, 445, 3389, 5985, 5986, 7070, 9100)
foreach ($p in $ports) {
    $t = Test-NetConnection -ComputerName $ip -Port $p -WarningAction SilentlyContinue
    [PSCustomObject]@{ Port = $p; Open = $t.TcpTestSucceeded }
}
'''
    run_ps_on_orbits(ps)

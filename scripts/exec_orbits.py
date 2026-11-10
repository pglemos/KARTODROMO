#!/usr/bin/env python3
import sys
import base64
import subprocess

def run_ps(code: str):
    b64 = base64.b64encode(code.encode('utf-16le')).decode('ascii')
    cmd = ['ssh', '-n', 'orbits', f'powershell -NoProfile -EncodedCommand {b64}']
    proc = subprocess.run(cmd, capture_output=True)
    out = proc.stdout.decode('cp850', errors='replace')
    err = proc.stderr.decode('cp850', errors='replace')
    if out:
        sys.stdout.write(out)
    if err:
        sys.stderr.write(err)
    sys.exit(proc.returncode)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == '-f':
            with open(sys.argv[2], 'r', encoding='utf-8') as f:
                code = f.read()
        else:
            code = sys.argv[1]
    else:
        code = sys.stdin.read()
    run_ps(code)

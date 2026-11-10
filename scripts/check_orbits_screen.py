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
$shot = @"
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
`$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
`$bmp = New-Object Drawing.Bitmap `$b.Width, `$b.Height
`$g = [Drawing.Graphics]::FromImage(`$bmp)
`$g.CopyFromScreen(`$b.Left, `$b.Top, 0, 0, `$bmp.Size)
`$bmp.Save('C:\Users\Public\orbits-screen.png')
"@
[IO.File]::WriteAllText('C:\Users\Public\take-shot.ps1', $shot)
$pr = New-ScheduledTaskPrincipal -UserId "Administrador" -LogonType Interactive
$action = New-ScheduledTaskAction -Execute "conhost.exe" -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Users\Public\take-shot.ps1"
Register-ScheduledTask -TaskName "TakeShot" -Action $action -Principal $pr -Force | Out-Null
Start-ScheduledTask -TaskName "TakeShot"
Start-Sleep -Seconds 3
Unregister-ScheduledTask -TaskName "TakeShot" -Confirm:$false

Get-Item C:\Users\Public\orbits-screen.png | Select-Object Length, LastWriteTime
Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle
'''
    run_ps_on_orbits(ps)

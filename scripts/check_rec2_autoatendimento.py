import sys
import base64
import subprocess

ps = r"""
. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo
Invoke-Command -ComputerName 192.168.20.239 -Credential $c -ScriptBlock {
    Write-Host "=== Autoatendimento installation on 192.168.20.239 ==="
    $paths = @(
        'C:\Program Files\Kartodromo\Autoatendimento\Kartodromo.Autoatendimento.exe',
        'C:\Program Files\Kartodromo\Autoatendimento\appsettings.json'
    )
    foreach ($p in $paths) {
        if (Test-Path $p) {
            Write-Host "$p exists:"
            if ($p.EndsWith('.json')) { Get-Content $p }
            else { (Get-Item $p).VersionInfo.ProductVersion }
        } else {
            Write-Host "$p does NOT exist"
        }
    }

    Write-Host "`n=== Installed Printers on 192.168.20.239 ==="
    Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus
}
"""

b64 = base64.b64encode(ps.encode('utf-16le')).decode('ascii')
cmd = ['ssh', '-n', 'orbits', f'powershell -NoProfile -EncodedCommand {b64}']
proc = subprocess.run(cmd, capture_output=True)
print(proc.stdout.decode('cp850', errors='replace'))
print(proc.stderr.decode('cp850', errors='replace'))

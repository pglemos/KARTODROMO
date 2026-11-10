#!/usr/bin/env python3
import base64
import subprocess
import sys

ps_script = r'''
. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo

# Recepcao 1 (.53)
Invoke-Command -ComputerName 192.168.20.53 -Credential $c -ScriptBlock {
    $port = Get-PrinterPort -Name "IP_192.168.20.161" -ErrorAction SilentlyContinue
    if (-not $port) {
        Add-PrinterPort -Name "IP_192.168.20.161" -PrinterHostAddress "192.168.20.161" -PortNumber 9100
    }
    Remove-Printer -Name "TOTEM 1 (T20)" -ErrorAction SilentlyContinue
    Add-Printer -Name "TOTEM 1 (T20)" -DriverName "EPSON TM-T(180dpi) Receipt6" -PortName "IP_192.168.20.161"
    Get-Printer -Name "TOTEM 1 (T20)" | Select-Object Name, PortName, DriverName, PrinterStatus
}

# Recepcao 2 (.239)
Invoke-Command -ComputerName 192.168.20.239 -Credential $c -ScriptBlock {
    $port = Get-PrinterPort -Name "IP_192.168.20.161" -ErrorAction SilentlyContinue
    if (-not $port) {
        Add-PrinterPort -Name "IP_192.168.20.161" -PrinterHostAddress "192.168.20.161" -PortNumber 9100
    }
    Remove-Printer -Name "TOTEM 1 (T20)" -ErrorAction SilentlyContinue
    Add-Printer -Name "TOTEM 1 (T20)" -DriverName "EPSON TM-T20 ReceiptE4" -PortName "IP_192.168.20.161"
    Get-Printer -Name "TOTEM 1 (T20)" | Select-Object Name, PortName, DriverName, PrinterStatus
}
'''

b64 = base64.b64encode(ps_script.encode('utf-16le')).decode('ascii')
cmd = ['ssh', '-n', 'orbits', f'powershell -NoProfile -EncodedCommand {b64}']
proc = subprocess.run(cmd, capture_output=True)
out = proc.stdout.decode('cp850', errors='replace')
err = proc.stderr.decode('cp850', errors='replace')
if out:
    print(out)
if err:
    print('ERR:', err)
sys.exit(proc.returncode)

#!/usr/bin/env python3
import base64
import re

with open('/Users/pedroguilherme/PROJETOS/KARTODROMO/desktop/src/Kartodromo.Comum/Api.cs', 'r') as f:
    pass # just test file

# Let's read LIBERAR-ACESSO-TOTEM.cmd from ORBITS
code = r'''
$content = Get-Content C:\KartodromoApps\instaladores\LIBERAR-ACESSO-TOTEM.cmd -Raw
if ($content -match '-EncodedCommand\s+([A-Za-z0-9+/=]+)') {
    $bytes = [Convert]::FromBase64String($matches[1])
    $decoded = [System.Text.Encoding]::Unicode.GetString($bytes)
    # Mask any potential password strings
    $decoded -replace "'[^'\r\n]{6,}'", "'***'"
}
'''

import subprocess
cmd = ['python3', 'scripts/exec_orbits.py', code]
proc = subprocess.run(cmd, capture_output=True, text=True)
print(proc.stdout)

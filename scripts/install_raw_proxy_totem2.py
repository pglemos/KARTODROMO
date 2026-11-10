#!/usr/bin/env python3
import base64
import subprocess
import sys

ps_script = r'''
. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$c = Obter-CredencialKartodromo
Invoke-Command -ComputerName 192.168.20.69 -Credential $c -ScriptBlock {
    # 1. Firewall rule
    $rule = Get-NetFirewallRule -Name "RAW-9100-PRINTER" -ErrorAction SilentlyContinue
    if (-not $rule) {
        New-NetFirewallRule -Name "RAW-9100-PRINTER" -DisplayName "RAW 9100 Printer Listener" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9100 | Out-Null
    }
    
    # 2. Directory
    if (-not (Test-Path "C:\Kartodromo")) { New-Item -ItemType Directory -Path "C:\Kartodromo" -Force | Out-Null }
    
    # 3. Script content
    $scriptLines = @(
'param([string]$PrinterName = "TOTEM2-USB", [int]$Port = 9100)',
'$code = @"',
'using System;',
'using System.IO;',
'using System.Runtime.InteropServices;',
'public class RawPrinterHelper {',
'    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]',
'    public class DOCINFOA {',
'        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;',
'        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;',
'        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;',
'    }',
'    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);',
'    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool ClosePrinter(IntPtr hPrinter);',
'    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);',
'    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool EndDocPrinter(IntPtr hPrinter);',
'    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool StartPagePrinter(IntPtr hPrinter);',
'    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool EndPagePrinter(IntPtr hPrinter);',
'    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
'    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);',
'    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {',
'        IntPtr hPrinter = IntPtr.Zero;',
'        DOCINFOA di = new DOCINFOA { pDocName = "Termo Kartodromo", pDataType = "RAW" };',
'        bool success = false;',
'        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {',
'            if (StartDocPrinter(hPrinter, 1, di)) {',
'                if (StartPagePrinter(hPrinter)) {',
'                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);',
'                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);',
'                    int dwWritten = 0;',
'                    success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);',
'                    Marshal.FreeCoTaskMem(pUnmanagedBytes);',
'                    EndPagePrinter(hPrinter);',
'                }',
'                EndDocPrinter(hPrinter);',
'            }',
'            ClosePrinter(hPrinter);',
'        }',
'        return success;',
'    }',
'}',
'"@',
'Add-Type -TypeDefinition $code',
'$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)',
'$listener.Start()',
'while ($true) {',
'    try {',
'        $client = $listener.AcceptTcpClient()',
'        $stream = $client.GetStream()',
'        $ms = [System.IO.MemoryStream]::new()',
'        $buffer = New-Object byte[] 4096',
'        $client.ReceiveTimeout = 5000',
'        while ($true) {',
'            try {',
'                $read = $stream.Read($buffer, 0, $buffer.Length)',
'                if ($read -le 0) { break }',
'                $ms.Write($buffer, 0, $read)',
'            } catch { break }',
'        }',
'        $data = $ms.ToArray()',
'        if ($data.Length -gt 0) {',
'            [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $data)',
'        }',
'        $stream.Close()',
'        $client.Close()',
'    } catch { Start-Sleep -Milliseconds 100 }',
'}'
    )
    [IO.File]::WriteAllLines("C:\Kartodromo\raw-printer-proxy.ps1", $scriptLines, [System.Text.Encoding]::UTF8)
    
    # 4. Scheduled task
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Kartodromo\raw-printer-proxy.ps1"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
    Register-ScheduledTask -TaskName "KartodromoRawPrinterProxy" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName "KartodromoRawPrinterProxy"
    
    Start-Sleep -Seconds 2
    Get-ScheduledTask -TaskName "KartodromoRawPrinterProxy" | Select-Object TaskName, State
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

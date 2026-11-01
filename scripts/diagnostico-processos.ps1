Get-CimInstance Win32_Process -Filter "name='node.exe'" | ForEach-Object {
  [PSCustomObject]@{
    PID = $_.ProcessId
    WS_MB = [math]::Round($_.WorkingSetSize / 1MB, 2)
    CommandLine = $_.CommandLine
  }
} | Format-List

Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft*' } |
  Select-Object TaskName, State, TaskPath, @{N='Command';E={($_.Actions | Select-Object -ExpandProperty Execute) + ' ' + ($_.Actions | Select-Object -ExpandProperty Arguments)}} |
  Format-Table -Wrap

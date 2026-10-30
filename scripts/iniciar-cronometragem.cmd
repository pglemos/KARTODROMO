@echo off
rem Inicia o servidor da cronometragem (:4050) - chamado pela tarefa KartodromoCronometragem (SISTEMA).
rem Antes de abrir, guarda o registro se passou de 5 MB (timing-AAAAMMDD-HHMM.log; ficam os 5 ultimos).
cd /d C:\repos\KARTODROMO
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f='data\timing\timing.log'; if ((Test-Path $f) -and (Get-Item $f).Length -gt 5MB) { Move-Item $f ('data\timing\timing-' + (Get-Date -Format yyyyMMdd-HHmm) + '.log') -Force }; Get-ChildItem data\timing\timing-*.log -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | ForEach-Object { [IO.File]::Delete($_.FullName) }"
"C:\Program Files\nodejs\node.exe" --max-old-space-size=1024 --require "C:\repos\KARTODROMO\node_modules\tsx\dist\preflight.cjs" --import "file:///C:/repos/KARTODROMO/node_modules/tsx/dist/loader.mjs" services/timing-server.ts

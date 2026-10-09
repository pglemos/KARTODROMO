@echo off
rem Vigia das TVs LG (placar /tv em todas as TVs da rede) - chamado pela tarefa KartodromoVigiaTVs (SISTEMA).
rem Guarda o registro se passou de 5 MB.
cd /d C:\repos\KARTODROMO
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f='data\timing\tvs.log'; if ((Test-Path $f) -and (Get-Item $f).Length -gt 5MB) { Move-Item $f 'data\timing\tvs-anterior.log' -Force }"
"C:\Program Files\nodejs\node.exe" scripts\tv-lg-vigia.mjs >> data\timing\tvs.log 2>&1

# Totem 1: instalação do aplicativo nativo

Copie `Totem1-Nativo-f4875d7.zip` para `192.168.20.161`. No PowerShell aberto como Administrador, extraia o pacote e execute:

```powershell
$pacote = 'C:\KartodromoApps\instaladores\Totem1-Nativo-f4875d7.zip'
$pasta = 'C:\KartodromoApps\instaladores\Totem1-Nativo'
Expand-Archive -LiteralPath $pacote -DestinationPath $pasta -Force
Set-Location $pasta
Set-ExecutionPolicy -Scope Process Bypass
.\instalar-totem1.ps1
```

O instalador detecta a impressora Epson TM-T20, configura o servidor local, cria os atalhos, inicia o Autoatendimento e configura sua abertura no logon. Não altera o firewall nem habilita WinRM.

# Totem 1: instalação do app nativo

Copie a pasta `Totem1-Nativo` para o computador `192.168.20.161`, abra o PowerShell como Administrador nessa pasta e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.instalar-totem1.ps1
```

O instalador identifica a impressora Epson TM-T20, grava a configuração do servidor local, cria atalhos, configura a abertura do Autoatendimento no logon e inicia o app. Ele não ativa WinRM nem altera o firewall.

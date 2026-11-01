# DISPATCH — Explorer Totem Desktop 1

## Tarefa
Realizar levantamento detalhado de código, pontos de injeção, falhas e impactos no cliente WinForms .NET 8 Kiosk (`Kartodromo.Autoatendimento`), componentes compartilhados (`Kartodromo.Comum`), autoteste visual e scripts PowerShell para os 39 itens do totem de autoatendimento.

## Arquivos e Módulos Centrais
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md` (seção de 2026-10-26T19:04:37Z)
- `desktop/src/Kartodromo.Autoatendimento/` (especialmente `FormTotem.cs`, Program.cs, controles, diálogos)
- `desktop/src/Kartodromo.Comum/` (máscaras, HTTP client, modelos, utilitários de impressão)
- `desktop/Kartodromo.Desktop.sln`
- `scripts/apps/habilitar-admin-remoto-totem1.ps1`, `implantar-remoto.ps1` e scripts de spooler/deploy.
- Rotinas de autoteste visual e suporte a resoluções 1366x768 e 1920x1080.

## Foco de Análise
1. Ausência de impressora local no totem (nunca tentar `ImprimirSilencioso` cego; orientação em tela) e layout térmico TM-T20 dinâmico.
2. Bloqueio de escape do Kiosk para a área de trabalho (Win, Alt+Tab, Ctrl+Esc) via hook de teclado.
3. Instagram opcional, máscara de celular internacional/cursor correto sem saltar para o final, edição assistida de dados e tratamento de 409.
4. Preservação de seleção de participantes ao cadastrar dependentes; regras de responsável por menor; timer de inatividade de 90s com interceptação de scroll/toque e pausa em modais; foco contínuo no teclado físico sem teclado virtual.
5. Exibição de horários/preços/categorias de baterias e mensagens de vagas insuficientes.
6. Timeout de HTTP (8-10s), `TratarInicioAsync` assíncrono para eliminar tela preta de inicialização, vazamentos de memória GDI (`ContextMenuStrip.Dispose()`, bitmaps de logo).
7. Erros de sintaxe em scripts PowerShell, sincronização NTP e atalhos de inicialização.

## Saída Esperada
Escreva seu relatório em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1/handoff.md`.
Atualize periodicamente seu `progress.md`.
Ao concluir, envie mensagem para o orquestrador (parent).

## 2026-10-26T19:09:19Z
Você é o Explorer Especialista em Desktop WinForms, UX Kiosk e Infraestrutura para o sistema de autoatendimento (totem) do Kartódromo de Betim.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1
Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).
Consulte também os seguintes arquivos:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1/DISPATCH.md
- desktop/src/Kartodromo.Autoatendimento/ (FormTotem.cs, Program.cs, controles, diálogos)
- desktop/src/Kartodromo.Comum/ (máscaras, HTTP client, modelos, impressão)
- desktop/Kartodromo.Desktop.sln
- scripts/apps/habilitar-admin-remoto-totem1.ps1, implantar-remoto.ps1
- Scripts e rotinas de autoteste visual (telas em 1366x768 e 1920x1080)

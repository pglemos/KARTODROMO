# BRIEFING — 2026-10-26T22:16:00Z

## Mission
Investigar e projetar a proteção de quiosque contra escape para o Windows no teclado físico USB (Low-Level Keyboard Hook para WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4) em C# WinForms para o Kartodromo.Autoatendimento, preservando digitação normal.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2
- Original parent: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Milestone: M2 (R2: Segurança, Privacidade e LGPD - Item 10)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Totem sem teclado na tela (conforme regra do dono / AGENTS.md)
- Arquivos de código não devem ser modificados diretamente neste papel de Explorer

## Current Parent
- Conversation ID: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Updated: 2026-10-26T22:16:00Z

## Investigation State
- **Explored paths**:
  - `desktop/src/Kartodromo.Autoatendimento/Program.cs`
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
  - `desktop/src/Kartodromo.Autoatendimento/Controles.cs`
  - `desktop/src/Kartodromo.Comum/InstanciaUnica.cs`
  - `scripts/apps/habilitar-admin-remoto-totem1.ps1`
  - `scripts/apps/instalar-desktop.ps1`
  - `scripts/apps/instalar-totem1.ps1`
  - `.agents/teamwork/ORIGINAL_REQUEST.md`
  - `.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md`
- **Key findings**:
  - `FormTotem` roda em tela cheia sem bordas (`FormBorderStyle = None`, `WindowState = Maximized`, `TopMost = true`), mas não possui hook de teclado de baixo nível.
  - O aplicativo fica vulnerável a escape pelo teclado USB através de WinKey (Menu Iniciar), Alt+Tab, Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc (Task Manager), Alt+F4 e AppsKey.
  - `PreFilterMessage` apenas reinicia o temporizador de ociosidade, sem interceptar teclas do sistema do Windows.
  - A equipe técnica já utiliza `Ctrl+Shift+Alt+S` para encerramento de emergência, que deve ser preservado.
  - A manutenção remota via WinRM (`habilitar-admin-remoto-totem1.ps1`) provê fallback para fechamento e reinício administrativo.
  - Projetada a classe `BloqueioTeclasKiosk` (`WH_KEYBOARD_LL = 13`) em .NET 8 com P/Invoke limpo, proteção contra coleta de lixo (GC) no delegate e desinstalação determinística com `IDisposable`.
- **Unexplored areas**: Nenhuma no escopo do Item 10.

## Key Decisions Made
- Estruturar a classe `BloqueioTeclasKiosk` isolada e desacoplada em `desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs`.
- Ativar o hook somente quando `_autoteste == null`, evitando bloquear o teclado de máquinas de teste ou desenvolvedores.
- Tratar seletivamente apenas teclas perigosas de sistema quando `Alt` ou `Ctrl` estiverem pressionados, preservando integralmente `Tab` entre campos, `Space`, `Enter`, caracteres ABNT2 com `AltGr`, acentos e setas.

## Artifact Index
- DISPATCH.md — Instruções da tarefa
- BRIEFING.md — Memória de trabalho do agente
- progress.md — Liveness e progresso do agente
- handoff.md — Relatório técnico final de entrega

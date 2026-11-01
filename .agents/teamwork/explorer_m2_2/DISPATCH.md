# DISPATCH — Explorer M2_2 (Desktop Kiosk Keyboard Hook - Item 10)
Você é o Explorer 2 da Milestone M2 (R2: Segurança, Privacidade e LGPD).
Seu diretório de trabalho: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2
Seu orquestrador: 42a5e4fc-3e76-480a-9095-8d141e42fba1

Entradas obrigatórias:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/desktop/src/Kartodromo.Autoatendimento/

Missão de Exploração:
1. Inspecionar `desktop/src/Kartodromo.Autoatendimento/Program.cs`, `FormTotem.cs` e `Controles.cs`.
2. Verificar como o aplicativo atualmente trata teclas de sistema e escape do Windows em totens públicos com teclado físico USB.
3. Projetar a implementação de um Low-Level Keyboard Hook (`WH_KEYBOARD_LL`, 13) seguro em C# WinForms:
   - Interceptar e suprimir: Tecla Windows (LWin, RWin), Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4, teclas de contexto/menu de aplicativos.
   - Preservar integralmente: digitação normal de texto, números, símbolos, Backspace, Delete, Tab (para navegação entre campos se necessário), Enter, setas de navegação.
   - Ativação/Desativação: instalar o hook ao iniciar a aplicação e desinstalar de forma determinística (`UnhookWindowsHookEx`) no `Application.ApplicationExit` ou `FormClosed` para evitar deixar hooks órfãos no SO.
   - Tratar tecla de escape de emergência para manutenção (ex: combinação secreta ou apenas via comando remoto administrativo).
4. Elaborar recomendações de código completas, classes P/Invoke e cenários de teste.
Escreva seu relatório em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md` e envie mensagem ao orquestrador.


## 2026-10-26T22:10:37Z
Você é o Explorer 2 da Milestone M2 (R2: Segurança, Privacidade e LGPD - Item 10).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2.
Leia seu DISPATCH em: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/DISPATCH.md
Consulte:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/desktop/src/Kartodromo.Autoatendimento/

Investigue a proteção do quiosque contra escape para o Windows no teclado físico USB (Low-Level Keyboard Hook para WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4) em C# WinForms, preservando digitação normal de caracteres.
Escreva seu relatório técnico em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md e envie mensagem ao orquestrador (parent).

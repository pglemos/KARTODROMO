# BRIEFING — 2026-10-26T19:20:00Z

## Mission
Investigar e mapear exaustivamente no código C# WinForms (`Kartodromo.Autoatendimento`, `Kartodromo.Comum`), autoteste visual e scripts PowerShell todos os pontos de falha, causa-raiz e estratégias técnicas recomendadas para os 39 itens do totem de autoatendimento.

## 🔒 My Identity
- Archetype: explorer
- Roles: Explorer Especialista em Desktop WinForms, UX Kiosk e Infraestrutura
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1
- Original parent: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Milestone: Análise de Desktop WinForms, UX Kiosk e Infraestrutura do Totem

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Apps são programas Windows nativos (desktop/), nunca app web/Chrome
- Totem sem teclado na tela (regra do dono)
- Não mexer no telão (FormTV / --tv)
- Nunca colocar senha em arquivo versionado, commit ou log
- .agents/teamwork/ contém apenas metadados

## Current Parent
- Conversation ID: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Updated: 2026-10-26T19:09:19Z

## Investigation State
- **Explored paths**:
  - `desktop/src/Kartodromo.Autoatendimento/` (`FormTotem.cs`, `Controles.cs`, `Program.cs`, `appsettings.json`)
  - `desktop/src/Kartodromo.Comum/` (`Relatorio.cs`, `Atualizacao.cs`, `Api.cs`, `Fmt.cs`, `ValidacaoCliente.cs`)
  - `lib/ops/` (`totem-baterias.ts`, `cadastro-obrigatorio.ts`, `termo.ts`, `relatorios.ts`, `office.ts`)
  - `services/ops-server.ts` (rotas `/api/totem/identificar`, `/api/totem/cadastro`, `/api/totem/baterias`, `/api/totem/inscrever`)
  - `scripts/apps/` (`habilitar-admin-remoto-totem1.ps1`, `implantar-remoto.ps1`, `instalar-totem1.ps1`, `instalar-desktop.ps1`)
  - `scripts/configurar-ntp-totem1.ps1`
  - Autoteste visual (1366x768 e 1920x1080)
- **Key findings**:
  - `ImprimirSilencioso` cego no totem sem impressora configurada (`Config.Impressora == ""`), tentando imprimir na impressora padrão do Windows.
  - Altura térmica fixa de 297mm em `lib/ops/termo.ts` causando desperdício de bobina térmica na TM-T20.
  - Ausência de hook de teclado de baixo nível (`WH_KEYBOARD_LL`), permitindo escape do Kiosk para o desktop via teclas Win, Alt+Tab, Ctrl+Esc.
  - Instagram obrigatório sem opção para não usuários ("Não possuo Instagram").
  - Máscara de telefone e CPF salta cursor para o final (`novo.Length`) impedindo edição intermediária; telefone limitado a 11 dígitos nacionais sem suporte a turistas estrangeiros.
  - Atualização de endereço no totem zera `Numero` e `Complemento` (`SET Numero = NULL, Complemento = NULL`).
  - Edição assistida de nome/documento bloqueada para clientes existentes; erro 409 perde todos os dados digitados se o usuário voltar.
  - Perda de dependentes selecionados ao clicar em "Cadastrar menor"; menor pode se cadastrar sozinho sem responsável; adulto pode avançar sozinho sem dependentes.
  - Timer de 90s não intercepta rolagem do mouse wheel e fecha modais abertos no meio da leitura do cliente.
  - Ausência de preço e categorias em `OpcaoLinha` e na tela de sucesso (que só exibe uma única bateria).
  - Tolerância indevida permitindo agendamento de baterias que já iniciaram.
  - Concatenação SQL insegura em `/api/totem/baterias`.
  - Erro fatal de sintaxe PowerShell em `habilitar-admin-remoto-totem1.ps1` (parâmetros órfãos no bloco NTP).
  - Remoção indesejada do atalho de inicialização no `implantar-remoto.ps1`.
  - Timeout de 30s excessivo no cliente HTTP do totem.
  - `TratarInicioAsync` síncrono no `Program.cs` causando tela preta de inicialização.
  - Vazamentos de memória GDI em `ContextMenuStrip` não descartados e recriação contínua de bitmaps da logo.
  - Criação de `HttpClient` sem pool e sem cancelamento de requisições sobrepostas no `ViaCep`.
- **Unexplored areas**: Nenhuma pendente dentro do escopo de investigação.

## Key Decisions Made
- Consolidar relatório técnico detalhado no formato padrão de Handoff com 5 seções obrigatórias: Observação, Cadeia Lógica, Ressalvas, Conclusão e Método de Verificação.

## Artifact Index
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1/DISPATCH.md` — Histórico de despachos
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1/progress.md` — Liveness e progresso
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1/handoff.md` — Relatório técnico final de análise

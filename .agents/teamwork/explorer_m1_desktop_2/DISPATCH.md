# DISPATCH — Explorer M1 Desktop 2

## Milestone M1: R1 — Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6)

### Arquivos Alvo
- `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 770-785)
- `desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 290-305)
- `scripts/apps/limpar-spooler-totem.ps1` (Novo script PowerShell)

### Escopo e Missão
Investigar detalhadamente os pontos de alteração no desktop WinForms e scripts para:
1. Eliminar a tentativa cega de `ImprimirSilencioso` no totem quando `Config.Impressora` for vazio ou inexistente.
2. Garantir que, caso a resposta do servidor indique `termoNaRecepcao: false` ou se o envio para a recepção falhar, o totem exiba orientação clara ao cliente na tela (ex.: "Retire seu termo assinado na Recepção").
3. Desenvolver a especificação do script PowerShell `scripts/apps/limpar-spooler-totem.ps1` para limpar de forma segura as filas de spooler legadas (`EPSON TM-T20 Receipt`) nos totens .161 e .69 sem derrubar o Windows Spooler.
4. Fornecer plano cirúrgico para o Worker implementar.

Gere seu relatório em: `.agents/teamwork/explorer_m1_desktop_2/handoff.md`.

## 2026-10-26T19:26:40Z
Você é o Explorer Especialista em Desktop e Scripts para a Milestone M1 (Impressão e Gestão de Termos).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_desktop_2

Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).

Consulte também:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_desktop_2/DISPATCH.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_desktop_1/handoff.md
- desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
- desktop/src/Kartodromo.Comum/Relatorio.cs

Sua tarefa:
1. Elaborar a proposta técnica detalhada de código para:
   - Modificações em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: nunca tentar `ImprimirSilencioso` cego se `Config.Impressora` for vazia ou inválida; exibir aviso amigável na tela caso o termo deva ser retirado na recepção.
   - Modificações em `desktop/src/Kartodromo.Comum/Relatorio.cs`: validação antes de disparar impressão silenciosa.
   - Elaboração do script PowerShell `scripts/apps/limpar-spooler-totem.ps1`: limpeza segura das filas fantasmas `EPSON TM-T20 Receipt` nos totens sem paralisar o serviço de spooler do Windows.
2. Não implemente código de produção — apenas formule o plano de implementação.

Escreva seu relatório em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_desktop_2/handoff.md

Ao concluir, envie uma mensagem para o orquestrador (parent).

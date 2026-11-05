# BRIEFING — 2026-10-26T19:24:30Z

## Mission
Investigação técnica aprofundada de backend e banco de dados para os 39 itens do sistema de autoatendimento (totem) do Kartódromo de Betim.

## 🔒 My Identity
- Archetype: explorer
- Roles: Backend & Database Specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_backend_1
- Original parent: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Milestone: Diagnóstico e Análise Técnica do Backend de Autoatendimento (Totem)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Não modificar código-fonte de produção; apenas relatórios e propostas em minha pasta
- Identificar arquivos, linhas exatas, causas-raiz e propostas técnicas detalhadas

## Current Parent
- Conversation ID: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Updated: 2026-10-26T19:24:30Z

## Investigation State
- **Explored paths**:
  - `services/ops-server.ts`: linhas 207-250 (fila de impressão e identificação IP), 282-335 (`/api/totem/identificar` e PII), 337-388 (`/api/totem/cadastro`), 358-369 (deleção de Numero/Complemento), 390-421 (`/api/totem/baterias` e SQL não-parametrizada), 423-475 (`/api/totem/inscrever` e race condition), 576-595 (rotas de impressão).
  - `lib/ops/cadastro-obrigatorio.ts`: linhas 3-16 (peso e Instagram).
  - `lib/ops/instagram.ts`: linhas 10-15 (Instagram obrigatório).
  - `lib/ops/totem-baterias.ts`: linhas 15-24 e 34-40 (filtro de horário).
  - `lib/ops/office.ts`: linhas 419-470 (`inscreverN`, tolerância -30 min e concorrência).
  - `lib/ops/db.ts`: linhas 131-182 (`clienteColumns`, `updateCliente`).
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: validação de peso, ViaCep, 409 e baterias.
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`: validação de peso.
  - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`: agente de polling de impressão.
  - `migrations/ops/`: verificação da ausência de `dbo.FilaImpressao`.
- **Key findings**:
  1. Fila de impressão volátil em RAM (`filaImpressao: Impressao[]`) sem tabela no SQL Server, sofrendo descarte em 3h e perda total em reinício do `:4060`.
  2. Rota `/api/totem/identificar` expõe PII desmascarada (CPF, e-mail, telefone, endereço) e dados de menores.
  3. Amarração frágil de sessão por `req.socket.remoteAddress` (`identificadoNoTotem`) e IPs hardcoded (`192.168.20.161` / `.69`).
  4. Linha 369 de `ops-server.ts` destrói intencionalmente colunas `Numero` e `Complemento` em `dbo.Cliente` ao atualizar endereço.
  5. Desarmonia de peso (0-500 kg vs 20-250 kg) e obrigatoriedade indevida de Instagram para quem não possui.
  6. Interpolação direta de strings em SQL na rota `/api/totem/baterias`.
  7. Tolerância indevida de -30 minutos e ausência de filtro de horário permitindo reservas de baterias passadas.
  8. Inscrição de participantes em loops desintegrados sem transação externa atômica gerando race condition e grupos rachados.
  9. Instanciação contínua de `new HttpClient()` e falta de debounce/cancelamento no ViaCep.
- **Unexplored areas**: Nenhuma pendência no backend para o escopo solicitado.

## Key Decisions Made
- Relatório técnico estruturado e detalhado concluído em `handoff.md`.

## Artifact Index
- `.agents/teamwork/explorer_totem_backend_1/BRIEFING.md` — Memória persistente de trabalho
- `.agents/teamwork/explorer_totem_backend_1/DISPATCH.md` — Histórico de despachos
- `.agents/teamwork/explorer_totem_backend_1/progress.md` — Heartbeat e progresso
- `.agents/teamwork/explorer_totem_backend_1/handoff.md` — Relatório final estruturado (5 componentes completos)

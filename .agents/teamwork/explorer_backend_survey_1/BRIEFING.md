# BRIEFING — 2026-10-26T19:16:00Z

## Mission
Investigação read-only do backend (`services/ops-server.ts`, `lib/ops/*`, `migrations/ops/*`, integrações cronometragem) para apoiar a modernização da Recepção e estabilização de infra operacional (R1 a R6).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_backend_survey_1
- Original parent: 5c17e886-4fbe-41e6-80a1-62db6f4ee87a
- Milestone: Recepção e Backend Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Apontar trechos específicos com nomes de arquivos, métodos, queries SQL e números de linhas
- Metadados apenas em .agents/teamwork/explorer_backend_survey_1/

## Current Parent
- Conversation ID: 5c17e886-4fbe-41e6-80a1-62db6f4ee87a
- Updated: 2026-10-26T19:16:00Z

## Investigation State
- **Explored paths**:
  - `services/ops-server.ts` (756 linhas analisadas em detalhes)
  - `lib/ops/db.ts` (193 linhas: pool, query, tx, clienteColumns, updateCliente)
  - `lib/ops/office.ts` (1837 linhas: caixa, vendas, estornos, baterias, clientes, vouchers)
  - `lib/ops/auth.ts` (56 linhas: hash scrypt, emiteToken, renovaToken, validaToken)
  - `lib/ops/relatorios.ts` (251 linhas: relatórios de fechamento, participantes, receitas, ticket)
  - `lib/ops/termo.ts` (220 linhas: renderTermoResponsabilidade, layout 80mm vs 297mm)
  - `lib/ops/totem-baterias.ts` (41 linhas: TOTEM_BATERIAS_SQL, filtro de baterias)
  - `lib/ops/cadastro-obrigatorio.ts` e `lib/ops/instagram.ts` (validações de peso e Instagram)
  - `migrations/ops/` (0001 a 0010: tabelas Cliente, Bateria, Inscricao, Movimento, Venda, Perfil, etc.)
  - `services/timing-server.ts` e integração cronometragem (`x-ops-key`, rotas `/api/crono/*`)
  - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` e `Relatorio.cs` (consumo da fila de impressão)
- **Key findings**:
  - R1: Fila em memória volátil (`filaImpressao: Impressao[]` em `ops-server.ts:211-233`), expiração destrutiva de 3h, sem persistência em SQL Server. Layout fixo de 297 mm em `termo.ts:192,196` causa desperdício na bobina de 80 mm da TM-T20.
  - R2: Ausência de lock/transação em abertura de caixa (`office.ts:1672`), sangria sem bloqueio concorrente (`office.ts:1699`), `criarVenda` consulta movimento fora de `tx` (`office.ts:478`), estorno com risco de corrida e cancelamento incorreto de vouchers em massa (`office.ts:630`).
  - R3: Tolerância indevida de -30 min em novas reservas (`office.ts:426`). Baterias expiradas visíveis no Totem (`totem-baterias.ts:15`). Interpolação dinâmica de SQL `${lista}` e `${rows}` em `ops-server.ts:401`.
  - R4: Exposição pública massiva de dados pessoais (PII) de clientes e dependentes menores em `/api/totem/identificar` (`ops-server.ts:310`). Sobrescrita destrutiva de `Numero` e `Complemento` com NULL em `ops-server.ts:369`. Instagram obriga todos os clientes (`instagram.ts:11`). Divergência de validação de peso entre FormTotem.cs e cadastro-obrigatorio.ts.
  - R5: Rota `/api/crono/uso-karts` faz full table scans por causa de `TRY_CAST(LTRIM(RTRIM(Kart)) AS int)` em `ops-server.ts:626`. Sincronização bloqueante de traçados na chamada de baterias.
  - R6: Ausência de `uncaughtException` e `unhandledRejection` derruba processo Node.js em erros assíncronos. Inicialização de pool em `db.ts:15` sem trava contra corrida e sem listener de `'error'`.
- **Unexplored areas**: Nenhuma área do escopo backend ficou inexplorada.

## Key Decisions Made
- Estruturar o relatório handoff.md em 5 componentes rigorosos conforme o Handoff Protocol.
- Mapear com precisão cirúrgica cada arquivo, método, query SQL e linha de código.

## Artifact Index
- `DISPATCH.md` — Mensagem de inicialização
- `BRIEFING.md` — Memória de trabalho persistente
- `progress.md` — Heartbeat de execução
- `handoff.md` — Relatório final abrangente de 5 seções

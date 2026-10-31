# DISPATCH — Worker Milestone M1

## Escopo: R1 — Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6)

### Arquivos sob Propriedade Exclusiva de Escrita:
1. `migrations/ops/0011_fila_impressao_indices.sql` (ou harmonização com `0011_fila_impressao.sql`)
2. `services/ops-server.ts` (linhas 207-234, 471, 576-595)
3. `lib/ops/termo.ts` (linhas 192 e 196)
4. `tests/ops/termo.test.ts` (linhas 34 e adjacentes)
5. `tests/ops/migration-0011.test.ts` (harmonização da regex do CHECK constraint de status)
6. `desktop/src/Kartodromo.Comum/Relatorio.cs` (validação de impressora e segurança em `ImprimirSilencioso`)
7. `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (eliminação de impressão cega e aviso na tela de sucesso)
8. `scripts/apps/limpar-spooler-totem.ps1` (novo script de purga segura do spooler)

### Fontes de Verdade e Instruções Técnicas:
Consulte e aplique rigorosamente as especificações detalhadas nos 3 relatórios de handoff dos Explorers:
- `.agents/teamwork/explorer_m1_backend_1/handoff.md` (esquema SQL, `services/ops-server.ts`, `termo.ts`, `termo.test.ts`)
- `.agents/teamwork/explorer_m1_desktop_2/handoff.md` (`Relatorio.cs`, `FormTotem.cs`, `limpar-spooler-totem.ps1`)
- `.agents/teamwork/spec_miner_m1_3/handoff.md` (contrato da recepção e compatibilidade do `AgenteImpressao.cs`)

### Verificação Obrigatória:
- Executar `npx vitest run tests/ops/termo.test.ts tests/ops/migration-0011.test.ts` e toda a suíte `npx vitest run tests/ops/`.
- Executar `npx tsc --noEmit` para garantir que nenhuma nova falha de tipagem foi introduzida.
- Documentar comandos e resultados no seu `handoff.md`.

## 2026-10-26T19:36:57Z
Você é o Worker de Implementação encarregado de aplicar as alterações da Milestone M1 (R1 — Impressão e Gestão de Termos de Responsabilidade - Itens 1 a 6).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1

Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).

Consulte também:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1/DISPATCH.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_desktop_2/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m1_3/handoff.md

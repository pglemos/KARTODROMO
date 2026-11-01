## 2026-10-26T22:23:13Z
Você é auditor_m2_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/auditor_m2_1

Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_gen2/handoff.md

Missão:
Auditoria Forense de Integridade da Milestone M2 (Servidor Backend Operacional).
Realizar auditoria forense rigorosa e independente sobre todo o trabalho entregue pelo worker_m2_gen2:
1. Inspeção estática de código:
   - Verificar se as implementações são genuínas em `services/ops-server.ts`, `lib/ops/termo.ts`, `lib/ops/totem-baterias.ts`, `lib/ops/office.ts`, `lib/ops/db.ts`, `lib/ops/instagram.ts`, `lib/ops/cadastro-obrigatorio.ts`.
   - Verificar se NÃO HÁ hardcoding de testes, valores falsos, mocks no código de produção ou simulações artificiais.
   - Verificar se a query da Fila de Impressão usa genuinamente a tabela `dbo.FilaImpressao` e a CTE oficial.
   - Verificar se a query de uso de karts usa genuinamente a coluna persistida `KartNumero`.
   - Verificar se a parametrização SQL no totem usa parâmetros reais `@bat_` e `@grp_`.
   - Verificar se os testes em `tests/ops/m2-backend.test.ts` e suíte geral testam lógica real com asserções válidas.
2. Checagem de vetos e regras do dono:
   - NÃO alterou FormTV (`--tv`).
   - Manteve programas nativos Windows.
   - Respeitou isolamento e sem senhas em texto claro.
3. Emitir veredito forense binário explícito no seu handoff.md:
   - CLEAN (se íntegro) ou INTEGRITY VIOLATION / CHEATING DETECTED (se houver violação).
4. Notificar o orquestrador via send_message com seu veredito.

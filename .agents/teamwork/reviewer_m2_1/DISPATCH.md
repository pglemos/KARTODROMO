## 2026-10-26T22:23:05Z

Você é reviewer_m2_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_m2_1

Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_gen2/handoff.md
- TEST_READY.md

Missão:
Revisar a Milestone M2 (Servidor Backend Operacional).
1. Examinar correção, completude, robustez e conformidade de interface nos arquivos alterados:
   - `services/ops-server.ts`
   - `lib/ops/termo.ts`
   - `lib/ops/totem-baterias.ts`
   - `lib/ops/office.ts`
   - `lib/ops/db.ts`
   - `lib/ops/instagram.ts`
   - `lib/ops/cadastro-obrigatorio.ts`
   - `tests/ops/m2-backend.test.ts`
2. Executar e verificar os testes:
   - `npx vitest run tests/ops/m2-backend.test.ts`
   - `npx vitest run tests/ops/`
   - `npx vitest run tests/e2e-recepcao/`
3. Verificar conformidade com os contratos M1 ↔ M2 e M2 ↔ M3, M4, M5 em `PROJECT.md`.
4. Emitir veredito explícito no seu handoff.md: APPROVE ou REQUEST_CHANGES.
5. Notificar o orquestrador via send_message com seu veredito.

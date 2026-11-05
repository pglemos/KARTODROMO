# Progress - Milestone M2 (Servidor Backend Operacional)

Last visited: 2026-10-26T22:21:00Z

## Status: Concluído com Sucesso (100% dos Requisitos e Testes Aprovados)

### Passos Concluídos:
- [x] Leitura de ORIGINAL_REQUEST.md, PROJECT.md, survey/handoff.md, M1 handoff.md, migration 0011.
- [x] Criação de DISPATCH.md e BRIEFING.md.
- [x] Requisito 1: Fila de impressão persistida no banco relacional `dbo.FilaImpressao`:
  * Gravando com INSERT em `dbo.FilaImpressao`.
  * `GET /api/office/impressao/proxima` implementado com CTE atômica UPDLOCK + READPAST conforme `PROJECT.md`.
  * `POST /api/office/impressao/:id/feita` atualizando Status = 'impressa' e FeitaEm = SYSDATETIME().
  * `POST /api/office/impressao/:id/falhou` atualizando Status = 'falhou' e FalhouEm = SYSDATETIME().
  * `GET /api/office/impressao/fila` consultando histórico do banco sem purga destrutiva na RAM.
- [x] Requisito 2: Eliminação do desperdício de bobina térmica em `lib/ops/termo.ts`:
  * `@page { size: 80mm auto; margin: 0; }`
  * `.page { position: relative; width: 80mm; min-height: auto; padding: 0 5.7mm 4mm; margin: 0 auto; break-after: page; }`
  * Testes atualizados em `tests/ops/termo.test.ts` e `tests/ops/termo-challenger.test.ts`.
- [x] Requisito 3: Proteção de dados pessoais (PII) em `POST /api/totem/identificar`:
  * Mascaramento de CPF (`123.***.***-00`), e-mail (`u***@***.com`), telefone (`(**) *****-1234`) e endereço.
  * Ocultação de número e complemento em texto claro na consulta pública.
- [x] Requisito 4: Preservação de dados de endereço:
  * Remoção do comando destrutivo `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` em `/api/totem/cadastro`.
  * Proteção contra sobrescrita com dados mascarados.
- [x] Requisito 5: Bloqueio de baterias vencidas:
  * Remoção da tolerância de -30 minutos em `lib/ops/office.ts:426` (`CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada`).
  * Bloqueio de baterias com início vencido em `lib/ops/totem-baterias.ts` e filtro por `b.Inicio >= SYSDATETIME()`.
  * Teste atualizado em `tests/ops/totem-baterias.test.ts`.
- [x] Requisito 6: Parametrização segura SQL em baterias do grupo:
  * Parâmetros nomeados `@bat_...` e `@grp_...` no lugar de interpolação direta de `${lista}`.
- [x] Requisito 7: Correção no estorno de vouchers em `lib/ops/office.ts:650`:
  * Estorno individual e cirúrgico do `VoucherUso` atrelado ao item cancelado, sem estorno em lote de todos os vouchers da venda.
- [x] Requisito 8: Regras de cadastro flexíveis:
  * Instagram opcional em `lib/ops/instagram.ts`.
  * Faixa harmonizada de peso (10 a 250 kg) em `lib/ops/cadastro-obrigatorio.ts`.
  * Testes atualizados em `tests/ops/instagram.test.ts` e `tests/ops/office-routes.test.ts`.
- [x] Requisito 9: Otimização de performance em `/api/crono/uso-karts`:
  * Consulta com `WHERE KartNumero = @n` aproveitando os índices criados na Milestone M1.
- [x] Requisito 10: Estabilidade de runtime:
  * Listener de erro resiliente no pool MSSQL em `lib/ops/db.ts`.
  * Capturadores globais `uncaughtException` e `unhandledRejection` registrados em `services/ops-server.ts`.
- [x] Requisito 11: Verificação e Testes:
  * Criação da nova suíte `tests/ops/m2-backend.test.ts` com 21 testes cobrindo todos os contratos e comportamentos de M2.
  * Execução de `npx vitest run tests/ops/`: 18 arquivos de teste, 270 testes passando com 100% de sucesso.
  * Execução de `npx vitest run tests/e2e-recepcao/`: 4 arquivos de teste, 87 testes passando com 100% de sucesso.
  * Execução de `npx tsc --noEmit`: 0 novos erros de tipo no backend (apenas os 4 erros conhecidos em arquivos fora do escopo).

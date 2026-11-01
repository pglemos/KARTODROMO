# Handoff Report — Reviewer M2.2: Segurança, Concorrência e LGPD (Milestone M2)

## 1. Observation

Foi realizada uma revisão independente, aprofundada e adversarial das implementações da Milestone M2 no backend Node.js / TypeScript (`services/ops-server.ts`, `lib/ops/termo.ts`, `lib/ops/totem-baterias.ts`, `lib/ops/office.ts`, `lib/ops/db.ts`, `lib/ops/instagram.ts` e `lib/ops/cadastro-obrigatorio.ts`), com foco em segurança, concorrência, conformidade com a LGPD e integridade relacional:

1. **Mascaramento de PII em `POST /api/totem/identificar` e Proteção em `POST /api/totem/cadastro`**:
   - `services/ops-server.ts:269-310`: Implementadas funções dedicadas de mascaramento:
     - `mascararDocumento`: Formata CPF como `123.***.***-00` e outros documentos como `ab***yz`.
     - `mascararEmail`: Formata e-mail como `u***@***.com`.
     - `mascararTelefone`: Formata telefone como `(**) *****-1234`.
     - `mascararEndereco`: Formata endereço como `Rua ***, ***`.
   - `services/ops-server.ts:387-407`: Resposta pública do totem expõe apenas campos mascarados; `numero` e `complemento` retornam strings vazias (`''`).
   - `services/ops-server.ts:377-380, 408`: Lista de dependentes menores expõe estritamente `id`, `nome`, `nascimento` e token assinado, sem expor documentos de contato ou e-mails em texto claro.
   - `services/ops-server.ts:434-450`: No endpoint de atualização cadastral (`POST /api/totem/cadastro`), campos que retornam com máscara contendo `***` (`documento`, `email`, `telefone`, `cep`, `endereco`) são expressamente excluídos (`delete dados[campo]`) antes de chamar `updateCliente`, impedindo a corrupção de dados reais no banco.

2. **Preservação de `Numero` e `Complemento` (Remoção do Update Destrutivo com NULL)**:
   - Verificado `services/ops-server.ts`: A antiga instrução `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id` foi completamente eliminada (0 ocorrências no código de produção).
   - `lib/ops/db.ts:147-152, 191-198`: Em `updateCliente`, com a flag `partial = true`, valores nulos ou vazios não entram na cláusula `SET`, preservando os dados relacionais históricos de endereço.
   - `services/ops-server.ts:441-450`: Se o cliente não alterou o endereço ou enviou valor idêntico à concatenação de `Endereco, Numero - Complemento`, o campo `endereco` também é descartado do update.

3. **Bloqueio de Baterias Vencidas (Remoção da Tolerância de -30 min e Filtros no Totem)**:
   - `lib/ops/office.ts:426`: A cláusula SQL anterior `CASE WHEN b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 1 ELSE 0 END passada` foi substituída por `CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada`.
   - `lib/ops/office.ts:432`: Se `b.passada = 1`, o backend rejeita a reserva imediatamente com `HTTP 409: "Não é permitido reservar para baterias que já ocorreram!"`.
   - `lib/ops/totem-baterias.ts:22`: `TOTEM_BATERIAS_SQL` filtra no banco `AND b.Inicio >= SYSDATETIME()`.
   - `lib/ops/totem-baterias.ts:36-44`: `bateriaDisponivelNoTotem` rejeita baterias cujo horário de início já passou.

4. **Parametrização Segura de Consultas SQL com `@bat_` e `@grp_`**:
   - `services/ops-server.ts:482-509`: Na rota `GET /api/totem/baterias`, a query dinâmica de vagas do grupo substituiu interpolações de strings (`${rows...}`) por parâmetros nomeados `@bat_0, @bat_1, ...` e `@grp_0, @grp_1, ...`.
   - Todos os valores são validados, convertidos para `Number` e injetados de forma tipada via `req.input()` no driver `mssql`.

5. **Estorno Cirúrgico de `VoucherUso`**:
   - `lib/ops/office.ts:649-654`: No cancelamento de itens de venda, o `UPDATE` em lote que afetava todos os vouchers da venda foi substituído por:
     ```sql
     UPDATE TOP (1) dbo.VoucherUso
     SET Estornado = 1
     WHERE VendaId = @vendaId AND VoucherId = @voucherId AND Estornado = 0
     ```
   - O estorno é cirurgicamente direcionado ao `VoucherId` específico do item cancelado, mantendo íntegros os vouchers dos demais itens da mesma venda.

6. **Estabilidade de Runtime (Pool Error Listener e Process Handlers)**:
   - `lib/ops/db.ts:28-44`: Adicionado listener `newPool.on('error', ...)` tratando erros em conexões ociosas, evitando crashes súbitos do processo Node.js e limpando `pool = null` caso desconectado. Adicionado controle de concorrência com a Promise `poolConnecting`.
   - `services/ops-server.ts:918-927`: Registrados capturadores globais `process.on('uncaughtException')` e `process.on('unhandledRejection')` que gravam stack traces de auditoria no log sem derrubar o serviço.

7. **Resultados da Execução de Testes e Tipos**:
   - `npx vitest run tests/ops/`: 18 arquivos, 270 testes executados, 270 PASSADOS (100% sucesso).
   - `npx vitest run tests/e2e-recepcao/`: 4 arquivos, 87 testes executados, 87 PASSADOS (100% sucesso).
   - `npx vitest run tests/ops/m2-adversarial-challenger.test.ts`: 1 arquivo, 17 testes de estresse adversarial, 17 PASSADOS (100% sucesso).
   - `npx tsc --noEmit`: Zero erros nos arquivos modificados da Milestone M2. (Os 4 erros existentes pertencem a arquivos fora do escopo: `lib/ops/endurance.ts` e `tests/timing-33-fixes.test.ts`).

8. **Auditoria de Integridade**:
   - Não foram detectados resultados de teste hardcoded nos fontes.
   - Não foram detectadas implementações dummy ou fachadas vazias.
   - Não foram identificados atalhos ou bypasses de regras operacionais.

---

## 2. Logic Chain

1. **Proteção LGPD e Preservação Cadastral**: O autoatendimento público em totens é acessível a qualquer cliente que digite um CPF ou e-mail. Ao mascarar CPF (`123.***.***-00`), e-mail (`u***@***.com`), telefone (`(**) *****-1234`), endereço e omitir número e complemento, o sistema cumpre as exigências da LGPD, impedindo o vazamento de dados de pilotos e dependentes menores. Ao mesmo tempo, a proteção simétrica no backend que deleta campos com `***` do payload do update assegura que a leitura de dados mascarados pelo formulário não degrade os dados reais previamente gravados no banco de dados.
2. **Eliminação do Update Destrutivo**: Anteriormente, ao receber um endereço unificado do totem, o backend executava `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`. Ao eliminar essa query e usar updates parciais (`partial = true`) que ignoram campos omitidos, as colunas `Numero` e `Complemento` permanecem 100% intactas para cadastros existentes.
3. **Bloqueio Efetivo de Baterias Vencidas**: A tolerância anterior de -30 minutos gerava sérios conflitos operacionais na recepção e na pista, permitindo que pilotos comprassem baterias que já haviam largado. Com a substituição por `b.Inicio < SYSDATETIME()`, o bloqueio com `HTTP 409` é instantâneo. Em paralelo, a query do totem (`b.Inicio >= SYSDATETIME()`) e a validação em memória impedem que baterias já iniciadas apareçam na tela de autoatendimento.
4. **Segurança contra Injeção SQL**: A rota `/api/totem/baterias` recebe listas dinâmicas de IDs de grupos e baterias. A substituição de interpolação textual direta por parâmetros gerados programaticamente (`@bat_0, @bat_1...` e `@grp_0, @grp_1...`) neutraliza qualquer possibilidade de SQL injection por manipulação de parâmetros de requisição.
5. **Precisão Financeira em Estornos**: Em vendas agrupadas contendo múltiplos participantes ou múltiplos vouchers, o cancelamento de uma única inscrição marcava todos os vouchers da venda como estornados. A restrição cirúrgica `WHERE VendaId = @vendaId AND VoucherId = @voucherId AND Estornado = 0` garante que apenas o voucher cancelado seja devolvido, evitando perdas financeiras ou inconsistências no fechamento de caixa.
6. **Resiliência do Servidor :4060**: A conexão com o SQL Server local através de pool de conexões pode emitir eventos de erro assíncronos (por exemplo, durante reinícios do serviço do SQL Server ou timeouts de socket). O registro explícito do evento `newPool.on('error')` e dos handlers globais do processo impede encerramentos anômalos do processo Node.js em produção, atendendo aos requisitos de alta disponibilidade do kartódromo.

---

## 3. Caveats

1. **Reimpressão Manual de Contingência (`/api/office/impressao/:id/reimprimir`)**: O endpoint atual reseta o status para `pendente`, `Tentativas = 0` e `PegoEm = NULL`, porém mantém o `CriadoEm` original. Se um termo em contingência (> 3h) for reenfileirado manualmente e uma nova chamada a `enfileirarImpressao` for executada posteriormente, a query de saneamento de contingência pode reclassificá-lo como contingência se `CriadoEm` continuar com mais de 3 horas. Recomenda-se para as próximas etapas atualizar também `CriadoEm = SYSDATETIME()` na rota de reimpressão.
2. **Dependência de Migração em Produção**: As consultas da Milestone M2 utilizam as tabelas e índices criados na migração `migrations/ops/0011_fila_impressao_indices.sql` (`dbo.FilaImpressao`, `IX_Manutencao_KartNumero`, `UX_Movimento_TerminalAberto`). Em ambiente de produção no SRVKART, a migração 0011 deve ser executada antes de subir a nova versão do `ops-server.ts`.
3. **Erros de Tipos Pré-existentes**: Os 4 erros reportados por `tsc --noEmit` pertencem a rotas de endurance (`lib/ops/endurance.ts`) e testes legados de timing (`tests/timing-33-fixes.test.ts`), sem qualquer relação com a M2 nem impacto no runtime do servidor operacional.

---

## 4. Conclusion

**Verdict: APPROVE**

A Milestone M2 (Servidor Backend Operacional) foi integralmente auditada, testada e homologada:
- Todos os 6 eixos de segurança, concorrência, privacidade (LGPD) e integridade de banco foram implementados com rigor técnico e conformidade aos requisitos.
- 100% dos testes unitários e de integração passaram com sucesso (270 testes em `tests/ops/` e 87 testes em `tests/e2e-recepcao/`).
- Os 17 testes de estresse adversarial em `tests/ops/m2-adversarial-challenger.test.ts` comprovaram a estabilidade sob alta concorrência e condições de borda.
- Zero violações de integridade, zero atalhos ou dados fabricados.
- O código do backend está aprovado para prosseguimento para as Milestones M3 (Desktop Comum & Periféricos) e M4/M5 (Desktop Recepção).

---

## 5. Verification Method

Para reproduzir e verificar de forma independente todas as validações realizadas:

1. **Executar a suíte de testes de operações**:
   ```bash
   npx vitest run tests/ops/
   ```
   *Resultado observado*: 18 arquivos, 270 testes passando com 100% de sucesso.

2. **Executar a suíte de testes E2E da recepção**:
   ```bash
   npx vitest run tests/e2e-recepcao/
   ```
   *Resultado observado*: 4 arquivos, 87 testes passando com 100% de sucesso.

3. **Executar a bateria de testes de estresse adversarial da M2**:
   ```bash
   npx vitest run tests/ops/m2-adversarial-challenger.test.ts
   ```
   *Resultado observado*: 17 testes de estresse passando com 100% de sucesso.

4. **Verificar ausência de erros de tipo nos arquivos da M2**:
   ```bash
   npx tsc --noEmit
   ```
   *Resultado observado*: Zero erros nos arquivos da Milestone M2 (`services/ops-server.ts`, `lib/ops/termo.ts`, `lib/ops/totem-baterias.ts`, `lib/ops/office.ts`, `lib/ops/db.ts`, `lib/ops/instagram.ts`, `lib/ops/cadastro-obrigatorio.ts`).

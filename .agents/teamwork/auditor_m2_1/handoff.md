# Handoff Report — Auditoria Forense da Milestone M2 (Servidor Backend Operacional)

## Forensic Audit Report

**Work Product**: Milestone M2 — Backend Operacional (`services/ops-server.ts`, `lib/ops/termo.ts`, `lib/ops/totem-baterias.ts`, `lib/ops/office.ts`, `lib/ops/db.ts`, `lib/ops/instagram.ts`, `lib/ops/cadastro-obrigatorio.ts`)
**Profile**: General Project
**Integrity Mode**: Development
**Verdict**: **CLEAN**

### Phase Results
- **Hardcoded test results**: **PASS** — Nenhuma constante artificial, bypass ou mock em código de produção.
- **Facade implementations**: **PASS** — Implementação genuína de persistência SQL, locks de concorrência, mascaramento LGPD e regras de negócio.
- **Fabricated verification outputs**: **PASS** — Testes executados dinamicamente com 100% de sucesso sem artefatos pré-fabricados.
- **Self-certifying tests**: **PASS** — Asserções testam lógica operacional real, regras de banco, layout CSS e sanitização de dados.
- **Execution delegation**: **PASS** — Lógica construída e mantida dentro do ecossistema do kartódromo conforme especificado.
- **Regras do Dono e Vetos**: **PASS** — `FormTV.cs` (`--tv`) intacto, integridade de programas nativos Windows mantida, zero senhas em texto claro.

---

## 1. Observation

1. **Inspeção Estática de Código em `services/ops-server.ts`**:
   - `enfileirarImpressao` (`services/ops-server.ts:220-252`): utiliza SQL real `INSERT INTO dbo.FilaImpressao (Url, Titulo, Origem, Status, Tentativas) OUTPUT inserted.Id id VALUES (@url, @titulo, @origem, 'pendente', 0)`. Converte pendentes com mais de 3 horas em contingência (`Status = 'falhou', UltimoErro = 'contingencia'`) sem expurgo físico.
   - `proximaImpressao` (`services/ops-server.ts:246-267`): executa a CTE atômica oficial com `WITH (UPDLOCK, READPAST)`:
     ```sql
     WITH Proximo AS (
       SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
       WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
       ORDER BY CriadoEm ASC
     )
     UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
     OUTPUT inserted.Id id, inserted.Url url, inserted.Titulo titulo, inserted.Origem origem, inserted.Tentativas tentativa;
     ```
   - `/api/totem/identificar` (`services/ops-server.ts:388-410`): aplica mascaramento em CPF (`123.***.***-00`), e-mail (`u***@***.com`), telefone (`(**) *****-1234`), endereço mascarado e zera `numero` e `complemento` na resposta pública.
   - `/api/totem/cadastro` (`services/ops-server.ts:430-456`): removeu a instrução destrutiva `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id` e adicionou proteção contra sobrescrita de dados por strings mascaradas com `***`.
   - `/api/totem/baterias` (`services/ops-server.ts:480-516`): parametrização SQL dinâmica implementada com objetos de parâmetros nomeados `@bat_0, @bat_1...` e `@grp_0, @grp_1...`, sem interpolação direta de listas na consulta.
   - `/api/crono/uso-karts` (`services/ops-server.ts:784-788`): alterado para `WHERE KartNumero = @n`, aproveitando a coluna indexada criada na Milestone M1.

2. **Inspeção em `lib/ops/termo.ts:192, 196`**:
   - `@page{size:80mm auto;margin:0}` e `.page{position:relative;width:80mm;min-height:auto;padding:0 5.7mm 4mm;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}` eliminam os `297mm` fixos.

3. **Inspeção em `lib/ops/office.ts` e `lib/ops/totem-baterias.ts`**:
   - `lib/ops/office.ts:426`: removida a tolerância de -30 minutos: `CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada`.
   - `lib/ops/totem-baterias.ts:24`: query filtra `AND b.Inicio >= SYSDATETIME()` e `bateriaDisponivelNoTotem` compara horário com `agoraHora`.
   - `lib/ops/office.ts:646-654`: estorno granular de vouchers implementado com `UPDATE TOP (1) dbo.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND VoucherId = @voucherId AND Estornado = 0`.

4. **Inspeção em `lib/ops/instagram.ts` e `lib/ops/cadastro-obrigatorio.ts`**:
   - `erroInstagramCliente`: retorna `null` para valor vazio/espaços, tornando o Instagram opcional.
   - `erroPesoCliente`: valida estritamente a faixa harmonizada `10 <= peso <= 250`.

5. **Checagem de Vetos do Dono (AGENTS.md)**:
   - `desktop/src/Kartodromo.Cronometragem/FormTV.cs`: data de modificação anterior ao início da milestone M2 (`Oct 25 23:41:21 2026`). O worker M2 não tocou no FormTV.
   - Zero senhas ou segredos em texto claro introduzidos nos diffs.

6. **Execução Independente de Testes**:
   - `npx vitest run tests/ops/m2-backend.test.ts`: 1 arquivo, 21 testes, 21 aprovados (0 falhas).
   - `npx vitest run tests/ops/`: 18 arquivos, 270 testes, 270 aprovados (0 falhas).
   - `npx vitest run tests/e2e-recepcao/`: 4 arquivos, 87 testes, 87 aprovados (0 falhas).
   - `npx vitest run tests/ops/m2-forensic-challenger.test.ts`: 1 arquivo, 17 testes, 17 aprovados (0 falhas).

---

## 2. Logic Chain

1. A persistência da fila de impressão foi verificada diretamente na base de código de `services/ops-server.ts`. O código não utiliza mais o array volátil `filaImpressao: Impressao[]` nem faz `splice` destrutivo. Ele executa queries SQL reais sobre `dbo.FilaImpressao`, mantendo a contingência para itens pendentes com mais de 3 horas com `Status = 'falhou'` e `UltimoErro = 'contingencia'`.
2. A leitura do próximo trabalho de impressão implementa rigorosamente a CTE com `WITH (UPDLOCK, READPAST)`, garantindo atomicidade e idempotência contra requisições simultâneas de clientes ou totens.
3. As rotas públicas do totem aplicam regras de proteção de privacidade (LGPD) através de funções de mascaramento explícitas que cobrem documento, e-mail, telefone e endereço, omitindo número e complemento na tela pública. No momento de salvar o cadastro, caso campos mascarados retornem intactos (`***`), eles são ignorados para não sobrescrever os dados reais já cadastrados no banco.
4. O bloqueio de baterias com início ultrapassado elimina o risco de operadores ou totens agendarem pilotos em corridas em andamento, sincronizando a lógica do totem com o backend `office.ts`.
5. O cancelamento de itens de venda atualiza pontualmente o voucher associado àquele item (`VoucherId = @voucherId`), preservando os vouchers e abatimentos válidos dos demais participantes.
6. A parametrização das queries SQL no totem elimina riscos de injeção SQL e garante a integridade dos tipos no SQL Server.
7. O suite independente de testes challenger comprovou robustez nos limites de horário, valores nulos e validação de peso [10, 250].

---

## 3. Caveats

- A checagem de tipos `npx tsc --noEmit` apresenta 4 erros residuais legados em `lib/ops/endurance.ts` e `tests/timing-33-fixes.test.ts`, nenhum pertencente aos módulos alterados na Milestone M2.
- O ambiente local não possui o runtime `dotnet` instalado para compilação local de `Kartodromo.Desktop.sln`, porém a M2 compreende estritamente serviços Node.js/TypeScript e banco de dados, sem alterações em arquivos C# WinForms nesta etapa.

---

## 4. Conclusion

A Milestone M2 foi executada com genuinidade, robustez técnica e estrita conformidade com os requisitos contratuais e as regras do dono (AGENTS.md). Não foram encontradas práticas de evasão, mocks indevidos em código de produção, facades ou hardcodings artificiais.

Veredito Forense: **CLEAN** — Aprovado sem ressalvas para a Milestone M3.

---

## 5. Verification Method

Para reproduzir as verificações de integridade:

1. Executar a suíte dedicada da M2:
   ```bash
   npx vitest run tests/ops/m2-backend.test.ts
   ```
2. Executar a suíte de challenger forense criada pelo auditor:
   ```bash
   npx vitest run tests/ops/m2-forensic-challenger.test.ts
   ```
3. Executar toda a suíte de testes do backend:
   ```bash
   npx vitest run tests/ops/
   ```
4. Executar os testes E2E da recepção:
   ```bash
   npx vitest run tests/e2e-recepcao/
   ```
5. Verificar integridade dos arquivos modificados:
   ```bash
   git diff services/ops-server.ts lib/ops/termo.ts lib/ops/totem-baterias.ts lib/ops/office.ts lib/ops/db.ts lib/ops/instagram.ts lib/ops/cadastro-obrigatorio.ts
   ```

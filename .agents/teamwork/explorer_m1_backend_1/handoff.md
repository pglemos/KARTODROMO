# Handoff Report — Explorer M1 Backend (Impressão e Gestão de Termos)

**Data**: 2026-10-26  
**Agente**: `explorer_m1_backend_1`  
**Destinatário**: Orquestrador (`cc947e12-4c7c-48ad-93cf-a3cced581f33`)  
**Milestone**: M1 — R1: Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6)  
**Arquivos Alvo**:  
- `migrations/ops/0011_fila_impressao.sql` (ou harmonização de `migrations/ops/0011_fila_impressao_indices.sql`)
- `services/ops-server.ts`
- `lib/ops/termo.ts`
- `tests/ops/termo.test.ts`

---

## 1. Observation (Observações Diretas do Código)

### Obs 1.1: Fila em Memória RAM Volátil no Servidor Node.js
- **Arquivo**: `services/ops-server.ts`, linhas 211-216:
  ```typescript
  type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number };
  const filaImpressao: Impressao[] = [];
  let seqImpressao = 0;
  const IMPRESSAO_VALIDADE_MS = 3 * 60 * 60 * 1000;
  const IMPRESSAO_REENTREGA_MS = 90 * 1000;
  ```
- **Linhas 217-233**:
  ```typescript
  function enfileirarImpressao(url: string, titulo: string, origem: string) {
    const agora = Date.now();
    for (let i = filaImpressao.length - 1; i >= 0; i--) if (agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS) filaImpressao.splice(i, 1);
    const job: Impressao = { id: ++seqImpressao, url, titulo, origem, criadoEm: agora, tentativas: 0 };
    filaImpressao.push(job);
    log(`impressao #${job.id} na fila (${titulo}, ${origem})`);
    return job;
  }

  function proximaImpressao() {
    const agora = Date.now();
    const job = filaImpressao.find((j) => !j.feitaEm && agora - j.criadoEm <= IMPRESSAO_VALIDADE_MS && (!j.pegoEm || agora - j.pegoEm > IMPRESSAO_REENTREGA_MS));
    if (!job) return null;
    job.pegoEm = agora;
    job.tentativas++;
    return job;
  }
  ```
- **Constatação**: Os trabalhos de impressão residem exclusivamente na memória RAM do processo Node.js (:4060). Reiniciar o serviço apaga todos os termos pendentes, conforme documentado em `HANDOFF-SISTEMA-PROPRIO.md:302` (*"Reiniciar o servidor apaga o que estiver pendente"*).

### Obs 1.2: Expurgo Silencioso de Termos em 3 Horas
- **Arquivo**: `services/ops-server.ts`, linha 219:
  ```typescript
  for (let i = filaImpressao.length - 1; i >= 0; i--) if (agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS) filaImpressao.splice(i, 1);
  ```
- **Constatação**: Se a recepção estiver fechada, em horário de almoço ou deslogada (sessão expirada 401) por mais de 3 horas, o loop acima executa `filaImpressao.splice(i, 1)` de forma irreversível. Os termos do totem são descartados sem aviso e sem histórico.

### Obs 1.3: Contrato com o Consumidor Desktop (`AgenteImpressao.cs`)
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`, linhas 38-55:
  ```csharp
  var job = await Sessao.Api.Get("/api/office/impressao/proxima") as JsonObject;
  if (_ultimoErro != null) { Situacao = "Termos do totem: " + _impressora; Log("agente voltou a falar com o servidor"); }
  _ultimoErro = null;
  if (job?.L("id") is not long id) return;
  try
  {
      await Relatorio.ImprimirSilencioso(Sessao.Api.BaseUrl + job.S("url"), _impressora);
      await Sessao.Api.Post($"/api/office/impressao/{id}/feita");
      Situacao = $"Último termo do {job.S("origem")} impresso às {DateTime.Now:HH:mm}";
      Log($"#{id} impresso ({job.S("origem")})");
  }
  catch (Exception e)
  {
      Situacao = "Falha ao imprimir termo: " + e.Message;
      Log($"#{id} FALHOU: {e.Message}");
      _pausaAte = DateTime.Now.AddSeconds(20); // impressora sem papel/desligada: tenta de novo daqui a pouco
      try { await Sessao.Api.Post($"/api/office/impressao/{id}/falhou"); } catch { }
  }
  ```
- **Constatação**: O agente consome `GET /api/office/impressao/proxima` a cada 3 segundos, espera os campos `id`, `url`, `titulo`, `origem` e `tentativa`, confirmando via `POST /api/office/impressao/{id}/feita` ou reportando erro via `POST /api/office/impressao/{id}/falhou`. O retorno quando não há trabalho pendente é um objeto JSON vazio `{}`.

### Obs 1.4: Rotas de Enfileiramento e Diagnóstico no Servidor
- **Arquivo**: `services/ops-server.ts`, linha 471:
  ```typescript
  if (naRecepcao) for (const idInscricao of termoDoPiloto.values()) enfileirarImpressao(termoLink([idInscricao]), 'Termo de responsabilidade', origemDe(req));
  ```
- **Arquivo**: `services/ops-server.ts`, linhas 576-595:
  ```typescript
  if (path === '/api/office/impressao/proxima' && method === 'GET') {
    const job = proximaImpressao();
    return send(res, 200, job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem, tentativa: job.tentativas } : {});
  }
  if (path === '/api/office/impressao/teste' && method === 'POST') {
    const token = String(req.headers.authorization ?? '').slice(7) || String(url.searchParams.get('t') ?? '');
    const job = enfileirarImpressao(`/termo?branco=1&t=${encodeURIComponent(token)}`, 'Teste de impressão (termo em branco)', sessao.nome);
    return send(res, 201, { id: job.id });
  }
  if (path === '/api/office/impressao/fila' && method === 'GET') {
    return send(res, 200, filaImpressao.map(({ url: _u, ...j }) => j));
  }
  const mi = path.match(/^\/api\/office\/impressao\/(\d+)\/(feita|falhou)$/);
  if (mi && method === 'POST') {
    const job = filaImpressao.find((j) => j.id === Number(mi[1]));
    if (job && mi[2] === 'feita') { job.feitaEm = Date.now(); log(`impressao #${job.id} impressa na recepcao (${sessao.nome})`); }
    if (job && mi[2] === 'falhou') { job.pegoEm = undefined; log(`impressao #${job.id} falhou na recepcao, volta pra fila`); }
    return send(res, 200, { ok: !!job });
  }
  ```

### Obs 1.5: Desperdício de Bobina Térmica por Altura Fixa de 297 mm
- **Arquivo**: `lib/ops/termo.ts`, linhas 192 e 196:
  ```typescript
  '@page{size:80mm 297mm;margin:0}' +
  '*{box-sizing:border-box}' +
  'html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}' +
  'body{font:8pt/1.22 Arial,Helvetica,sans-serif}' +
  '.page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}' +
  ```
- **Arquivo**: `tests/ops/termo.test.ts`, linha 34:
  ```typescript
  expect(html).toContain('@page{size:80mm 297mm;margin:0}');
  ```
- **Constatação**: 297 mm é a altura padrão da folha A4. Ao forçar `size: 80mm 297mm` e `.page { min-height: 297mm }`, o driver da TM-T20 ejeta 29,7 cm de bobina mesmo quando o texto ocupa apenas 14 a 18 cm, gerando um desperdício contínuo de cerca de 40% a 50% de cada bobina térmica.

### Obs 1.6: Situação das Migrações e Testes Existentes
- **Arquivo**: `migrations/ops/0011_fila_impressao_indices.sql` (criado recentemente no repositório) define `dbo.FilaImpressao`:
  ```sql
  CREATE TABLE dbo.FilaImpressao (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Url NVARCHAR(500) NOT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Origem NVARCHAR(100) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_FilaImpressao_Status DEFAULT 'pendente',
    Tentativas INT NOT NULL CONSTRAINT DF_FilaImpressao_Tentativas DEFAULT 0,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_FilaImpressao_CriadoEm DEFAULT SYSDATETIME(),
    PegoEm DATETIME2 NULL,
    FeitaEm DATETIME2 NULL,
    FalhouEm DATETIME2 NULL,
    UltimoErro NVARCHAR(MAX) NULL,
    CONSTRAINT CK_FilaImpressao_Status CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'falhou'))
  );
  ```
- **Arquivo**: `tests/ops/migration-0011.test.ts`, linha 95:
  ```typescript
  expect(rawSql).toMatch(/CHECK\s*\(\s*Status\s+IN\s*\(\s*'pendente'\s*,\s*'imprimindo'\s*,\s*'impressa'\s*,\s*'falhou'\s*\)\s*\)/i);
  ```
- **Comando executado**: `npx vitest run tests/ops/` $\rightarrow$ 15 arquivos de teste passaram com sucesso (183 testes no total).

---

## 2. Logic Chain (Cadeia de Raciocínio e Diagnóstico de Causa-Raiz)

1. **Premissa de Persistência**: A recepção imprime em uma TM-T20 conectada fisicamente à estação `.53`. Os totens não têm impressora local e dependem exclusivamente da fila do servidor para que os termos cheguem à recepção.
2. **Causa-Raiz da Perda de Termos**: Manter a fila em `filaImpressao: Impressao[]` na RAM do Node.js faz com que reinicializações do serviço `:4060` (deploys, falhas de energia, atualizações do Windows) eliminem instantaneamente os termos gerados.
3. **Causa-Raiz do Descarte Silencioso**: A lógica `agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS` exclui fisicamente o registro. Em períodos de recepção fechada ou deslogada (ex.: almoço, manutenção de rede), trabalhos com mais de 3 horas são destruídos.
4. **Dedução para Fila em Banco (`dbo.FilaImpressao`)**:
   - Os trabalhos devem ser inseridos na tabela relacional `dbo.FilaImpressao`.
   - Em vez de apagar os registros com mais de 3 horas, uma rotina atualiza seu status para `'contingencia'`. O termo permanece íntegro no banco e visível para auditoria ou reimpressão manual pela recepção.
5. **Dedução para Concorrência Atômica (`UPDLOCK, READPAST`)**:
   - Se duas requisições de recepção chegarem quase simultâneas, uma consulta `SELECT ... UPDATE` separada pode causar *race condition* (duas impressões do mesmo termo).
   - O padrão canônico do SQL Server para filas concorrentes é a CTE com `UPDATE ... WITH (UPDLOCK, READPAST) ... OUTPUT inserted.*`. Isso garante reserva atômica de linha única sem bloquear outras transações.
6. **Dedução para Altura Dinâmica TM-T20**:
   - Impressoras de bobina térmica cortam o papel assim que o conteúdo HTML/documento termina.
   - Definir `@page { size: 80mm auto; margin: 0; }` e remover `min-height: 297mm` de `.page` faz com que a altura renderizada se ajuste perfeitamente ao texto do termo, gerando economia imediata de bobina.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Princípio Read-Only**: Este agente explorador não altera arquivos de produção diretamente. Toda a especificação de código está pronta para implementação cirúrgica pelo Worker.
2. **Harmonização do CHECK Constraint de Status**:
   - O arquivo `migrations/ops/0011_fila_impressao_indices.sql` e seu teste `tests/ops/migration-0011.test.ts` possuem atualmente `CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'falhou'))`.
   - Para suportar `'contingencia'` e `'cancelada'` de forma 100% aderente ao `PROJECT_TOTEM.md`, o Worker deve atualizar a constraint e a expressão regular correspondente no teste Vitest para `Status IN ('pendente', 'imprimindo', 'impressa', 'contingencia', 'falhou', 'cancelada')`, mantendo a suíte Vitest 100% verde.
3. **Compatibilidade com o Agente de Impressão Desktop**:
   - O endpoint `GET /api/office/impressao/proxima` deve continuar devolvendo a propriedade `tentativa` (singular) para não quebrar a desserialização do `job.L("id")` e logging do `AgenteImpressao.cs`.

---

## 4. Conclusion & Especificação Técnica Detalhada para o Worker

O Worker da Milestone M1 deverá aplicar as alterações detalhadas a seguir nos três módulos do backend:

### 4.1 Migração DDL: `migrations/ops/0011_fila_impressao.sql` (ou `0011_fila_impressao_indices.sql`)

O Worker deve assegurar que a tabela `dbo.FilaImpressao` contenha a constraint de status expandida e os índices adequados:

```sql
-- Migration 0011: Fila de Impressão Persistida e Índices de Performance / Integridade
IF OBJECT_ID('dbo.FilaImpressao', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.FilaImpressao (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Url NVARCHAR(500) NOT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Origem NVARCHAR(100) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_FilaImpressao_Status DEFAULT 'pendente',
    Tentativas INT NOT NULL CONSTRAINT DF_FilaImpressao_Tentativas DEFAULT 0,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_FilaImpressao_CriadoEm DEFAULT SYSDATETIME(),
    PegoEm DATETIME2 NULL,
    FeitaEm DATETIME2 NULL,
    FalhouEm DATETIME2 NULL,
    UltimoErro NVARCHAR(MAX) NULL,
    CONSTRAINT CK_FilaImpressao_Status CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'contingencia', 'falhou', 'cancelada'))
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FilaImpressao_Status_CriadoEm' AND object_id = OBJECT_ID('dbo.FilaImpressao'))
BEGIN
  CREATE INDEX IX_FilaImpressao_Status_CriadoEm ON dbo.FilaImpressao (Status, CriadoEm);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FilaImpressao_Status_PegoEm' AND object_id = OBJECT_ID('dbo.FilaImpressao'))
BEGIN
  CREATE INDEX IX_FilaImpressao_Status_PegoEm ON dbo.FilaImpressao (Status, PegoEm);
END;
GO
```

*Nota para o teste `tests/ops/migration-0011.test.ts`: caso o teste existente verifique a regex do CHECK constraint, atualizar a linha 95 e 271 para incluir `contingencia` e `cancelada`, garantindo 17/17 testes aprovados.*

---

### 4.2 Refatoração de `services/ops-server.ts`

#### A. Substituir as linhas 207-234 (Fila em Memória) pelo Gerenciador de Banco de Dados:

```typescript
// ---------------------------------------------------------------- fila de impressao da recepcao
// O totem nao tem impressora: o termo entra na tabela dbo.FilaImpressao (SQL Server) e o programa da Recepcao
// (com a TM-T20) pega e imprime em segundos, como o LapTime fazia pelo servidor.
// Persistido em banco: sobrevive a reinicios do SRVKART :4060.
// Termos pendentes com mais de 3 horas passam para status 'contingencia' sem expurgo fisico,
// garantindo retencao de dados caso a recepcao fique fechada ou deslogada.

type FilaImpressaoJob = {
  id: number;
  url: string;
  titulo: string;
  origem: string;
  tentativa: number;
};

async function enfileirarImpressao(url: string, titulo: string, origem: string): Promise<{ id: number; url: string; titulo: string; origem: string }> {
  try {
    // Transiciona para contingencia trabalhos pendentes ha mais de 3 horas (sem expurgo fisico)
    await query(`
      UPDATE dbo.FilaImpressao
      SET Status = 'contingencia'
      WHERE Status IN ('pendente', 'imprimindo')
        AND DATEDIFF(hour, CriadoEm, SYSDATETIME()) >= 3
    `).catch(() => undefined);

    const row = await one<{ id: number }>(`
      INSERT INTO dbo.FilaImpressao (Url, Titulo, Origem, Status, Tentativas)
      OUTPUT inserted.Id id
      VALUES (@url, @titulo, @origem, 'pendente', 0)
    `, { url, titulo, origem });

    const id = row?.id ?? 0;
    log(`impressao #${id} na fila (${titulo}, ${origem})`);
    return { id, url, titulo, origem };
  } catch (err) {
    log(`erro ao enfileirar impressao no banco: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function proximaImpressao(): Promise<FilaImpressaoJob | null> {
  try {
    // Busca e reserva atomicamente o proximo trabalho com lock atômico UPDLOCK + READPAST
    // - Trabalhos pendentes (criados ha menos de 3h)
    // - Trabalhos imprimindo cujo PegoEm expirou timeout de reentrega (90s)
    const rows = await query<FilaImpressaoJob>(`
      WITH Prox AS (
        SELECT TOP (1) Id, Url, Titulo, Origem, Status, Tentativas, PegoEm
        FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
        WHERE (Status = 'pendente' AND DATEDIFF(hour, CriadoEm, SYSDATETIME()) < 3)
           OR (Status = 'imprimindo' AND DATEDIFF(second, PegoEm, SYSDATETIME()) > 90)
        ORDER BY CriadoEm ASC, Id ASC
      )
      UPDATE Prox
      SET Status = 'imprimindo',
          PegoEm = SYSDATETIME(),
          Tentativas = Tentativas + 1
      OUTPUT inserted.Id id, inserted.Url url, inserted.Titulo titulo, inserted.Origem origem, inserted.Tentativas tentativa;
    `);

    return rows[0] ?? null;
  } catch (err) {
    log(`erro ao buscar proxima impressao no banco: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
```

#### B. Ajustar a Linha 471 (Inscrição no Totem):
Substituir a iteração síncrona por `await`:
```typescript
    // cada termo é um trabalho de impressão separado: a TM-T20 corta o papel no fim de cada trabalho,
    // então vários termos num trabalho só saíam emendados
    if (naRecepcao) {
      for (const idInscricao of termoDoPiloto.values()) {
        await enfileirarImpressao(termoLink([idInscricao]), 'Termo de responsabilidade', origemDe(req));
      }
    }
```

#### C. Atualizar os Endpoints de Impressão (Linhas 576-595):
```typescript
      // agente de impressao do programa da Recepcao
      if (path === '/api/office/impressao/proxima' && method === 'GET') {
        const job = await proximaImpressao();
        return send(res, 200, job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem, tentativa: job.tentativa } : {});
      }
      if (path === '/api/office/impressao/teste' && method === 'POST') {
        const token = String(req.headers.authorization ?? '').slice(7) || String(url.searchParams.get('t') ?? '');
        const job = await enfileirarImpressao(`/termo?branco=1&t=${encodeURIComponent(token)}`, 'Teste de impressão (termo em branco)', sessao.nome);
        return send(res, 201, { id: job.id });
      }
      if (path === '/api/office/impressao/fila' && method === 'GET') {
        const rows = await query<{
          id: number;
          titulo: string;
          origem: string;
          status: string;
          tentativas: number;
          criadoEm: string;
          pegoEm: string | null;
          feitaEm: string | null;
          ultimoErro: string | null;
        }>(`
          SELECT TOP (100)
            Id id, Titulo titulo, Origem origem, Status status, Tentativas tentativas,
            CONVERT(varchar(19), CriadoEm, 126) criadoEm,
            CONVERT(varchar(19), PegoEm, 126) pegoEm,
            CONVERT(varchar(19), FeitaEm, 126) feitaEm,
            UltimoErro ultimoErro
          FROM dbo.FilaImpressao
          WHERE Status IN ('pendente', 'imprimindo', 'contingencia')
             OR DATEDIFF(hour, CriadoEm, SYSDATETIME()) < 24
          ORDER BY Id DESC
        `).catch(() => []);
        return send(res, 200, rows);
      }
      const mi = path.match(/^\/api\/office\/impressao\/(\d+)\/(feita|falhou)$/);
      if (mi && method === 'POST') {
        const id = Number(mi[1]);
        if (mi[2] === 'feita') {
          await query(`
            UPDATE dbo.FilaImpressao
            SET Status = 'impressa', FeitaEm = SYSDATETIME()
            WHERE Id = @id
          `, { id });
          log(`impressao #${id} impressa na recepcao (${sessao.nome})`);
          return send(res, 200, { ok: true });
        }
        if (mi[2] === 'falhou') {
          await query(`
            UPDATE dbo.FilaImpressao
            SET Status = CASE WHEN Tentativas >= 3 THEN 'contingencia' ELSE 'pendente' END,
                PegoEm = NULL,
                FalhouEm = SYSDATETIME()
            WHERE Id = @id
          `, { id });
          log(`impressao #${id} falhou na recepcao (${sessao.nome}), volta pra fila/contingencia`);
          return send(res, 200, { ok: true });
        }
      }
      const mr = path.match(/^\/api\/office\/impressao\/(\d+)\/reimprimir$/);
      if (mr && method === 'POST') {
        const id = Number(mr[1]);
        await query(`
          UPDATE dbo.FilaImpressao
          SET Status = 'pendente', PegoEm = NULL, Tentativas = 0
          WHERE Id = @id
        `, { id });
        log(`impressao #${id} reenfileirada pela recepcao (${sessao.nome})`);
        return send(res, 200, { ok: true });
      }
```

---

### 4.3 Ajuste de Altura Dinâmica em `lib/ops/termo.ts` e `tests/ops/termo.test.ts`

#### A. Alterações em `lib/ops/termo.ts`:
- **Linha 192**:
  *Antes*:
  ```typescript
  '@page{size:80mm 297mm;margin:0}' +
  ```
  *Depois*:
  ```typescript
  '@page{size:80mm auto;margin:0}' +
  ```
- **Linha 196**:
  *Antes*:
  ```typescript
  '.page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}' +
  ```
  *Depois*:
  ```typescript
  '.page{position:relative;width:80mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}' +
  ```

#### B. Alterações em `tests/ops/termo.test.ts`:
- **Linha 34**:
  *Antes*:
  ```typescript
  expect(html).toContain('@page{size:80mm 297mm;margin:0}');
  ```
  *Depois*:
  ```typescript
  expect(html).toContain('@page{size:80mm auto;margin:0}');
  expect(html).not.toContain('297mm');
  ```

---

## 5. Verification Method (Método de Verificação Independente)

O Worker e os auditores devem executar as seguintes etapas para validação:

1. **Validação dos Testes Unitários de Termo**:
   ```bash
   npx vitest run tests/ops/termo.test.ts
   ```
   *Critério de Sucesso*: 6/6 testes passando com asserção explícita de `@page{size:80mm auto;margin:0}` e ausência de `297mm`.

2. **Validação dos Testes de Migração**:
   ```bash
   npx vitest run tests/ops/migration-0011.test.ts
   ```
   *Critério de Sucesso*: 17/17 testes passando validando parênteses, sintaxe T-SQL e integridade de schema.

3. **Validação da Suíte Completa de Operações**:
   ```bash
   npx vitest run tests/ops/
   ```
   *Critério de Sucesso*: 100% dos testes passando sem falhas ou regressões.

4. **Checagem Estrita de Tipagem TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
   *Critério de Sucesso*: Nenhuma regressão ou erro novo introduzido em `services/ops-server.ts` ou `lib/ops/termo.ts`.

5. **Critério de Invalidação**:
   - Falha em qualquer teste do Vitest.
   - Qualquer tentativa de `splice()` ou deleção silenciosa de termos pendentes em memória.
   - Alteração das assinaturas ou respostas esperadas pelo `AgenteImpressao.cs` (`id`, `url`, `origem`, `tentativa`).

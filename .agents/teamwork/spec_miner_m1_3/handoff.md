# Relatório de Mineração de Especificação: Contratos de Impressão e Integração (Milestone M1)

**Agente**: Spec Miner M1 3 (`spec_miner_m1_3`)  
**Data**: 2026-10-26  
**Escopo**: Milestone M1 (Impressão e Gestão de Termos de Responsabilidade - Itens 1 a 6)  
**Alvos**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`, `desktop/src/Kartodromo.Comum/Api.cs`, `services/ops-server.ts`, `lib/ops/termo.ts`, `migrations/ops/0011_fila_impressao_indices.sql`.

---

## 1. Observation

### 1.1 Consumo pelo Cliente C# (`AgenteImpressao.cs` e `Api.cs`)
No arquivo `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 20-56):
```csharp
21: _impressora = Config.Get("ImpressoraTermos", "");
...
26: var t = new System.Windows.Forms.Timer { Interval = 3000 };
27: t.Tick += async (_, _) => await Rodada(dono);
...
38: var job = await Sessao.Api.Get("/api/office/impressao/proxima") as JsonObject;
39: if (_ultimoErro != null) { Situacao = "Termos do totem: " + _impressora; Log("agente voltou a falar com o servidor"); }
40: _ultimoErro = null;
41: if (job?.L("id") is not long id) return;
42: try
43: {
44:     await Relatorio.ImprimirSilencioso(Sessao.Api.BaseUrl + job.S("url"), _impressora);
45:     await Sessao.Api.Post($"/api/office/impressao/{id}/feita");
46:     Situacao = $"Último termo do {job.S("origem")} impresso às {DateTime.Now:HH:mm}";
47:     Log($"#{id} impresso ({job.S("origem")})");
48: }
49: catch (Exception e)
50: {
51:     Situacao = "Falha ao imprimir termo: " + e.Message;
52:     Log($"#{id} FALHOU: {e.Message}");
53:     _pausaAte = DateTime.Now.AddSeconds(20); // impressora sem papel/desligada: tenta de novo daqui a pouco
54:     try { await Sessao.Api.Post($"/api/office/impressao/{id}/falhou"); } catch { }
55: }
```

Em `desktop/src/Kartodromo.Comum/Api.cs` (linhas 110-148):
- Método `L(this JsonNode o, string k)`: Se o valor for nulo ou ausente, retorna `null`. Se for número ou string numérica, converte para `long`.
- Método `S(this JsonNode o, string k)`: Se o valor for ausente ou nulo, retorna string vazia `""`.
- Método `Enviar(HttpMethod metodo, string caminho, object corpo = null)` (linhas 61-91):
  - Envia header `Authorization: Bearer <Token>`.
  - Envia header `X-Client-Machine: <MachineName>`.
  - Envia `Content-Type: application/json`.
  - No `Post(caminho, corpo = null)`: se corpo for nulo, serializa `{}` vazio.
  - Se status HTTP não for sucesso (ex.: 401, 500), lança `ApiException(msg, status)`.
  - Em `AgenteImpressao.cs:64`: se `ApiException { Status: 401 }`, dispara modal de alerta: *"O login venceu e os termos do totem pararam de imprimir. Feche e abra a Recepção e entre de novo."*

### 1.2 Endpoints Atuais em `services/ops-server.ts`
Linhas 211-234 e 576-595:
- `filaImpressao: Impressao[] = []`: fila volátil em RAM (`type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number }`).
- `GET /api/office/impressao/proxima`:
  - Retorna `{ id: job.id, url: job.url, titulo: job.titulo, origem: job.origem, tentativa: job.tentativas }` se houver job.
  - Retorna `{}` se a fila estiver vazia.
- `POST /api/office/impressao/:id/feita`:
  - Retorna `{ ok: !!job }` com status 200.
- `POST /api/office/impressao/:id/falhou`:
  - Retorna `{ ok: !!job }` com status 200; limpa `job.pegoEm = undefined` para voltar para a fila.
- `GET /api/office/impressao/fila`:
  - Retorna array de jobs excluindo o campo `url` por segurança (`filaImpressao.map(({ url: _u, ...j }) => j)`).
- `POST /api/office/impressao/teste`:
  - Enfileira termo em branco `/termo?branco=1&t=...` e retorna `{ id: job.id }` com status 201.

### 1.3 Layout Térmico e Desperdício de Bobina em `lib/ops/termo.ts`
Linhas 192 e 196:
```css
@page{size:80mm 297mm;margin:0}
.page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}
```
- A altura fixa em 297 mm força a Epson TM-T20 a alimentar comprimento equivalente a folha A4 (~30 cm) mesmo quando o termo ocupa ~140 mm, gerando avanço ocioso de 150 mm antes do comando de corte térmico.
- Teste em `tests/ops/termo.test.ts:34`:
  `expect(html).toContain('@page{size:80mm 297mm;margin:0}');`

### 1.4 Esquema SQL Server em `migrations/ops/0011_fila_impressao_indices.sql`
Linhas 11-24:
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
- O CHECK constraint `CK_FilaImpressao_Status` restringe os status a `'pendente', 'imprimindo', 'impressa', 'falhou'`.
- O status `'contingencia'` citado em `PROJECT_TOTEM.md` (linhas 21 e 91) **não está** incluído neste CHECK constraint original.

### 1.5 Tratamento de Ausência de Impressora no Totem (`FormTotem.cs`)
Linhas 770-783 de `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
```csharp
770: // o termo sai na TM-T20 da recepção (fila do servidor); só imprime aqui se o servidor não enfileirou
771: if (r["termoNaRecepcao"]?.GetValue<bool>() == true) Program.Log("termo enviado para a impressora da recepção");
772: else if (r.S("termoUrl") is { Length: > 0 } termo) _ = Imprimir(_api.BaseUrl + termo);
...
779: async Task Imprimir(string url)
780: {
781:     try { await Relatorio.ImprimirSilencioso(url, Config.Impressora); Program.Log("termo impresso: " + url.Split('?')[0]); }
782:     catch (Exception e) { Program.Log("falha ao imprimir termo: " + e.Message); }
783: }
```
- Em `Relatorio.cs:293`: `if (!string.IsNullOrWhiteSpace(impressora)) cfg.PrinterName = impressora;`. Se `Config.Impressora` estiver vazio (`""`), o WebView2 envia cegamente para a impressora padrão do Windows no totem, criando trabalhos órfãos no spooler.

---

## 2. Logic Chain

1. **Desserialização C# no Agente de Impressão**:
   - `AgenteImpressao.cs` faz `job?.L("id") is not long id`. Se o servidor retornar `{}` (objeto vazio), `L("id")` retorna `null`, o `is not long id` é verdadeiro e a função retorna silenciosamente sem erro.
   - Se o servidor retornasse HTTP 204 (No Content) ou corpo nulo sem JSON válido, `Api.cs` geraria `dados = null` e `as JsonObject` seria `null`, porém `{}` é o contrato canônico estabelecido e validado.
   - A propriedade `tentativa` no JSON retornado por `/api/office/impressao/proxima` é no singular (`tentativa: job.tentativas`), embora no banco/objeto seja `tentativas`. Ambas podem coexistir no payload para compatibilidade máxima (`{ id, url, titulo, origem, tentativa, tentativas }`).
   - A propriedade `url` DEVE conter o caminho relativo iniciando com barra (ex.: `/termo?ids=...&s=...`), pois o app faz `Sessao.Api.BaseUrl + job.S("url")`. Como `BaseUrl` remove a barra final (`TrimEnd('/')`), a barra inicial em `url` é indispensável.
   - A propriedade `origem` DEVE ser uma string amigável (ex.: `"Totem 1"`, `"Totem 2"`, IP ou `"Recepção"`), pois é interpolada na string de status exibida ao operador (`Situacao = $"Último termo do {job.S("origem")} impresso às {DateTime.Now:HH:mm}"`).

2. **Atomicidade e Concorrência no Servidor Node.js**:
   - O pooling a cada 3 segundos a partir de múltiplas instâncias da Recepção exige consulta e atualização atômica com bloqueio de linha.
   - A CTE com hints `WITH (UPDLOCK, READPAST)`:
     ```sql
     WITH Proximo AS (
       SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
       WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
       ORDER BY CriadoEm ASC
     )
     UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
     OUTPUT inserted.Id id, inserted.Url url, inserted.Titulo titulo, inserted.Origem origem, inserted.Tentativas tentativa;
     ```
     garante FIFO estrito (`ORDER BY CriadoEm ASC`), reentrega automática após 90 segundos sem confirmação (`PegoEm < DATEADD(...)`), e impede corrida entre requisições simultâneas.

3. **Mapeamento de Falhas e Prevenção de Travamento de Fila (Head-of-Line Blocking)**:
   - Quando `POST /api/office/impressao/:id/falhou` é recebido, o servidor deve limpar `PegoEm = NULL` e registrar `FalhouEm = SYSDATETIME()`.
   - O `AgenteImpressao.cs` aplica backoff de 20 segundos (`_pausaAte = DateTime.Now.AddSeconds(20)`).
   - Porém, se um termo tiver erro de renderização contínuo ou o ID for corrompido, e o status voltar incondicionalmente para `pendente`, `ORDER BY CriadoEm ASC` reentregará eternamente o mesmo termo quebrado, bloqueando todos os termos posteriores.
   - **Regra de Segurança de Fila**: Se `Tentativas >= 5`, o item deve ser marcado com `Status = 'falhou'` (ou `contingencia`), liberando a fila para os próximos termos.

4. **Incompatibilidade de Schema no CHECK Constraint**:
   - A migração `0011_fila_impressao_indices.sql` define `CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'falhou'))`.
   - Inserir ou atualizar diretamente para `'contingencia'` causa erro de violação de constraint no SQL Server.
   - Para suportar `'contingencia'` em nível de banco, é mandatório um patch DDL `ALTER TABLE dbo.FilaImpressao DROP CONSTRAINT CK_FilaImpressao_Status; ALTER TABLE dbo.FilaImpressao ADD CONSTRAINT CK_FilaImpressao_Status CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'falhou', 'contingencia'));`, ou alternativamente utilizar `Status = 'falhou'` associado a flag/coluna de contingência.

5. **Corte Dinâmico Térmico Epson TM-T20**:
   - O driver da impressora térmica TM-T20 obedece a regras de bobina contínua.
   - Trocar `@page{size:80mm 297mm;margin:0}` por `@page{size:80mm auto;margin:0}` e `.page{min-height:297mm}` por `.page{height:auto;padding:0 5.7mm 8mm}` elimina o desperdício de ~150 mm por termo.
   - O corte ocorre via comando padrão do driver de spooler ao final do documento gerado pelo WebView2.
   - O teste unitário `tests/ops/termo.test.ts` linha 34 deve ser atualizado para validar a nova regra de corte dinâmico.

6. **Bloqueio de Impressão Cega no Totem**:
   - O Totem não possui impressora conectada (conforme documentado em `HANDOFF-SISTEMA-PROPRIO.md:293`).
   - `FormTotem.cs` deve verificar explicitamente `if (string.IsNullOrWhiteSpace(Config.Impressora)) return;` antes de chamar `Relatorio.ImprimirSilencioso`.
   - Na tela de sucesso, se `termoNaRecepcao == true`, exibir o aviso existente: *"Dirija-se até a recepção para concluir o atendimento e assinar seu termo de responsabilidade."*

---

## 3. Features Discovered

| # | Categoria | Funcionalidade | Descrição | Entradas | Saídas | Comportamento de Erro | Descoberto Via |
|---|-----------|----------------|-----------|----------|--------|----------------------|----------------|
| 1 | Impressão | `GET /api/office/impressao/proxima` | Consulta atômica do próximo trabalho na fila de impressão para a TM-T20 da Recepção | Header `Authorization: Bearer <token>` | 200 OK com `{ id, url, titulo, origem, tentativa }` ou `{}` se vazio | 401 se deslogado (alerta UI na .53); 500 se erro SQL | `AgenteImpressao.cs:38`, `ops-server.ts:576` |
| 2 | Impressão | `POST /api/office/impressao/:id/feita` | Notificação de impressão concluída com sucesso | `:id` na URL, Header `Authorization`, body `{}` | 200 OK com `{ ok: true }` | 404/200 `{ ok: false }` se ID inexistente | `AgenteImpressao.cs:45`, `ops-server.ts:589` |
| 3 | Impressão | `POST /api/office/impressao/:id/falhou` | Notificação de falha física de impressão (sem papel/desligada) | `:id` na URL, Header `Authorization`, body `{}` | 200 OK com `{ ok: true }` | 200 `{ ok: false }` se ID inexistente; pausa 20s no cliente | `AgenteImpressao.cs:54`, `ops-server.ts:589` |
| 4 | Diagnóstico | `GET /api/office/impressao/fila` | Listagem diagnóstica da fila ativa de impressão sem expor URLs assinadas | Header `Authorization` de sessão office | 200 OK com Array de `{ id, titulo, origem, status, criadoEm, pegoEm, feitaEm, tentativas }` | 401 se sem token; array vazio se fila limpa | `ops-server.ts:585`, `HANDOFF-SISTEMA-PROPRIO.md:283` |
| 5 | Diagnóstico | `POST /api/office/impressao/teste` | Enfileiramento de impressão de teste (termo em branco) | Header `Authorization` de sessão office | 201 Created com `{ id: number }` | 401 se sem token | `ops-server.ts:580` |
| 6 | Totem | `enfileirarImpressao` na Inscrição | Criação de job na fila para cada participante individual da bateria | Inscrição de grupo/piloto via `POST /api/totem/inscrever` | Geração de jobs em `dbo.FilaImpressao` com URL assinada `termoLink([id])` | Se `totem.termoNaRecepcao == false`, tenta imprimir local | `ops-server.ts:471` |
| 7 | Layout | Corte Dinâmico Térmico | Configuração de mídia CSS `@page` para bobina contínua 80mm sem altura fixa | Renderização HTML do termo em `lib/ops/termo.ts` | HTML com `@page{size:80mm auto;margin:0}` | Se fixo em 297mm, avança 150mm de papel em branco | `lib/ops/termo.ts:192` |
| 8 | Totem | Bloqueio de Spooler Cego | Impede tentativa de impressão local sem impressora configurada | Verificação em `FormTotem.cs` de `Config.Impressora` | Log de ausência de impressora e supressão de `ImprimirSilencioso` | Sem verificação, trava spooler do Windows em impressora fantasma | `FormTotem.cs:772`, `Relatorio.cs:293` |
| 9 | Infraestrutura | Limpeza de Spooler Órfão | Rotina PowerShell para limpar filas de spooler legadas nos totens | Execução de script `limpar-spooler-totem.ps1` | Limpeza de `C:\Windows\System32\spool\PRINTERS` e reinício do serviço | Se spooler travado, encerra processos associados | `PROJECT_TOTEM.md:20` |
| 10 | Resiliência | Reentrega Automática (90s) | Recuperação de jobs pegos pela recepção que não foram confirmados | Consulta periódica com `PegoEm < DATEADD(second, -90, SYSDATETIME())` | Reatribuição do job para novo ciclo de impressão | Evita perda de termos se o app da Recepção for fechado durante impressão | `ops-server.ts:228`, `migration-0011.test.ts:145` |

---

## 4. Edge Cases

| # | Funcionalidade | Entrada / Condição | Comportamento Observado / Requerido |
|---|----------------|-------------------|-------------------------------------|
| 1 | `GET /api/office/impressao/proxima` | Fila vazia (sem jobs pendentes) | Servidor responde 200 OK com `{}`. Cliente faz `job?.L("id")`, obtém `null` e sai da rodada sem exceção. |
| 2 | `GET /api/office/impressao/proxima` | Token de login da Recepção expirado (HTTP 401) | Servidor retorna 401. Cliente captura `ApiException { Status: 401 }` e exibe diálogo modal avisando o operador que os termos pararam. |
| 3 | `GET /api/office/impressao/proxima` | Servidor Node.js :4060 fora do ar / rede indisponível | Cliente captura `ApiException` (status 0), define `Situacao = "Termos do totem PARADOS: ..."` e tenta novamente em 3 segundos. |
| 4 | `GET /api/office/impressao/proxima` | Múltiplas recepções consultando ao mesmo milissegundo | Bloqueio atômico `WITH (UPDLOCK, READPAST)` no SQL Server garante que cada job é pego por apenas um cliente, sem impressões duplicadas. |
| 5 | Falha de Impressão na Recepção | Impressora TM-T20 sem papel ou cabo USB desconectado | `Relatorio.ImprimirSilencioso` lança exceção. Cliente chama `POST /api/office/impressao/:id/falhou` e aplica pausa de 20s. Servidor limpa `PegoEm = NULL`. |
| 6 | Falhas Consecutivas no Mesmo Termo | Termo com URL inválida ou corrompida falha 5+ vezes seguidas | Se retornar cegamente a `pendente`, causa Head-of-Line blocking. Deve transicionar para `falhou`/`contingencia` após limite de tentativas. |
| 7 | Queda do App da Recepção Durante Impressão | App da Recepção é fechado após pegar o job e antes de chamar `:id/feita` | Após 90 segundos (`IMPRESSAO_REENTREGA_MS`), a query atômica identifica `PegoEm < DATEADD(second, -90, SYSDATETIME())` e reentrega o termo. |
| 8 | Impressão no Totem sem Impressora | Reserva no totem quando `totem.termoNaRecepcao = false` e `Config.Impressora = ""` | Totem bloqueia chamada a `ImprimirSilencioso`; não cria jobs fantasmas no spooler do Windows; orienta usuário a procurar a Recepção. |
| 9 | Múltiplos Pilotos no Grupo | Reserva de 5 pilotos na mesma bateria | Servidor cria 5 trabalhos de impressão distintos em `dbo.FilaImpressao`, garantindo que a TM-T20 corte o papel entre cada termo. |
| 10 | Reinício do Servidor Node.js :4060 | Reinício do processo com termos pendentes na fila | Com a persistência em `dbo.FilaImpressao`, nenhum termo é perdido. A fila é restaurada imediatamente após a reconexão com o SQL Server. |

---

## 5. Caveats

1. **Restrição CHECK em `dbo.FilaImpressao`**: Conforme observado na Seção 1.4, a tabela criada pela migração 0011 restringe `Status IN ('pendente', 'imprimindo', 'impressa', 'falhou')`. A implementação do status `'contingencia'` requer extensão explícita do CHECK constraint via alteração DDL ou uso de status `'falhou'` com anotação em `UltimoErro`.
2. **Ambiente Host de Desenvolvimento (macOS)**: O comando `dotnet` não está disponível no PATH do macOS host atual (`command not found: dotnet`). A verificação e compilação do `Kartodromo.Desktop.sln` (.NET 8 WinForms) dependem de validação estática de código ou execução em ambiente Windows/CI.
3. **Erros de Tipagem Pré-Existentes**: `npx tsc --noEmit` falha atualmente devido a 4 erros externos à Milestone M1 (`lib/ops/endurance.ts` e `tests/timing-33-fixes.test.ts`). O arquivo `services/ops-server.ts` e as bibliotecas de termos não apresentam erros de tipagem.

---

## 6. Conclusion

1. **Compatibilidade JSON do `AgenteImpressao.cs`**:
   O contrato consumido pelo aplicativo C# da Recepção (.53) é estrito e requer:
   - `GET /api/office/impressao/proxima`: Resposta 200 OK com payload `{ id: number, url: string, titulo: string, origem: string, tentativa: number }` quando houver termo, ou `{}` quando vazio. O campo `url` deve conter barra inicial relativa e assinatura válida HMAC (`termoLink`).
   - `POST /api/office/impressao/:id/feita`: Resposta 200 OK com `{ ok: true }`.
   - `POST /api/office/impressao/:id/falhou`: Resposta 200 OK com `{ ok: true }`.
   - `GET /api/office/impressao/fila`: Array diagnóstico sem o campo sensível `url`.
2. **Desacoplamento e Persistência**:
   A migração da fila em memória para `dbo.FilaImpressao` resolve em definitivo a perda de termos em reinícios do `:4060` e atende o requisito R1 (Item 1 e Item 6), devendo utilizar CTE atômica com `UPDLOCK, READPAST`.
3. **Corte Térmico TM-T20**:
   A substituição de `@page{size:80mm 297mm;margin:0}` por altura dinâmica (`@page{size:80mm auto;margin:0}`) em `lib/ops/termo.ts` elimina o desperdício de ~150 mm de papel por impressão (Item 4).

---

## 7. Verification Method

Para verificar independentemente todos os apontamentos deste relatório:

1. **Validação das queries e índices de `dbo.FilaImpressao`**:
   ```bash
   npx vitest run tests/ops/migration-0011.test.ts
   ```
2. **Validação do layout e campos do termo**:
   ```bash
   npx vitest run tests/ops/termo.test.ts
   ```
3. **Verificação do código de desserialização C#**:
   Inspecionar `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 38 a 55) e `desktop/src/Kartodromo.Comum/Api.cs` (linhas 112 a 132).
4. **Verificação de conformidade com as Regras do Dono (`AGENTS.md`)**:
   - Nenhuma alteração no telão (`FormTV` / `--tv`).
   - Todos os textos e mensagens em **pt-BR**.
   - Preservação da integridade de produção (sem teste sem dados "TESTE CODEX").

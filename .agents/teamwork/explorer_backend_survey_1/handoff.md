# Relatório de Investigação Backend e Banco Operacional (Survey R1 a R6)

## 1. Observation (Observações Diretas)

Foram inspecionados os arquivos de código-fonte, rotas HTTP, definições SQL e testes automatizados do ecossistema backend e operacional (`services/ops-server.ts`, `lib/ops/*`, `migrations/ops/*`, `services/timing-server.ts`, e os clientes desktop em `desktop/src/Kartodromo.Recepcao/` e `desktop/src/Kartodromo.Autoatendimento/`).

### R1. Fila de Impressão e Gestão de Termos de Responsabilidade
1. **Fila volátil em memória (`services/ops-server.ts:211-233`)**:
   ```typescript
   type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number };
   const filaImpressao: Impressao[] = [];
   let seqImpressao = 0;
   const IMPRESSAO_VALIDADE_MS = 3 * 60 * 60 * 1000;
   const IMPRESSAO_REENTREGA_MS = 90 * 1000;

   function enfileirarImpressao(url: string, titulo: string, origem: string) {
     const agora = Date.now();
     for (let i = filaImpressao.length - 1; i >= 0; i--) if (agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS) filaImpressao.splice(i, 1);
     const job: Impressao = { id: ++seqImpressao, url, titulo, origem, criadoEm: agora, tentativas: 0 };
     filaImpressao.push(job);
     log(`impressao #${job.id} na fila (${titulo}, ${origem})`);
     return job;
   }
   ```
2. **Rotas da fila de impressão (`services/ops-server.ts:576-595`)**:
   - `GET /api/office/impressao/proxima`: consome o próximo item em memória.
   - `POST /api/office/impressao/:id/feita`: apenas marca `job.feitaEm = Date.now()`, mantendo o item em memória até ser removido pelo `splice`.
   - `POST /api/office/impressao/:id/falhou`: zera `job.pegoEm = undefined`.
   - `GET /api/office/impressao/fila`: devolve itens da memória, sem histórico persistido.
3. **Consumo no Desktop da Recepção (`desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs:26-55`)**:
   - O timer consulta `/api/office/impressao/proxima` a cada 3 segundos com `Sessao.Api.Get()`.
   - Se o operador estiver deslogado ou se a sessão expirar (`ApiException { Status: 401 }`, linha 64), o loop para e os termos não são impressos.
   - Após 3 horas sem operador logado, os termos são purgados silenciosamente de `filaImpressao`.
4. **Desperdício de bobina térmica na TM-T20 (`lib/ops/termo.ts:192-196`)**:
   ```css
   @page{size:80mm 297mm;margin:0}
   *{box-sizing:border-box}
   html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}
   body{font:8pt/1.22 Arial,Helvetica,sans-serif}
   .page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}
   ```
   A altura fixa de `297mm` (comprimento padrão de folha A4) obriga o Spooler e a impressora térmica de bobina TM-T20X a desenrolar cerca de 30 cm de papel, mesmo que o texto do termo ocupe menos da metade disso. Em contraste, `lib/ops/relatorios.ts:17,20` utiliza com sucesso `size = opts.cupom ? '80mm auto' : ...`.

---

### R2. Caixa, PDV e Operação Financeira
1. **Abertura de caixa sem isolamento atômico (`lib/ops/office.ts:1672-1686`)**:
   ```typescript
   if (path === '/caixa/abrir' && method === 'POST') {
     const b = await req.body();
     if (await movimentoAberto(sessao.uid)) throw new HttpError(409, 'Você já tem um terminal aberto.');
     if (!b.turnoId) throw new HttpError(400, 'Selecione o turno que será aberto o terminal.');
     if (!b.terminalId) throw new HttpError(400, 'Selecione um terminal para abrir.');
     const terminalId = int(b.terminalId, 'Terminal');
     const ocupado = await one(`SELECT 1 x FROM dbo.Movimento WHERE TerminalId = @terminalId AND FechadoEm IS NULL`, { terminalId });
     if (ocupado) throw new HttpError(409, 'Esse terminal já está aberto por outro usuário.');
     const inicial = cents(b.inicialCentavos ?? 0, 'Suprimento inicial');
     const r = await one<{ id: number }>(
       `INSERT INTO dbo.Movimento (UsuarioId, TerminalId, TurnoId, InicialCentavos) OUTPUT inserted.Id id VALUES (@uid, @terminalId, @turnoId, @inicial)`,
       { uid: sessao.uid, terminalId, turnoId: int(b.turnoId, 'Turno'), inicial },
     );
     send(201, { id: r!.id, mensagem: 'Terminal aberto com sucesso.' });
     return true;
   }
   ```
   Não há transação nem bloqueio (`UPDLOCK`) entre o `SELECT 1` e o `INSERT`. Na tabela `dbo.Movimento` (`migrations/ops/0002_office.sql:153-163`), não há índice UNIQUE filtrado em `(TerminalId) WHERE FechadoEm IS NULL`.
2. **Sangria e Fechamento com verificação de saldo não bloqueante (`lib/ops/office.ts:1693-1695`, `1708-1714`)**:
   - `sumarioMovimento` (linhas 368-407) faz leituras sem locks.
   - Em `/caixa/transacao` (sangria), valida se `valor > s.dinheiroEmCaixa` fora de transação. Duas sangrias concorrentes passam na validação e debitam mais dinheiro do que o caixa possui.
3. **Condição de corrida na criação de venda (`lib/ops/office.ts:478-487`)**:
   - `const mov = await movimentoAberto(sessao.uid);` é lido fora de `tx(async (run) => ...)`. Se o caixa for fechado nesse milissegundo, a venda é associada a um movimento fechado.
4. **Vulnerabilidade de concorrência e inconsistência de vouchers no estorno (`lib/ops/office.ts:635-655`)**:
   - `SELECT ... FROM dbo.VendaItem WHERE Id = @itemId` não possui `UPDLOCK`. Duas chamadas simultâneas podem estornar o mesmo item e subtrair o valor em duplicidade de `FinalCentavos`.
   - Na linha 650:
     `UPDATE dbo.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND EXISTS (SELECT 1 FROM dbo.VendaItem vi WHERE vi.VendaId = @vendaId AND vi.VoucherId IS NOT NULL AND vi.Estornado = 1)`
     Se a venda tiver múltiplos itens e apenas um for estornado, o uso de vouchers de outros itens da mesma venda é estornado indevidamente.

---

### R3. Baterias, Reservas e Pista
1. **Tolerância indevida de -30 minutos em novas reservas (`lib/ops/office.ts:426-432`)**:
   ```typescript
   const [b] = await run(
     `SELECT b.Id, b.Status, b.Vagas, b.Inicio, b.ProdutoId, p.PrecoCentavos preco,
       (SELECT COUNT(*) FROM dbo.Inscricao i WITH (UPDLOCK, HOLDLOCK) WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas,
       CASE WHEN b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 1 ELSE 0 END passada
      FROM dbo.Bateria b WITH (UPDLOCK, HOLDLOCK) LEFT JOIN dbo.Produto p ON p.Id = b.ProdutoId WHERE b.Id = @bateriaId`,
     { bateriaId },
   );
   ...
   if (b.passada) throw new HttpError(409, 'Não é permitido reservar para baterias que já ocorreram!');
   ```
   Baterias iniciadas há até 29 minutos continuam aceitando novas inscrições.
2. **Baterias expiradas listadas no Totem (`lib/ops/totem-baterias.ts:15-40`)**:
   - `TOTEM_BATERIAS_SQL` filtra apenas `b.Inicio >= CAST(SYSDATETIME() AS date)`.
   - `bateriaDisponivelNoTotem` não compara a hora inicial com o horário atual, apenas verifica se é da data de hoje (`String(row.inicio).slice(0, 10) === dataHoje`).
   - O teste existente em `tests/ops/totem-baterias.test.ts:5-13` assinala explicitamente que `mantém visível uma bateria aberta de hoje mesmo depois do horário inicial`, em desacordo com os novos requisitos do projeto.
3. **Interpolação de parâmetros SQL dinâmicos em `services/ops-server.ts:398-406`**:
   ```typescript
   const lista = grupo.join(',');
   for (const g of await query<{ b: number; n: number }>(
     `SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
       WHERE i.BateriaId IN (${rows.map((r) => Number(r.id)).join(',')}) AND i.Status <> 'cancelada'
         AND (i.ClienteId IN (${lista})
              OR (i.Origem = 'site' AND i.Pago = 1 AND i.ClienteId IN (SELECT ResponsavelId FROM dbo.Cliente WHERE Id IN (${lista}) AND ResponsavelId IS NOT NULL)))
       GROUP BY i.BateriaId`,
   )) doGrupo.set(g.b, g.n);
   ```
   Construção de SQL via concatenação direta de `${lista}` e `${rows}` sem parametrização `@p0, @p1...`.

---

### R4. Clientes, Documentos e Validações Cadastrais
1. **Exposição pública de PII em tela de identificação pública (`services/ops-server.ts:310-333`)**:
   - No endpoint público `POST /api/totem/identificar`, o payload de resposta devolve:
     `documento: txt(c.documento)`, `email: txt(c.email)`, `telefone: txt(c.telefone)`, `endereco: enderecoCompleto`, `numero: num`, `complemento: comp`, `bairro: txt(c.bairro)`, `nascimento: txt(c.nascimento)`, além do array completo de dependentes menores de idade:
     `dependentes: [{ id, nome, nascimento }]`.
   - Qualquer pessoa digitando um CPF qualquer no totem do saguão obtém os dados cadastrais completos e a lista de filhos daquele piloto.
2. **Sobrescrita destrutiva de `Numero` e `Complemento` com `NULL` (`services/ops-server.ts:358-370`)**:
   ```typescript
   let limparNumero = false;
   if (dados.endereco !== undefined) {
     const atual = await one<{ endereco: string | null; numero: string | null; complemento: string | null }>(
       `SELECT Endereco endereco, Numero numero, Complemento complemento FROM dbo.Cliente WHERE Id = @id`,
       { id },
     );
     const digitado = String(dados.endereco ?? '').trim();
     if (!digitado || (atual && digitado === enderecoDoTotem(atual.endereco, atual.numero, atual.complemento))) delete dados.endereco;
     else limparNumero = Boolean(atual?.numero || atual?.complemento);
   }
   await updateCliente(id, { ...dados, lgpd: true }, true);
   if (limparNumero) await query(`UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`, { id });
   ```
   A atualização de endereço no totem explicitamente zera `Numero` e `Complemento` no banco.
3. **Divergência de validação de peso**:
   - `lib/ops/cadastro-obrigatorio.ts:8`: aceita `0 < valor < 500`.
   - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs:526`: exige `20 <= kg <= 250` (adultos) e `10 <= kg <= 250` (linha 689, menores).
4. **Instagram obrigatório bloqueando participantes (`lib/ops/instagram.ts:11`)**:
   - `if (!String(value ?? '').trim()) return 'O Instagram é obrigatório. Informe o @usuário do piloto.';`
   - Clientes sem Instagram são impedidos de salvar cadastro e correr.
5. **Falta de checagem de unicidade em `PUT /clientes/:id` (`lib/ops/office.ts:1632-1638`)**:
   - A edição na Recepção não verifica se o novo documento já pertence a outro cliente cadastrado.

---

### R5. Integração com Cronometragem e Rede
1. **Autenticação opcional se chave não configurada (`services/ops-server.ts:133-138`)**:
   - `requireKey(req)`: se `!KEY`, retorna sem verificar, deixando as rotas `/api/crono/*` desprotegidas.
2. **Gargalo severo e Full Table Scan em `/api/crono/uso-karts` (`services/ops-server.ts:624-626`)**:
   ```typescript
   const linhas = await query<{ id: number; categoria: string | null; item: number | null; minutos: number; ultima: string | null }>(
     `SELECT Id id, Categoria categoria, ItemId item, MinutosUso minutos, CONVERT(varchar(19), UltimaManutencao, 126) ultima
      FROM dbo.Manutencao WHERE TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n`, { n: numero });
   ```
   A expressão escalar `TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n` inviabiliza o uso de índices na coluna `Kart`, forçando uma varredura completa da tabela `dbo.Manutencao` para cada kart da bateria de forma síncrona/sequencial.
3. **Sincronização bloqueante de traçados (`services/ops-server.ts:601,682`)**:
   - Ao requisitar `/api/crono/baterias` ou `/api/baterias`, o servidor dispara `await sincronizarTracadosDaCronometragem()`, fazendo requisição HTTP de volta para o ORBITS na porta 4050 com timeout. Se o ORBITS estiver reiniciando, a rota de consulta da cronometragem sofre latência ou timeout.

---

### R6. Estabilidade do Servidor
1. **Ausência de tratamento global de exceções assíncronas no Node.js**:
   - Não há `process.on('uncaughtException')` nem `process.on('unhandledRejection')` em `services/ops-server.ts`. Rejeições de Promises disparadas pelos intervalos em segundo plano (`sincronizarPreCadastros`, `publicarAgenda`, `sincronizarReservasOnline`, linhas 721-755) causam encerramento imediato do processo Node.js (`ERR_UNHANDLED_REJECTION`).
2. **Race condition no pool de conexões mssql (`lib/ops/db.ts:15-28`)**:
   - `if (pool?.connected) return pool;` permite que múltiplas requisições simultâneas na inicialização instanciem e sobrescrevam múltiplos pools de conexões ao mesmo tempo.
   - O pool não possui listener para o evento `'error'` (`pool.on('error', ...)`). Quedas temporárias de rede com o SQL Server disparam erro não capturado no EventEmitter do pool.
3. **Rota `/healthz` básica (`services/ops-server.ts:519-522`)**:
   - Executa `SELECT CONVERT(varchar(19), SYSDATETIME(), 126) agora`. Em caso de erro do banco, estoura erro 500 sem métricas de integridade de conexões ativas/ociosas.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **R1**: A fila de impressão reside exclusivamente em `filaImpressao: Impressao[]` na memória RAM do Node.js. Qualquer reinicialização do processo apaga todos os termos enfileirados que ainda não foram buscados pelo app da Recepção. Como o app da Recepção só busca termos se houver operador autenticado, se a Recepção estiver fechada durante o autoatendimento, a rotina `enfileirarImpressao` descarta silenciosamente os termos após 3 horas via `splice`. A persistência na tabela relacional `dbo.FilaImpressao` com status transacionais (`pendente`, `imprimindo`, `impressa`, `falhou`) garante que o desligamento do servidor não acarrete perda de termos. Em paralelo, a regra CSS `@page{size:80mm 297mm}` obriga o driver da TM-T20X a alimentar papel até 297mm; ajustar para `@page{size:80mm auto}` com altura livre na `.page` encerra o corte no final exato do conteúdo.
2. **R2**: A abertura de terminais em `/caixa/abrir` não possui restrição de chave única no banco de dados (`TerminalId` onde `FechadoEm IS NULL`) nem transação com `UPDLOCK`. Duas instâncias simultâneas inserem múltiplos movimentos abertos para o mesmo terminal. Do mesmo modo, o estorno de itens em `vendas/:id/estorno` lê os itens sem lock exclusivo; execuções concorrentes atualizam `EstornoCentavos` e cancelam indevidamente todos os vouchers da venda. A aplicação de locks `WITH (UPDLOCK, HOLDLOCK)`, transações e validações de concorrência é mandatória para manter a integridade fiscal/financeira.
3. **R3**: A tolerância de `-30` minutos em `inscreverN` (`b.Inicio < DATEADD(minute, -30, SYSDATETIME())`) permite a venda de vagas de baterias que já entraram na pista. Somado a isso, `TOTEM_BATERIAS_SQL` consulta baterias do dia inteiro (`Inicio >= CAST(SYSDATETIME() AS date)`), exibindo baterias da manhã durante a tarde. Bloquear baterias com início inferior ao horário atual garante que apenas corridas futuras ou com tolerância zero para novos clientes sejam disponibilizadas. As consultas dinâmicas sem parâmetros (`${lista}`) violam as boas práticas de segurança e degradam o cache de planos do SQL Server.
4. **R4**: No autoatendimento público, qualquer usuário pode consultar um documento qualquer em `/api/totem/identificar`. Devolver dados pessoais em texto claro viola a LGPD e a privacidade dos pilotos. Além disso, a limpeza programada de `Numero` e `Complemento` como `NULL` na atualização do cadastro pelo totem corrompe dados históricos gravados previamente pela Recepção. Permitir que o Instagram seja opcional atende a demanda de famílias e turistas sem restringir a operação.
5. **R5**: O cálculo de horas de uso dos karts (`/api/crono/uso-karts`) roda `TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n` em loop para dezenas de karts. Isso acarreta 30 full table scans na tabela `dbo.Manutencao`. Reescrever essa rotina em lote com índice otimizado reduz o tempo de resposta de segundos para milissegundos, evitando timeouts na Cronometragem.
6. **R6**: No ambiente de produção do SRVKART, o servidor roda como tarefa agendada SYSTEM. Sem capturadores de `unhandledRejection` e listener de erro no `ConnectionPool`, qualquer falha transitória de rede ou Promise assíncrona causa a queda imediata do serviço, interrompendo o atendimento de recepção e totens.

---

## 3. Caveats (Ressalvas)

- A base de dados de produção `KartodromoOps` possui mais de 137.000 clientes legados; qualquer alteração de índices em `dbo.Cliente` ou migração com `ALTER TABLE` deve ser testada quanto ao impacto de travamento de tabela (locks) durante horários sem funcionamento.
- A solução C# (`desktop/Kartodromo.Desktop.sln`) depende de build em ambiente Windows (.NET 8 WinForms); no ambiente local de desenvolvimento macOS, `dotnet` não está no PATH, sendo a compilação final executada no host ORBITS ou via pipeline CI.
- Os testes automatizados em `tests/ops/totem-baterias.test.ts` e `tests/ops/termo.test.ts` foram escritos validando o comportamento antigo (termo de 297mm e exibição de baterias iniciadas). Ao implementar os novos requisitos, esses testes precisarão de atualização harmonizada.

---

## 4. Conclusion (Conclusão e Recomendações Técnicas)

O backend em `services/ops-server.ts` e `lib/ops/` é funcionalmente rico, mas apresenta fragilidades pontuais de concorrência, persistência e exposição de dados que devem ser corrigidas na fase de implementação:

1. **Migration 0011**:
   - Criar `dbo.FilaImpressao` com colunas `Id`, `Url`, `Titulo`, `Origem`, `Status`, `Tentativas`, `CriadoEm`, `PegoEm`, `FeitaEm`, `FalhouEm`, `UltimoErro`.
   - Criar índice filtrado único `UX_Movimento_TerminalAberto` em `dbo.Movimento (TerminalId) WHERE FechadoEm IS NULL`.
   - Criar índice `IX_Manutencao_Kart` ou coluna persistida indexada para evitar scans em `/api/crono/uso-karts`.
2. **Refatoração de Fila de Impressão (`ops-server.ts`)**:
   - Substituir `filaImpressao[]` em memória por operações transacionais em `dbo.FilaImpressao` usando CTE com `UPDATE TOP (1) WITH (UPDLOCK, READPAST)`.
3. **Ajuste de Bobina Térmica (`lib/ops/termo.ts`)**:
   - Substituir `@page{size:80mm 297mm;margin:0}` e `.page{min-height:297mm}` por `@page{size:80mm auto;margin:0}` e `.page{width:80mm;min-height:auto;padding:0 5.7mm 4mm;margin:0 auto;break-after:page}`.
4. **Segurança e Privacidade PII (`ops-server.ts:310`)**:
   - Implementar mascaramento de CPF, e-mail, telefone e endereço na rota pública `/api/totem/identificar`.
   - Não expor dados completos de dependentes menores sem validação prévia.
   - Eliminar `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` em `ops-server.ts:369`.
5. **Regras de Negócio e Concorrência**:
   - Remover tolerância de `-30` min em `lib/ops/office.ts:426` e bloquear baterias iniciadas em `lib/ops/totem-baterias.ts`.
   - Parametrizar a query em `services/ops-server.ts:401`.
   - Tornar Instagram opcional em `lib/ops/instagram.ts` e harmonizar validação de peso para `10 <= peso <= 250` em `lib/ops/cadastro-obrigatorio.ts`.
   - Proteger `criarVenda`, `/caixa/abrir` e `estornar` com transações e locks adequados.
6. **Estabilidade e Resiliência**:
   - Adicionar listener de erro no pool `mssql` e controle de Promise única em `lib/ops/db.ts`.
   - Registrar `process.on('uncaughtException')` e `process.on('unhandledRejection')` em `services/ops-server.ts`.
   - Enriquecer `/healthz` com métricas do pool e uptime.

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e verificar as conclusões e trechos apontados:

1. **Inspeção de código e linhas citadas**:
   - `view_file` em `services/ops-server.ts` nas linhas 211-233 (fila), 310-333 (PII), 369 (limparNumero), 398-406 (SQL sem parâmetros), 519-522 (`/healthz`), 624-626 (uso-karts scan).
   - `view_file` em `lib/ops/termo.ts` nas linhas 192 e 196 (297mm fixos).
   - `view_file` em `lib/ops/office.ts` nas linhas 426 (-30 min), 478-485 (venda fora de tx), 635-655 (estorno), 1672-1685 (caixa abrir).
   - `view_file` em `lib/ops/db.ts` nas linhas 15-28 (pool mssql sem listener 'error').
2. **Suíte de Testes Vitest**:
   - Executar: `npx vitest run tests/ops/`
   - Resultado atual verificado: 14 arquivos de teste passando (166 testes com sucesso).
3. **Checagem de Tipos TypeScript**:
   - Executar: `npx tsc --noEmit`
   - Observar os 4 erros pré-existentes identificados em `lib/ops/endurance.ts:256` e `tests/timing-33-fixes.test.ts:102`.

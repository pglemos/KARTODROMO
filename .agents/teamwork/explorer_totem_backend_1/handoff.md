# Handoff Report — Explorer Backend & Banco de Dados (Totem Autoatendimento)

**Data**: 2026-10-26  
**Agente**: `explorer_totem_backend_1`  
**Destinatário**: Orquestrador (`cc947e12-4c7c-48ad-93cf-a3cced581f33`)  
**Escopo**: Auditoria e proposta técnica completa para as falhas, vulnerabilidades, persistência e gargalos de Backend (Node.js/TypeScript `services/ops-server.ts`, `lib/ops/`) e Banco de Dados (`KartodromoOps` / SQL Server) do Totem de Autoatendimento.

---

## 1. Observation (Observações Diretas do Código)

### Obs 1.1: Fila de Impressão Volátil em Memória RAM e Descarte em 3 Horas
- **Arquivo**: `services/ops-server.ts`, linhas 207-233:
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
- **Rotas de consumo**: `services/ops-server.ts`, linhas 576-595 (`/api/office/impressao/proxima`, `/api/office/impressao/teste`, `/api/office/impressao/fila`, `/api/office/impressao/:id/(feita|falhou)`).
- **Banco de dados**: Inspecionando `migrations/ops/`, **não existe** tabela `dbo.FilaImpressao`. Toda a fila reside estritamente no array `filaImpressao: Impressao[]` na RAM do processo Node.js. Qualquer reinício do serviço `:4060` zera a fila instantaneamente. Se a recepção estiver fechada ou deslogada por mais de 3 horas, os trabalhos sofrem `splice()` silencioso.

### Obs 1.2: Exposição Total de PII na Rota Pública `POST /api/totem/identificar`
- **Arquivo**: `services/ops-server.ts`, linhas 282-335:
  ```typescript
  send(res, 200, {
    cliente: {
      id: c.id,
      nome: c.nome,
      tipoDocumento: txt(c.tipoDocumento) || 'CPF',
      documento: txt(c.documento),
      email: txt(c.email),
      telefone: txt(c.telefone),
      nascimento: txt(c.nascimento),
      temNascimento: Boolean(c.nascimento),
      peso: c.peso == null ? '' : String(Number(c.peso)),
      cep: txt(c.cep),
      endereco: enderecoCompleto,
      numero: num,
      complemento: comp,
      bairro: txt(c.bairro),
      cidade: txt(c.cidade),
      estado: txt(c.estado),
      lgpd: Boolean(c.lgpdAceiteEm),
      bloqueado: Boolean(c.bloqueado),
    },
    dependentes: dependentes.map((d) => ({ ...d, token: sign(`cli:${d.id}`) })),
    token: sign(`cli:${c.id}`),
  });
  ```
- **Consulta pública**: Qualquer pessoa que digite um CPF ou e-mail no totem obtém instantaneamente documento completo, e-mail completo, telefone celular, endereço residencial detalhado e a lista de dependentes menores com nome e data de nascimento integral, violando as diretrizes da LGPD (Art. 14 para menores de idade e Art. 6º, III - necessidade/minimização).

### Obs 1.3: Amarração Frágil de Sessão e Totem por IP de Socket (`identificadoNoTotem`)
- **Arquivo**: `services/ops-server.ts`, linhas 240-250:
  ```typescript
  const identificadoNoTotem = new Map<string, { id: number; em: number }>();
  const ipDe = (req: http.IncomingMessage) => String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
  function donoNoTotem(req: http.IncomingMessage) {
    const x = identificadoNoTotem.get(ipDe(req));
    return x && Date.now() - x.em < 15 * 60_000 ? x.id : null;
  }

  function origemDe(req: http.IncomingMessage) {
    const ip = String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    return ip === '192.168.20.161' ? 'Totem 1' : ip === '192.168.20.69' ? 'Totem 2' : ip || 'totem';
  }
  ```
- **Consumo**:
  - Linha 299: `identificadoNoTotem.set(ipDe(req), { id: Number(c.id), em: Date.now() });`
  - Linha 384: `if (!responsavelId) identificadoNoTotem.set(ipDe(req), { id: newId, em: Date.now() });`
  - Linha 395: `const dono = donoNoTotem(req);`
  - Linha 452: `const paga = await vagaOnlineDoGrupo(bateriaId, cid, grupo, log, donoNoTotem(req));`
  - Linha 471: `origemDe(req)`
- **Vulnerabilidade**: Em redes com NAT, sub-redes dinâmicas DHCP ou execução em proxy/localhost, todos os totens colidem no mesmo socket IP (`127.0.0.1` ou IP do roteador). Além disso, os IPs `192.168.20.161` e `192.168.20.69` estão hardcoded em código.

### Obs 1.4: Destruição Sistemática de `Numero` e `Complemento` em `dbo.Cliente`
- **Arquivo**: `services/ops-server.ts`, linhas 358-369:
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
- **Efeito**: Sempre que um cliente existente altera qualquer caractere no campo unificado de endereço ou preenche endereço no totem, a linha 369 roda explicitamente `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`, apagando permanentemente as colunas estruturadas do banco.

### Obs 1.5: Desarmonia de Faixas de Peso e Validação Estrita de Instagram
- **Arquivo**: `lib/ops/cadastro-obrigatorio.ts`, linhas 3-9:
  ```typescript
  export function erroPesoCliente(peso: unknown): string | null {
    const texto = String(peso ?? '').trim();
    if (!texto) return 'O peso é obrigatório. Informe o peso em kg.';
    const valor = Number(texto.replace(',', '.'));
    return Number.isFinite(valor) && valor > 0 && valor < 500
      ? null : 'Peso inválido. Informe um valor maior que 0 e menor que 500 kg.';
  }
  ```
- **Arquivo**: `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`, linha 38 (`kg > 0 && kg < 500`).
- **Arquivo**: `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linha 526:
  - Adulto: `kg < 20 || kg > 250`
  - Menor (linha 689): `kg < 10 || kg > 250`
- **Arquivo**: `lib/ops/instagram.ts`, linhas 10-15:
  ```typescript
  export function erroInstagramCliente(value: unknown): string | null {
    if (!String(value ?? '').trim()) return 'O Instagram é obrigatório. Informe o @usuário do piloto.';
    ...
  }
  ```
- **Efeito**: O servidor aceita 1 kg e 499 kg (incompatíveis com a prática de kartismo), mas o totem rejeita adultos abaixo de 20 kg e acima de 250 kg. Além disso, `erroInstagramCliente` impede clientes que não possuem rede social de concluírem o cadastro no totem presencial.

### Obs 1.6: Consultas SQL Não Parametrizadas na Rota `/api/totem/baterias`
- **Arquivo**: `services/ops-server.ts`, linhas 398-406:
  ```typescript
  const doGrupo = new Map<number, number>();
  if (grupo.length && rows.length) {
    const lista = grupo.join(',');
    for (const g of await query<{ b: number; n: number }>(
      `SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
        WHERE i.BateriaId IN (${rows.map((r) => Number(r.id)).join(',')}) AND i.Status <> 'cancelada'
          AND (i.ClienteId IN (${lista})
               OR (i.Origem = 'site' AND i.Pago = 1 AND i.ClienteId IN (SELECT ResponsavelId FROM dbo.Cliente WHERE Id IN (${lista}) AND ResponsavelId IS NOT NULL)))
        GROUP BY i.BateriaId`,
    )) doGrupo.set(g.b, g.n);
  }
  ```
- **Efeito**: Há interpolação direta de listas de strings (`${rows.map(...)}` e `${lista}`) dentro da consulta SQL via template literal em vez de parâmetros nomeados/posicionais SQL Server (`@b0, @b1...`, `@c0, @c1...`).

### Obs 1.7: Baterias Iniciadas Permitidas e Tolerância Incorreta de -30 Minutos
- **Arquivo**: `lib/ops/totem-baterias.ts`, linhas 21-24:
  ```sql
  WHERE b.Status = 'aberta' AND b.AutoAtendimento = 1 AND b.ReservaFechada = 0
    AND b.Inicio >= CAST(SYSDATETIME() AS date)
    AND b.Inicio < DATEADD(day, 1, CAST(SYSDATETIME() AS date))
  ```
  - A consulta retorna baterias de hoje que já começaram há várias horas (ex.: 09:00 quando já são 15:00).
- **Arquivo**: `lib/ops/office.ts`, linha 426:
  ```sql
  CASE WHEN b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 1 ELSE 0 END passada
  ```
  - `inscreverN` tolera baterias que já iniciaram há até 30 minutos atrás. No totem de autoatendimento, nenhuma bateria já iniciada pode ser pré-reservada.

### Obs 1.8: Condição de Corrida (Race Condition) e Falta de Transação Atômica em Grupos
- **Arquivo**: `services/ops-server.ts`, linhas 438-463:
  ```typescript
  for (const bateriaId of baterias) {
    ...
    for (const cid of [...grupo].sort(...)) {
      ...
      const novas = await inscreverN(bateriaId, cid, 1, 'totem', null, null, false);
      ids.push(...novas);
    }
  }
  ```
- **Arquivo**: `lib/ops/office.ts`, linha 469:
  ```typescript
  return opcoes.run ? inscrever(opcoes.run) : tx(inscrever);
  ```
- **Efeito**: Cada participante do grupo é inscrito em uma transação SQL isolada (`tx`). Se uma bateria tiver 1 vaga restante e o totem submeter um grupo de 2 participantes, o primeiro participante é gravado e confirmado em `dbo.Inscricao`; o segundo participante recebe `HttpError(409, 'Não há vagas...')`. O grupo fica rachado pela metade com inscrição órfã e sem rollback do grupo.

### Obs 1.9: Falta de Pool e Cancelamento de Requisições Sobrepostas no ViaCep
- **Arquivo**: `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 478-488 e 560-569:
  ```csharp
  fCep.Caixa.TextChanged += async (_, _) => {
      var cep = Fmt.Digitos(fCep.Text);
      if (cep.Length != 8 || !_cfg.B("consultarCep")) return;
      var r = await ViaCep(cep);
      ...
  };
  static async Task<JsonObject> ViaCep(string cep) {
      using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
      ...
  }
  ```
- **Efeito**: Instanciação contínua de `new HttpClient()` gerando `TIME_WAIT` socket exhaustion; ausência de `CancellationTokenSource` e debounce, fazendo com que correções de digitação no CEP disparem requisições assíncronas concorrentes cujas respostas chegam fora de ordem.

---

## 2. Logic Chain (Cadeia de Raciocínio e Diagnóstico de Causa-Raiz)

### 2.1 Causa-Raiz da Perda de Termos de Responsabilidade
1. **Premissa**: Totens de autoatendimento não possuem impressoras térmicas locais conectadas fisicamente (conforme documentado em `HANDOFF-SISTEMA-PROPRIO.md:35`).
2. **Fato**: O servidor Node.js enfileira termos em `filaImpressao: Impressao[]` em memória (`ops-server.ts:221`).
3. **Fato**: O desktop da Recepção (.53) roda `AgenteImpressao.cs`, que faz polling via `GET /api/office/impressao/proxima`.
4. **Mecanismo de Falha**:
   - Qualquer reinício do serviço `:4060` (deploy, crash, reinício de máquina) destrói todo o array da memória.
   - Se a recepção estiver fechada, em horário de almoço ou deslogada (sessão expirada com HTTP 401), os termos permanecem na fila. Ao atingir 3 horas (`IMPRESSAO_VALIDADE_MS`), o loop de limpeza do servidor (`ops-server.ts:219`) executa `filaImpressao.splice(i, 1)`. Os termos são expurgados sem deixar rastro.
5. **Dedução**: É indispensável uma tabela relacional permanente `dbo.FilaImpressao` no SQL Server `KartodromoOps` com estados explícitos (`pendente`, `imprimindo`, `impressa`, `contingencia`). Termos pendentes devem sobreviver indefinidamente a reinícios do backend e ser marcados para contingência visível na recepção em vez de sofrer descarte silencioso.

### 2.2 Causa-Raiz do Vazamento de PII e Dados de Menores
1. **Premissa**: O totem opera em espaço aberto de circulação pública dentro do kartódromo.
2. **Fato**: O fluxo de `POST /api/totem/identificar` pesquisa por CPF/Documento ou E-mail e retorna imediatamente o objeto `cliente` completo com todos os campos em texto claro (`ops-server.ts:310-330`), além do array `dependentes` com nomes e datas de nascimento de crianças.
3. **Mecanismo de Falha**: Qualquer transeunte ou usuário mal-intencionado que digite um CPF aleatório ou de pessoa pública no teclado do totem tem acesso imediato ao endereço residencial, telefone celular, e-mail e filhos menores cadastrados.
4. **Dedução**: `POST /api/totem/identificar` deve retornar PII mascarado (ex.: CPF `***.***.789-**`, e-mail `a***e@gmail.com`, telefone `(31) 9****-1234`, endereço com logradouro truncado).
5. **Reconciliação com Atualização Cadastral**: Para que a atualização de cadastro em `POST /api/totem/cadastro` não sobreponha os dados reais do banco com máscaras (ex.: salvar `"a***e@gmail.com"` no banco), o backend deve comparar os campos recebidos: se o valor contiver caracteres de máscara ou for idêntico ao mascarado emitido, o campo original no banco de dados é rigorosamente preservado via `COALESCE` / preservação de valor prévio.

### 2.3 Causa-Raiz das Falhas por Socket IP
1. **Premissa**: A identificação de quem é o responsável pela reserva de grupo apoiava-se em `identificadoNoTotem.get(ipDe(req))`, e a identificação do totem apoiava-se em `ip === '192.168.20.161'`.
2. **Fato**: Redes corporativas com roteadores Wi-Fi locais, NAT ou proxies fazem com que múltiplos dispositivos compartilhem o mesmo IP de origem na camada de transporte.
3. **Fato**: Em ambiente de homologação ou teste (`127.0.0.1`), Totem 1 e Totem 2 colidem e sobrescrevem a sessão um do outro.
4. **Dedução**: A comunicação deve ser autenticada por token assinado via HMAC (já suportado pelo backend via `sign()`) ou cabeçalhos explícitos configuráveis no aplicativo desktop (`X-Totem-Id` / `X-Client-Machine`). A sessão do grupo deve trafegar via token assinado de sessão (`totemToken`), eliminando por completo a variável global em memória indexada por IP.

### 2.4 Causa-Raiz da Perda de `Numero` e `Complemento`
1. **Premissa**: `dbo.Cliente` possui colunas dedicadas `Numero` e `Complemento` criadas desde a migração inicial `0001_inicial.sql`.
2. **Fato**: O formulário do totem apresenta um campo único consolidado `Endereço` (`ops-server.ts:253` `enderecoDoTotem`).
3. **Mecanismo de Falha**: O desenvolvedor anterior, ao perceber que o cliente poderia editar a linha consolidada, adicionou uma limpeza forçada: `if (limparNumero) await query('UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id', { id });` (`ops-server.ts:369`).
4. **Dedução**: Essa deleção destrutiva apaga os dados normatizados do banco operacional. A coluna `Numero` e `Complemento` devem ser mantidas intactas caso não tenham sido alteradas, ou o formulário desktop/backend deve decompor número e complemento de forma inteligente sem executar queries de anulação cega.

### 2.5 Causa-Raiz da Quebra de Baterias e Concorrência de Vagas
1. **Premissa**: A pré-reserva no totem aceita grupos de múltiplos pilotos para uma ou mais baterias.
2. **Fato**: O loop de pré-reserva em `services/ops-server.ts:438-463` executa chamadas separadas a `inscreverN`, cada qual abrindo e commitando sua própria transação SQL.
3. **Mecanismo de Falha**: Quando há concorrência simultânea (outro totem ou a recepção reservando vagas concorrentes), se uma bateria possui 1 vaga e o grupo tem 2 participantes, o primeiro é gravado e o segundo falha com 409. O cliente no totem recebe erro genérico e fica sem saber que metade do grupo já foi inserida no banco de dados.
4. **Dedução**: Todas as inscrições do grupo para as baterias selecionadas devem ocorrer dentro de um bloco de transação único (`tx`). A checagem de vagas disponíveis contra o total solicitado pelo grupo deve ocorrer com locks pessimistas adequados (`WITH (UPDLOCK, HOLDLOCK)`), aplicando atomicidade total (tudo ou nada).

---

## 3. Caveats (Ressalvas e Limitações da Análise)

1. **Restrição de Implementação**: Esta investigação é estritamente de leitura (read-only); nenhuma alteração de código foi aplicada nos arquivos do projeto neste turno.
2. **Compatibilidade com Versões Anteriores do Totem Desktop**: Há totens em produção rodando versões legadas do .NET WinForms. Qualquer ajuste em payloads de API (como novos nomes de campos ou tokens de sessão) deve ser retrocompatível com requisições que omitam os novos cabeçalhos ou campos.
3. **Base de Dados Produção vs Migrations**: O script de criação `dbo.FilaImpressao` deverá ser adicionado como `migrations/ops/0011_fila_impressao.sql` e executado de forma idempotente (`IF OBJECT_ID('dbo.FilaImpressao') IS NULL...`) para não quebrar ambientes de desenvolvimento, CI ou servidores de homologação.
4. **Validação de Documentos Estrangeiros**: Passaportes não possuem algoritmo universal de dígito verificador como o CPF brasileiro; a validação deve ser focada em formato alfanumérico não-vazio e unicidade combinada (`TipoDocumento + Documento`).

---

## 4. Conclusion & Recomendações Técnicas Detalhadas

Abaixo está o plano de engenharia detalhado, mapeando os arquivos exatos, funções e linhas de código para implementação subsequente:

### Módulo 1: Persistência Robusta da Fila de Impressão (`dbo.FilaImpressao`)
- **Arquivos a Modificar/Criar**:
  1. `migrations/ops/0011_fila_impressao.sql` (Novo arquivo de migração DDL)
  2. `services/ops-server.ts` (linhas 207-233 e 576-595)
- **Estrutura da Tabela SQL Proposta**:
  ```sql
  IF OBJECT_ID('dbo.FilaImpressao') IS NULL
  CREATE TABLE dbo.FilaImpressao (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Url          NVARCHAR(500) NOT NULL,
    Titulo       NVARCHAR(200) NOT NULL,
    Origem       NVARCHAR(100) NOT NULL,
    Status       VARCHAR(20)   NOT NULL DEFAULT 'pendente', -- pendente | imprimindo | impressa | contingencia | cancelada
    Tentativas   INT           NOT NULL DEFAULT 0,
    UltimoErro   NVARCHAR(400) NULL,
    CriadoEm     DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    PegoEm       DATETIME2     NULL,
    FeitaEm      DATETIME2     NULL
  );
  GO
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FilaImpressao_Status')
    CREATE INDEX IX_FilaImpressao_Status ON dbo.FilaImpressao(Status, CriadoEm);
  GO
  ```
- **Ajustes em `services/ops-server.ts`**:
  - Excluir o array volátil `const filaImpressao: Impressao[] = []`.
  - `enfileirarImpressao(url, titulo, origem)`:
    Executar `INSERT INTO dbo.FilaImpressao (Url, Titulo, Origem, Status) VALUES (@url, @titulo, @origem, 'pendente')`.
  - `proximaImpressao()`:
    Executar consulta atômica com lock pessimista:
    ```sql
    WITH Prox AS (
      SELECT TOP (1) Id, Url, Titulo, Origem, Tentativas
      FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
      WHERE Status = 'pendente'
         OR (Status = 'imprimindo' AND DATEDIFF(second, PegoEm, SYSDATETIME()) > 90)
         OR (Status = 'contingencia' AND Tentativas < 5)
      ORDER BY Id ASC
    )
    UPDATE Prox
    SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
    OUTPUT inserted.Id id, inserted.Url url, inserted.Titulo titulo, inserted.Origem origem, inserted.Tentativas tentativas;
    ```
  - Regra de Contingência: Não descartar trabalhos com mais de 3 horas. Se um trabalho atingir 3 tentativas com falha ou ficar sem impressão por mais de 30 minutos com recepção inativa, transicionar para `Status = 'contingencia'`.
  - `POST /api/office/impressao/:id/feita`:
    `UPDATE dbo.FilaImpressao SET Status = 'impressa', FeitaEm = SYSDATETIME() WHERE Id = @id`.
  - `POST /api/office/impressao/:id/falhou`:
    `UPDATE dbo.FilaImpressao SET Status = CASE WHEN Tentativas >= 3 THEN 'contingencia' ELSE 'pendente' END, PegoEm = NULL WHERE Id = @id`.
  - `GET /api/office/impressao/fila`:
    Consultar `SELECT Id id, Titulo titulo, Origem origem, Status status, Tentativas tentativas, CriadoEm criadoEm FROM dbo.FilaImpressao WHERE Status IN ('pendente', 'imprimindo', 'contingencia') ORDER BY Id`.

---

### Módulo 2: Mascaramento PII e Proteção LGPD em `POST /api/totem/identificar`
- **Arquivos a Modificar**:
  1. `services/ops-server.ts` (linhas 310-335)
  2. `lib/ops/db.ts` (linhas 131-158 em `clienteColumns`)
- **Implementação do Mascarador**:
  - Criar funções utilitárias:
    - `mascararCpf(cpf: string)`: `"123.456.789-01"` $\rightarrow$ `"***.***.789-**"`
    - `mascararEmail(email: string)`: `"pedro.silva@gmail.com"` $\rightarrow$ `"p***a@g***.com"`
    - `mascararTelefone(tel: string)`: `"(31) 98765-4321"` $\rightarrow$ `"(31) 9****-4321"`
    - `mascararEndereco(end: string)`: `"Rua das Flores, 123"` $\rightarrow$ `"Rua das Fl***, 1**"`
  - Dependentes menores: Não expor nomes completos de crianças nem datas de nascimento em tela pública antes da validação. Exibir apenas o primeiro nome e inicial do sobrenome (ex.: `"Lucas S."`) e ano de nascimento ou idade (`"10 anos"`), gerando token HMAC seguro para identificação interna.
  - Proteção contra Sobrescrita em `updateCliente` (`lib/ops/db.ts`):
    - Se o valor recebido em `dados.email`, `dados.telefone` ou `dados.documento` contiver caracteres de máscara (`*`), ignorar o campo na atualização (`partial = true`) para manter o valor original do banco de dados intacto.

---

### Módulo 3: Substituição de Socket IP por Tokens de Sessão e Cabeçalhos de Totem
- **Arquivos a Modificar**:
  1. `services/ops-server.ts` (linhas 240-250, 298-299, 384, 395, 452, 471)
  2. `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` e `desktop/src/Kartodromo.Comum/Api.cs`
- **Estratégia Técnica**:
  - Criar função segura `totemIdDe(req: http.IncomingMessage)`:
    Prioridade: `req.headers['x-totem-id']` $\rightarrow$ `req.headers['x-client-machine']` $\rightarrow$ fallback amigável via mapeamento de IP configurável em banco (não hardcoded).
  - Gestão de Sessão do Grupo (`donoNoTotem`):
    - No `/api/totem/identificar`, além do token do cliente, retornar `totemToken = sign('totem:' + c.id + ':' + Date.now())`.
    - O aplicativo do Totem envia o cabeçalho `X-Totem-Session: <totemToken>` e/ou parâmetro `?dono=<id>.<token>`.
    - A função `donoNoTotem(req)` valida a assinatura HMAC do token recebido em vez de consultar o `Map` indexado por IP.
  - Eliminar por completo a coleção `identificadoNoTotem` em memória.

---

### Módulo 4: Harmonização de Peso, Preservação de Endereço, 409 e Docs Internacionais
- **Arquivos a Modificar**:
  1. `lib/ops/cadastro-obrigatorio.ts` (linhas 3-9 e 11-16)
  2. `lib/ops/instagram.ts` (linhas 10-15)
  3. `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (linhas 17-23 e 33-40)
  4. `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 525-527, 688-690)
  5. `services/ops-server.ts` (linhas 358-380)
- **Ações Técnicas**:
  - **Peso**: Harmonizar limites válidos de peso em `cadastro-obrigatorio.ts` e `ValidacaoCliente.cs` para valores humanos reais de kartismo: mínimo de 10 kg (crianças) / 20 kg (adultos) e máximo de 250 kg. Mensagem padrão: `"Peso inválido. Informe um valor entre 10 e 250 kg."`.
  - **Instagram**: Alterar `erroInstagramCliente` para aceitar valor vazio/nulo ou sentinela explícita (`"SEM_INSTAGRAM"` ou vazio), permitindo que clientes sem Instagram se inscrevam livremente.
  - **Preservação de `Numero` e `Complemento`**:
    - **Remover** a linha 369 de `services/ops-server.ts` (`UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL`).
    - Na atualização via totem, preservar `Numero` e `Complemento` existentes, a menos que novos valores estruturados sejam expressamente enviados pelo cliente.
  - **Passaporte e Telefones Internacionais**:
    - Em `services/ops-server.ts:379`, verificar duplicidade considerando o tipo de documento:
      ```sql
      SELECT TOP 1 Id id FROM dbo.Cliente
      WHERE (@tipo = 'CPF' AND DocumentoNum = @dNum)
         OR (@tipo <> 'CPF' AND TipoDocumento = @tipo AND Documento = @doc)
      ```
    - Aceitar números de telefone internacionais com validação E.164 (7 a 15 dígitos com ou sem DDI `+`).
  - **Tratamento de 409**:
    - Quando o servidor retornar 409 (documento já existente), o payload JSON deve retornar `{ error: 'documento_cadastrado', id: dup.id, token: sign('cli:' + dup.id) }`. O Totem pode sugerir diretamente: *"Documento já cadastrado. Deseja carregar seu cadastro existente?"*, sem limpar os dados já preenchidos.

---

### Módulo 5: Parametrização SQL, Bloqueio de Baterias Passadas e Concorrência Atômica
- **Arquivos a Modificar**:
  1. `lib/ops/totem-baterias.ts` (linhas 15-24 e 34-40)
  2. `lib/ops/office.ts` (linhas 426 e 438-470)
  3. `services/ops-server.ts` (linhas 398-406 e 438-463)
- **Ações Técnicas**:
  - **Parametrização**: Em `services/ops-server.ts`, substituir a interpolação `${rows.map...}` e `${lista}` por montagem dinâmica de parâmetros `@b0, @b1...` e `@g0, @g1...`, enviando o objeto de parâmetros seguro para `query()`.
  - **Bloqueio de Horário Passado**:
    - Em `TOTEM_BATERIAS_SQL` (`lib/ops/totem-baterias.ts`), substituir `b.Inicio >= CAST(SYSDATETIME() AS date)` por:
      ```sql
      AND b.Inicio > DATEADD(minute, 5, SYSDATETIME())
      ```
      (garantindo que baterias que começam em menos de 5 minutos ou já iniciadas não apareçam no totem).
    - Em `lib/ops/office.ts:426`, quando `origem === 'totem'`, verificar estritamente:
      ```sql
      CASE WHEN b.Inicio <= SYSDATETIME() THEN 1 ELSE 0 END passada
      ```
      (eliminando a tolerância indevida de -30 minutos para autoatendimento).
  - **Atomicidade na Inscrição de Grupos**:
    - Em `services/ops-server.ts:423-475`, encapsular todas as inserções de todas as baterias e participantes dentro de uma única transação atômica (`tx(async (run) => ...)`).
    - Verificar previamente se o número total de participantes cabe nas vagas restantes (`livres >= participantes`). Se faltar vaga para qualquer participante do grupo, abortar a transação com rollback completo e retornar HTTP 409 estruturado: `{ error: 'vagas_insuficientes', livres, solicitadas }`.
    - No app do Totem, ao receber 409 de vagas insuficientes, disparar reatualização automática da grade (`await TelaBaterias()`) e avisar o usuário cordialmente.

---

### Módulo 6: Otimização de Conexões e Debounce no ViaCep
- **Arquivos a Modificar**:
  1. `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 478-488 e 560-569)
  2. (Opcional recomendado) Endpoint de proxy/cache no backend `services/ops-server.ts` (`GET /api/totem/cep/:cep`)
- **Ações Técnicas**:
  - No WinForms C#:
    - Substituir `using var http = new HttpClient()` por uma instância estática e reutilizável com `SocketsHttpHandler` (pool de conexões TCP ativo).
    - Declarar `CancellationTokenSource _cepCts` e cancelar a requisição anterior em qualquer nova digitação.
    - Implementar debounce assíncrono de 300 ms antes do disparo da requisição HTTP.
  - Proxy no Servidor (`GET /api/totem/cep/:cep`):
    - Permitir que os totens consultem o CEP através do backend SRVKART, isolando as máquinas Kiosk de acesso direto à internet pública e habilitando cache local em memória/SQL para CEPs frequentes de Betim e região metropolitana de BH.

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e verificar de forma autônoma e independente as propostas deste handoff:

1. **Inspeção de Código Estática**:
   - `services/ops-server.ts`: linhas 211-233 (fila de impressão em RAM), 240-250 (IPs hardcoded e map de sessão), 310-335 (PII sem mascaramento), 369 (deleção destrutiva de Número e Complemento), 400-406 (concatenação SQL), 438-463 (inscrições em loops desintegrados).
   - `lib/ops/totem-baterias.ts`: linhas 21-24 e 34-40 (filtro frouxo de horário).
   - `lib/ops/cadastro-obrigatorio.ts`: linhas 3-9 e 11-16 (peso e Instagram).
   - `lib/ops/office.ts`: linha 426 (tolerância de -30 minutos).

2. **Comando de Testes Unitários de Backend**:
   - Executar suíte Vitest:
     ```bash
     npx vitest run tests/ops/
     ```
   - Teste específico de regras cadastrais:
     ```bash
     npx vitest run tests/ops/cadastro-obrigatorio.test.ts
     ```
   - Checagem estrita de tipos do TypeScript:
     ```bash
     npx tsc --noEmit
     ```

3. **Verificação de Regras Operacionais e Invalidação**:
   - Critério de Invalidação: Qualquer alteração que quebre a compatibilidade com a máquina da Recepção (`.53`), altere o telão (`FormTV`), quebre os testes unitários do vitest ou armazene senhas/credenciais em texto claro invalida a proposta técnica.

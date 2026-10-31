# Relatório Técnico de Investigação — Milestone M2 (Itens 7, 8 e 9)
**Segurança, Privacidade, LGPD, Mascaramento de PII e Sessão Segura do Totem**

- **Autor**: Explorer M2_1
- **Data**: 2026-10-26T22:20:00Z
- **Escopo**: Itens 7 (Mascaramento de PII), 8 (Proteção de Dados de Menores) e 9 (Token Seguro de Totem / Desacoplamento de IP)
- **Destinatário**: Orquestrador M2 (Conversation ID: `42a5e4fc-3e76-480a-9095-8d141e42fba1`)

---

## 1. Observation (Observações Diretas do Código e Sistema)

### 1.1 Exposição de PII e Vulnerabilidade LGPD em `/api/totem/identificar`
- **Arquivo**: `services/ops-server.ts`, linhas 269–310 e 387–410.
- **Linhas Observadas**:
  - `mascararDocumento(doc, tipo)`:
    ```typescript
    if (digits.length === 11 && (!tipo || String(tipo).toUpperCase() === 'CPF')) {
      return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
    }
    ```
    *Observação*: Exibe os 3 primeiros dígitos e os 2 dígitos verificadores (`123.***.***-00`). O requisito da especificação solicita o formato `***.456.789-**` (ocultando início e fim, mantendo o bloco central).
  - `mascararEmail(email)`:
    ```typescript
    const u = user.length > 0 ? `${user[0]}***` : 'u***';
    return `${u}@***${ext}`;
    ```
    *Observação*: Retorna `p***@***.com`. O padrão solicitado para usabilidade sem vazamento é `p***o@g***.com` (primeira e última letra do usuário, inicial do domínio).
  - `mascararTelefone(telefone)`:
    ```typescript
    return `(**) *****-${digits.slice(-4)}`;
    ```
    *Observação*: Oculta totalmente o DDD como `(**)`, impedindo que o cliente no totem identifique se o número registrado é seu DDD local (ex: 31). A especificação define `(31) 9****-1234`.
  - `nascimento` em `cliente`:
    Linha 395: `nascimento: txt(c.nascimento)`.
    *Observação*: Retorna a data de nascimento completa em texto claro (`YYYY-MM-DD`). Em quiosque público desprotegido, qualquer pessoa que digite um CPF aleatório descobre a data de nascimento exata do cidadão.
  - `numero` e `complemento`:
    Linhas 400-401: Já são retornados vazios `numero: ''` e `complemento: ''`.
  - `endereco`:
    Linha 399: `endereco: mascararEndereco(enderecoCompleto)`.

### 1.2 Exposição Irrestrita de Dados de Menores de Idade (Item 8)
- **Arquivo**: `services/ops-server.ts`, linhas 377–380 e linha 408:
  ```typescript
  const dependentes = await query<{ id: number; nome: string; nascimento: string }>(
    `SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId = @id AND c.Bloqueado = 0 ORDER BY c.Nome`,
    { id: c.id },
  );
  ...
  dependentes: dependentes.map((d) => ({ ...d, token: sign(`cli:${d.id}`) })),
  ```
- **Cliente Desktop**: `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 385 e 611–612:
  ```csharp
  _dependentes = r["dependentes"] is JsonArray a ? a.OfType<JsonObject>().Select(d => new Pessoa(d.L("id") ?? 0, d.S("nome"), d.S("nascimento"), d.S("token"))).ToList() : [];
  ...
  foreach (var d in _dependentes)
      lista.Adicionar(new OpcaoLinha(_k) { Height = P(72), Id = d.Id, Linha1 = d.Nome, Linha2 = d.Nascimento.Length >= 10 ? "Nascimento: " + Fmt.Dmy(d.Nascimento) : "", Direita = Fmt.Idade(d.Nascimento) is int i ? $"{i} anos" : "", Marcado = marcados.Contains(d.Id) });
  ```
- **Constatação Crítica**:
  1. O endpoint público retorna indiscriminadamente o **Nome Completo** e a **Data de Nascimento Exata** de todas as crianças cadastradas como dependentes do cliente pesquisado.
  2. Isso ocorre mesmo se o cliente NÃO marcou a opção "Sou responsável por menor de idade" na tela inicial do totem.
  3. Violação expressa do Art. 14 da LGPD (Lei 13.709/2018), que exige máxima proteção e melhor interesse da criança/adolescente, proibindo a exposição pública não autenticada de seus dados.

### 1.3 Acoplamento Frágil com IP de Socket e IPs Hardcoded (Item 9)
- **Arquivo**: `services/ops-server.ts`, linhas 317–327, 375–376, 434, 491 e 510:
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
- **Constatação Crítica**:
  1. `identificadoNoTotem` usa `ipDe(req)` (o IP do socket TCP) como chave única de sessão com TTL de 15 minutos.
  2. Se a rede sofrer NAT, proxy reverso, ou rodar localmente (`127.0.0.1`), totens diferentes colidem no mesmo IP, sobrescrevendo a sessão um do outro.
  3. Se um cliente "Carlos" se identifica e abandona o totem sem finalizar, seu `clienteId` fica ativo no IP por até 15 minutos. O cliente seguinte que se aproximar herdará as vagas pagas da reserva de grupo de Carlos no `GET /api/totem/baterias` e poderá apropriar-se delas no `POST /api/totem/inscrever`.
  4. O mapeamento de origem da impressora (`origemDe`) usa IPs estáticos fixos (`192.168.20.161` para Totem 1 e `192.168.20.69` para Totem 2). Se o DHCP alterar o IP ou se um Totem 3 for adicionado, a origem do termo impresso fica inconsistente.
  5. No cliente WinForms (`desktop/src/Kartodromo.Comum/Api.cs`, linha 54), a máquina já envia `X-Client-Machine: Environment.MachineName` em todos os requests HTTP (`TOTEN1` e `DESKTOP-4OR2GFI`), mas o servidor ignora esse cabeçalho e recorre exclusivamente ao IP cru.

### 1.4 Preservação de Dados no `POST /api/totem/cadastro`
- **Arquivo**: `services/ops-server.ts`, linhas 434–453:
  ```typescript
  // Proteção: não sobrescreve campos que retornaram com máscara e não foram alterados
  if (typeof dados.documento === 'string' && dados.documento.includes('***')) delete dados.documento;
  if (typeof dados.email === 'string' && dados.email.includes('***')) delete dados.email;
  if (typeof dados.telefone === 'string' && dados.telefone.includes('***')) delete dados.telefone;
  if (typeof dados.cep === 'string' && dados.cep.includes('***')) delete dados.cep;
  ```
- **Constatação**: Já existe uma proteção inicial em `ops-server.ts` que deleta campos contendo `***` antes de chamar `updateCliente(id, dados, true)`. Porém, a proteção ainda não cobre `nascimento` mascarado (ex: contendo `*`), e o cliente desktop `FormTotem.cs` valida formato de telefone e e-mail no lado cliente, o que precisa estar 100% alinhado para não travar a tela com alerta falso.

---

## 2. Logic Chain (Cadeia de Raciocínio Técnico)

1. **Premissa de Segurança em Totem Público**:
   - Um totem de autoatendimento opera em ambiente físico público desprotegido. A identificação inicial é feita apenas por documento ou e-mail, sem senha prévia.
   - Portanto, a tela de identificação e as rotas públicas de totem NUNCA podem devolver dados sensíveis desmascarados ou listas de crianças sem autenticação/confirmação.

2. **Dedução sobre PII de Adultos**:
   - Para permitir conferência visual sem vazamento de dados:
     - CPF: mascarar para `***.456.789-**` (oculta os 3 primeiros e os 2 últimos dígitos).
     - E-mail: mascarar para `p***o@g***.com` (primeiro e último caractere do usuário, inicial do domínio).
     - Telefone: mascarar para `(31) 9****-1234` (preserva DDD e 4 dígitos finais).
     - Endereço: omitir número e complemento (`numero: ''`, `complemento: ''`), mascarar logradouro para `Rua Ama***, ***` e CEP para `30130-***`.
     - Nascimento: retornar mascarado `**/**/****` (ou apenas o ano `**/**/1985`) e a flag booleana `temNascimento: true`.

3. **Dedução sobre Proteção de Menores (Item 8)**:
   - Em `FormTotem.cs`, a tela inicial possui a checkbox `_menor = menor.Marcado` ("Sou responsável por menor de idade").
   - Se o cliente NÃO marcou a opção de responsável por menor, o endpoint `/api/totem/identificar` deve retornar `dependentes: []`, impedindo qualquer vazamento incidental da existência ou nomes de dependentes.
   - Se marcou, os dependentes retornados devem ter:
     - `nome`: mascarado (ex: "Lucas H.***" ou "Lucas S.***").
     - `nascimento`: sem o dia e mês reais (ex: `YYYY-01-01` ou ano aproximado para cálculo de idade sem expor data de aniversário exata).
     - O token assinado do dependente (`sign('cli:' + d.id)`) é preservado para permitir a inscrição normal na bateria sem alterações no protocolo de corrida.

4. **Dedução sobre Token de Sessão de Totem (Item 9)**:
   - O acoplamento via `identificadoNoTotem.get(ipDe(req))` é inerentemente falho por três motivos: colisão de IP (NAT/proxy), roubo acidental de vagas (sessão órfã mantida por 15 min no IP após o usuário ir embora), e fragilidade em ambientes de rede dinâmicos.
   - Solução canônica: O servidor gera um token de sessão assinado por HMAC (`totemToken`) contendo `{ clienteId, totemId, criadoEm, expiraEm, nonce }`.
   - O endpoint `POST /api/totem/identificar` devolve esse `totemToken`.
   - O cliente totem (`Api.cs` / `FormTotem.cs`) armazena esse token em `_api.TotemSession` e passa no cabeçalho `X-Totem-Session: <token>` em todas as requisições subsequentes (`/api/totem/baterias`, `/api/totem/inscrever`, `/api/totem/cadastro`).
   - `donoNoTotem(req)` valida prioritariamente o cabeçalho `X-Totem-Session`. Se ausente, recorre ao fallback legado por IP para compatibilidade regressiva.
   - Quando o app do totem reinicia (`Reiniciar()`, timeout de 90s ou finalização), `_api.TotemSession = null` zera a sessão imediatamente, eliminando qualquer risco de o próximo cliente herdar a reserva alheia.

5. **Dedução sobre Identificação da Origem da Impressão**:
   - `Api.cs` já envia `X-Client-Machine: Environment.MachineName`.
   - O app pode também enviar `X-Totem-Id: Totem 1` (lido de `appsettings.json`).
   - O servidor em `origemDe(req)` passa a consultar nesta ordem:
     1. Cabeçalho `X-Totem-Id`
     2. Cabeçalho `X-Client-Machine` (`TOTEN1` -> 'Totem 1', `DESKTOP-4OR2GFI` / `TOTEN2` -> 'Totem 2')
     3. Token de sessão (`totemToken.totemId`)
     4. Fallback legado por IP (`192.168.20.161` -> 'Totem 1', `192.168.20.69` -> 'Totem 2')
   - Essa cadeia garante imunidade a trocas de IP DHCP e centraliza a rastreabilidade da origem.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Compatibilidade Regressiva Obrigatória**:
   - Totens em produção podem estar rodando versões antigas de `Kartodromo.Autoatendimento.exe` que ainda não enviam o cabeçalho `X-Totem-Session`.
   - Por essa razão, o backend DEVE manter o fallback para `identificadoNoTotem.get(ipDe(req))` se o cabeçalho `X-Totem-Session` não vier na requisição.
2. **Validação do Lado Cliente em `FormTotem.cs`**:
   - `ValidacaoCliente.ErroEmail` e `Fmt.MascaraFone` no cliente desktop não podem bloquear dados mascarados. Se o e-mail ou telefone contiverem `*`, o cliente desktop deve considerar o campo válido e não tentar reformatar apagando os asteriscos.
3. **Nenhum Código em Produção Foi Alterado nesta Etapa**:
   - Esta é uma missão estritamente de investigação (read-only). Nenhuma alteração foi realizada nos fontes de `services/` ou `desktop/`.

---

## 4. Conclusion (Especificação Concreta de Implementação)

### 4.1 Alterações no Backend (`services/ops-server.ts`)

#### A. Funções de Mascaramento PII e Sessão:
```typescript
// 1. Mascaramento Refinado de CPF e Documentos
function mascararDocumento(doc: unknown, tipo?: unknown): string {
  if (!doc) return '';
  const d = String(doc).trim();
  const digits = onlyDigits(d);
  if (digits.length === 11 && (!tipo || String(tipo).toUpperCase() === 'CPF')) {
    // Formato: ***.456.789-**
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  if (d.length <= 4) return '***';
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
}

// 2. Mascaramento Refinado de E-mail
function mascararEmail(email: unknown): string {
  if (!email) return '';
  const s = String(email).trim();
  const at = s.indexOf('@');
  if (at <= 0) return 'u***@***.com';
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  const u = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
  const dot = domain.indexOf('.');
  const domName = dot > 0 ? domain.slice(0, dot) : domain;
  const ext = dot > 0 ? domain.slice(dot) : '.com';
  const dMask = domName.length > 1 ? `${domName[0]}***` : 'g***';
  return `${u}@${dMask}${ext}`;
}

// 3. Mascaramento Refinado de Telefone com DDD visível
function mascararTelefone(telefone: unknown): string {
  if (!telefone) return '';
  const digits = onlyDigits(telefone);
  if (digits.length === 11) {
    // Ex: (31) 9****-1234
    return `(${digits.slice(0, 2)}) ${digits[2]}****-${digits.slice(-4)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ****-${digits.slice(-4)}`;
  }
  if (digits.length >= 4) {
    return `(**) *****-${digits.slice(-4)}`;
  }
  return '(**) *****-****';
}

// 4. Mascaramento de Nome de Menor
function mascararNomeMenor(nome: unknown): string {
  if (!nome) return '';
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? '';
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return `${primeiro} ${partes.slice(1, -1).map(p => p[0] + '.').join(' ')} ${ultimo[0]}***`.replace(/\s+/g, ' ');
}

// 5. Emissão e Validação de Token de Sessão de Totem
function emiteTotemSession(clienteId: number, totemId: string): string {
  const agora = Date.now();
  const exp = agora + 15 * 60_000;
  const nonce = Math.random().toString(36).slice(2, 8);
  const payload = `${clienteId}:${totemId}:${agora}:${exp}:${nonce}`;
  const sig = sign(`totem_sess:${payload}`);
  return `${payload}:${sig}`;
}

function validaTotemSession(token: string | null | undefined): { clienteId: number; totemId: string } | null {
  if (!token) return null;
  const partes = token.split(':');
  if (partes.length !== 6) return null;
  const [cidStr, totemId, agoraStr, expStr, nonce, sig] = partes;
  const payload = `${cidStr}:${totemId}:${agoraStr}:${expStr}:${nonce}`;
  if (sig !== sign(`totem_sess:${payload}`)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const cid = Number(cidStr);
  if (!Number.isInteger(cid) || cid <= 0) return null;
  return { clienteId: cid, totemId };
}
```

#### B. Atualização de `donoNoTotem(req)` e `origemDe(req)`:
```typescript
function donoNoTotem(req: http.IncomingMessage): number | null {
  // Prioridade 1: Cabeçalho seguro X-Totem-Session
  const headerToken = req.headers['x-totem-session'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    const s = validaTotemSession(headerToken.trim());
    if (s) return s.clienteId;
  }
  // Prioridade 2: Parâmetro de query
  try {
    const u = new URL(req.url ?? '/', 'http://totem');
    const qToken = u.searchParams.get('totemSession') || u.searchParams.get('ts');
    if (qToken) {
      const s = validaTotemSession(qToken);
      if (s) return s.clienteId;
    }
  } catch { /* ignore */ }

  // Fallback legado por IP para totens não atualizados
  const x = identificadoNoTotem.get(ipDe(req));
  return x && Date.now() - x.em < 15 * 60_000 ? x.id : null;
}

function origemDe(req: http.IncomingMessage): string {
  const totemHeader = req.headers['x-totem-id'];
  if (typeof totemHeader === 'string' && totemHeader.trim()) return totemHeader.trim();

  const clientMachine = String(req.headers['x-client-machine'] ?? '').trim().toUpperCase();
  if (clientMachine === 'TOTEN1' || clientMachine === 'TOTEM1') return 'Totem 1';
  if (clientMachine === 'DESKTOP-4OR2GFI' || clientMachine === 'TOTEN2' || clientMachine === 'TOTEM2') return 'Totem 2';
  if (clientMachine && !clientMachine.startsWith('SRVKART')) return clientMachine;

  const sess = validaTotemSession(String(req.headers['x-totem-session'] ?? ''));
  if (sess?.totemId) return sess.totemId;

  const ip = ipDe(req);
  return ip === '192.168.20.161' ? 'Totem 1' : ip === '192.168.20.69' ? 'Totem 2' : ip || 'totem';
}
```

#### C. Atualização de `/api/totem/identificar`:
- Receber `body.menor` (booleano).
- Gerar `totemToken = emiteTotemSession(c.id, origemDe(req))`.
- Se `!body.menor`: retornar `dependentes: []`.
- Se `body.menor`: retornar dependentes com `nome: mascararNomeMenor(d.nome)` e `nascimento: d.nascimento ? `${d.nascimento.slice(0, 4)}-01-01` : ''`.
- Retornar:
  ```typescript
  send(res, 200, {
    cliente: {
      id: c.id,
      nome: c.nome,
      tipoDocumento: txt(c.tipoDocumento) || 'CPF',
      documento: mascararDocumento(c.documento, c.tipoDocumento),
      documentoMascarado: mascararDocumento(c.documento, c.tipoDocumento),
      email: mascararEmail(c.email),
      emailMascarado: mascararEmail(c.email),
      telefone: mascararTelefone(c.telefone),
      telefoneMascarado: mascararTelefone(c.telefone),
      nascimento: c.nascimento ? `**/**/${String(c.nascimento).slice(0, 4)}` : '',
      temNascimento: Boolean(c.nascimento),
      peso: c.peso == null ? '' : String(Number(c.peso)),
      cep: txt(c.cep) ? `${txt(c.cep).slice(0, 5)}-***` : '',
      endereco: mascararEndereco(enderecoCompleto),
      enderecoMascarado: mascararEndereco(enderecoCompleto),
      numero: '',
      complemento: '',
      bairro: txt(c.bairro),
      cidade: txt(c.cidade),
      estado: txt(c.estado),
      lgpd: Boolean(c.lgpdAceiteEm),
      bloqueado: Boolean(c.bloqueado),
    },
    dependentes: dependentesMascarados,
    token: sign(`cli:${c.id}`),
    totemToken,
  });
  ```

#### D. Atualização de `/api/totem/cadastro`:
- Descartar campos que contenham `*` antes de atualizar:
  ```typescript
  if (typeof dados.documento === 'string' && dados.documento.includes('*')) delete dados.documento;
  if (typeof dados.email === 'string' && dados.email.includes('*')) delete dados.email;
  if (typeof dados.telefone === 'string' && dados.telefone.includes('*')) delete dados.telefone;
  if (typeof dados.cep === 'string' && dados.cep.includes('*')) delete dados.cep;
  if (typeof dados.nascimento === 'string' && dados.nascimento.includes('*')) delete dados.nascimento;
  ```
- No cadastro de novo cliente (`insertCliente`), emitir e devolver `totemToken` no response 201.

---

### 4.2 Alterações no Desktop WinForms (`desktop/`)

1. **`desktop/src/Kartodromo.Comum/Api.cs`**:
   - Adicionar propriedade `TotemSession`:
     ```csharp
     public string TotemSession { get; set; }
     public string TotemId => Config.Get("TotemId", Environment.MachineName);
     ```
   - Em `Enviar()`:
     ```csharp
     if (!string.IsNullOrEmpty(TotemSession)) req.Headers.TryAddWithoutValidation("X-Totem-Session", TotemSession);
     if (!string.IsNullOrEmpty(TotemId)) req.Headers.TryAddWithoutValidation("X-Totem-Id", TotemId);
     ```

2. **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
   - Em `Ir()` (identificação):
     ```csharp
     var r = await _api.Post("/api/totem/identificar", new { identificador = _ident, menor = _menor });
     _cliente = cli;
     _token = r.S("token");
     _api.TotemSession = r.S("totemToken");
     ```
   - Em `Reiniciar()`:
     ```csharp
     _api.TotemSession = null;
     ```
   - Em `TelaCadastro()` ao salvar:
     ```csharp
     if (r.S("totemToken") is { Length: > 0 } tt) _api.TotemSession = tt;
     ```
   - Em `ValidacaoCliente.cs`: permitir e-mail e telefone que contenham `*` se for cliente existente não editado.

---

## 5. Verification Method (Método de Verificação Independente)

### 5.1 Testes Automatizados Backend (Vitest)
Executar o comando:
```bash
npx vitest run tests/ops/m2-backend.test.ts
```
Critérios de Sucesso:
- Todas as 21 asserções existentes passam com sucesso.
- Adicionar novos casos de teste unitários em `tests/ops/m2-backend.test.ts` cobrindo:
  1. `mascararDocumento('12345678900')` deve retornar `***.456.789-**`.
  2. `mascararEmail('pedro@gmail.com')` deve retornar `p***o@g***.com`.
  3. `mascararTelefone('31998765432')` deve retornar `(31) 9****-5432`.
  4. `emiteTotemSession` e `validaTotemSession`: validar assinatura correta, expiração após 15 min e rejeição de token adulterado.
  5. `donoNoTotem(req)` com header `X-Totem-Session`: validar identificação correta sem depender de `req.socket.remoteAddress`.
  6. Proteção de dependentes menores: resposta sem flag `menor` não deve vazar nomes nem datas de dependentes; com flag `menor`, nomes de crianças vêm mascarados.

### 5.2 Verificação de Tipos TypeScript
```bash
npx tsc --noEmit
```
Critério: Zero erros de tipagem no servidor `services/ops-server.ts` e bibliotecas `lib/ops/`.

### 5.3 Compilação da Solução Desktop .NET 8
```bash
dotnet build desktop/Kartodromo.Desktop.sln -c Release
```
Critério: Build limpo, zero erros, zero warnings fatais.

### 5.4 Condições de Invalidação
Se qualquer um dos seguintes cenários ocorrer, a solução é inválida:
- O totem retornar o CPF completo desmascarado em `/api/totem/identificar`.
- O totem exibir o nome completo de crianças para qualquer usuário que digitar o CPF do pai sem validação.
- O totem associar as vagas de um cliente ao IP do totem permitindo que o cliente seguinte herde as vagas após 90 segundos de inatividade.
- O build de `dotnet build desktop/Kartodromo.Desktop.sln` falhar.

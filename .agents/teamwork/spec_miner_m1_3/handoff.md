# Relatório de Mineração de Especificação Técnica — Milestone 1 (M1-3)
**Agente**: Spec Miner M1-3 (`spec_miner_m1_3`)  
**Data**: 2026-11-02  
**Diretório de Trabalho**: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m1_3`  
**Projetos de Referência**:
- Frontend Operacional: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`
- Backend Local / Snapshot: `/Users/pedroguilherme/PROJETOS/KARTODROMO` e `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/`

---

## 1. Observation (Observações Diretas)

### 1.1 Tópico 1: Streaming Server-Sent Events (W3C SSE)
1. **Parser de Eventos Atual (`src/core/realtime/stream.ts:8-21`)**:
   ```ts
   adicionar(pedaco: string): EventoFluxo[] {
     this.resto += pedaco;
     const blocos = this.resto.split('\n\n');
     this.resto = blocos.pop() ?? '';
     const saida: EventoFluxo[] = [];
     for (const b of blocos) {
       const tipo = /^event: (.+)$/m.exec(b)?.[1];
       const dados = /^data: (.*)$/m.exec(b)?.[1];
       if (!tipo || dados === undefined) continue;
       try { saida.push({ tipo, dados: JSON.parse(dados) } as EventoFluxo); } catch { saida.push({ tipo: 'invalido', dados: null }); }
     }
     return saida;
   }
   ```
   - **Defeito Multilinha**: A regex `/^data: (.*)$/m.exec(b)` captura apenas a primeira linha iniciada com `data:`. Se o servidor enviar payload W3C particionado em várias linhas `data:` (ex.: JSON formatado ou arrays longos), `dados` fica truncado. `JSON.parse` falha com `SyntaxError` e produz `{ tipo: 'invalido', dados: null }`.
   - **Defeito Comentários SSE**: Linhas iniciando com `:` (ex.: `: batida\n\n`) não possuem `tipo` nem `dados`, sendo descartadas pelo bloco `if (!tipo || dados === undefined) continue;`. Porém, se houver um comentário dentro de um bloco de evento (ex.: `event: state\n: keepalive\ndata: {...}\n\n`), o parser atual pode se comportar de forma imprevisível dependendo das quebras.

2. **Loop de Despacho de Eventos (`src/core/realtime/stream.ts:52-56`)**:
   ```ts
   for (const ev of leitor.adicionar(dec.decode(value, { stream: true }))) {
     if (ev.tipo === 'state') avisos.aoEvento(ev.dados);
     else if (ev.tipo === 'auth-expired') return 'renovar';
     else return 'repetir';
   }
   ```
   - **Defeito Keep-Alive (Ping / Heartbeat)**: Quando o backend ou proxies intermediários emitem eventos de keep-alive (`event: ping\ndata: {}\n\n` ou `event: heartbeat\ndata: {}\n\n`), `ev.tipo` é avaliado como `'ping'` ou `'heartbeat'`. Como o `if` só trata `'state'` e `'auth-expired'`, qualquer ping cai no `else return 'repetir'`. Isso encerra `umaConexao()`, dispara `aoDesconectar()` e força uma reconexão desnecessária a cada 15s.

3. **Handshake e Timeouts de Conexão (`src/core/realtime/stream.ts:36-46`)**:
   ```ts
   aborto = new AbortController();
   const r = await f(`${base}/api/app/v1/events`, { headers: { authorization: `Bearer ${t.accessToken}` }, signal: aborto.signal });
   if (r.status === 401) return 'renovar';
   if (!r.ok || !r.body) return 'repetir';
   avisos.aoConectar();
   // ...
   let vigia: ReturnType<typeof setTimeout> | undefined;
   const armar = () => { clearTimeout(vigia); vigia = setTimeout(() => aborto?.abort(), SILENCIO_MAX_MS); };
   armar();
   ```
   - **Defeito Ausência de Timeout no Handshake**: O temporizador de silêncio (`SILENCIO_MAX_MS = 45_000`) só é armado após `r.body.getReader()`. Se o servidor ou a rede congelar durante a negociação TCP/TLS/HTTP inicial da chamada `f(...)`, a requisição fica travada indefinidamente sem abortar. A especificação exige timeout de 5 segundos no handshake inicial.

---

### 1.2 Tópico 2: Classificação de IPs Privados RFC 1918 em `baseSegura`
1. **Implementação Atual (`src/core/api/cliente.ts:9`)**:
   ```ts
   export const baseSegura = (base: string, desenvolvimento: boolean) =>
     desenvolvimento || base.startsWith('https://') || /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
   ```
2. **Crash em Produção por Ausência de Fallback (`src/features/auth/sessao.tsx:13-14`)**:
   ```ts
   const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? '';
   if (!baseSegura(BASE, __DEV__)) throw new Error('Endereço do servidor precisa ser HTTPS.');
   ```
   - **Defeito RFC 1918**: Fora de desenvolvimento (`__DEV__ === false`), qualquer IP local de pista (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) é rejeitado, impedindo a operação dos tablets em Release conectando ao servidor local `:4050` ou `:4150`.
   - **Defeito Crash Top-Level**: `throw new Error(...)` no escopo global do módulo faz a aplicação quebrar antes da montagem da árvore React, resultando em tela branca fatal em vez de exibir interface de configuração ou aviso amigável.

---

### 1.3 Tópico 3: Renovação de Token no HTTP 401 e Idempotência
1. **Método `get` com Renovação Funcional (`src/core/api/cliente.ts:46-53`)**:
   ```ts
   let r = await f(url(caminho), await comToken(await cofre.ler()));
   if (r.status === 401) {
     const novo = await renovar();
     if (!novo) { await sair(); throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.'); }
     r = await f(url(caminho), await comToken(novo));
   }
   ```
2. **Método `postar` sem Renovação (`src/core/api/cliente.ts:72-76`)**:
   ```ts
   async function postar(caminho: string, corpo: object) {
     const r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
     if (!r.ok) throw await lerErro(r);
     return r.json();
   }
   ```
3. **Método `enviarOperacao` sem Renovação (`src/core/api/cliente.ts:81-90`)**:
   ```ts
   async function enviarOperacao(caminho: string, corpo: { operationId: string } & Record<string, unknown>): Promise<ResultadoOperacao> {
     const desconhecido: ResultadoOperacao = { operationId: corpo.operationId, status: 'UNKNOWN' };
     let r: Response;
     try {
       r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
     } catch { return desconhecido; }
     if (r.status >= 500) return desconhecido;
     if (!r.ok) throw await lerErro(r);
     return r.json() as Promise<ResultadoOperacao>;
   }
   ```
   - **Defeito**: Operações de escrita falham instantaneamente se o token expirar, mesmo havendo `refreshToken` válido.
   - **Regra de Idempotência**: Em `enviarOperacao`, se o token for renovado, o reenvio **DEVE** preservar rigorosamente o mesmo `operationId` original para não duplicar efeitos colaterais na pista (sorteio, troca de kart, penalidade).

---

### 1.4 Tópico 4: Geração e Persistência de UUID em SecureStore
1. **Código Atual em `sessao.tsx` e `cofre.ts`**:
   - `sessao.tsx:36`: `await cliente.entrar('gerencia', 'teste-codex', 'ipad-sim').catch(() => null);`
   - `sessao.tsx:60`: `await cliente.entrar(u, s, 'app-operacional');`
   - `src/core/security/cofre.ts`: Apenas persiste tokens na chave `'kartodromo.operacional.sessao'`.
   - `tests/cliente.test.ts:56-60`: Valida expressamente que `cofre.ts` não pode conter referências a `AsyncStorage`.
   - **Defeito**: O identificador `'app-operacional'` é fixo para todos os dispositivos. A trilha de auditoria (`historico.tsx:81`) não consegue distinguir qual tablet físico realizou cada operação.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **W3C SSE**:
   - Pela norma W3C SSE / WHATWG Living Standard § 9.2, um evento SSE termina em `\n\n`.
   - Múltiplas linhas `data:` dentro do mesmo bloco devem ter seus conteúdos unidos por `\n` (`dataLines.join('\n')`). Apenas após essa concatenação o `JSON.parse` deve ser executado.
   - Linhas iniciando com `:` são comentários de transporte e devem ser ignoradas pelo interpretador de eventos.
   - Eventos com `event: ping` ou `event: heartbeat` servem para manter vivo o canal TCP através de NATs e firewalls; eles comprovam liveness da conexão e devem rearmar o watchdog de 45 segundos, jamais disparar retorno `'repetir'` no loop de despacho.
   - A requisição `fetch` do handshake precisa de um `AbortController` com temporizador estrito de 5.000 ms. Se o servidor não responder os headers HTTP em 5 s, o handshake é abortado e entra no fluxo normal de retentativa com backoff exponencial.

2. **RFC 1918 e `baseSegura`**:
   - Pela RFC 1918 Seção 3, os blocos de rede privada são:
     - `10.0.0.0/8` (faixa `10.0.0.0` a `10.255.255.255`)
     - `172.16.0.0/12` (faixa `172.16.0.0` a `172.31.255.255`, octeto 2 entre 16 e 31)
     - `192.168.0.0/16` (faixa `192.168.0.0` a `192.168.255.255`)
   - Em adição, o loopback RFC 5735 (`127.0.0.1` e `localhost`) deve ser permitido.
   - Para evitar brechas de spoofing de subdomínio (ex.: `192.168.1.1.evil.com`) e credenciais na URL (ex.: `http://192.168.1.1@evil.com`), a validação deve extrair o host via parser de URL formal ou regex com delimitação estrita de limites (`:porta`, `/caminho` ou fim de linha).
   - O app não pode quebrar ao importar `sessao.tsx` quando `EXPO_PUBLIC_API_URL` não estiver definida. O Provedor de Sessão deve renderizar uma tela informativa de contingência.

3. **Renovação Idempotente de Token**:
   - A função `renovar()` já agrupa chamadas concorrentes através da promise `renovando ??= ...`.
   - Tanto `postar` quanto `enviarOperacao` devem capturar `r.status === 401`.
   - Ao receber 401:
     - Chama `renovar()`.
     - Se `renovar()` retornar `null` (refresh token inválido/vencido): executa `sair()` e lança `ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.')`.
     - Se `renovar()` for bem-sucedido: repete a requisição uma única vez com o novo token de acesso.
     - Em `enviarOperacao`, o objeto `corpo` (que contém o `operationId`) é reenviado intacto. Como o backend transacional possui cache de deduplicação por `operationId`, reenviar a operação é seguro e à prova de duplicações.
     - Se `renovar()` falhar por erro de rede: `enviarOperacao` retorna status `UNKNOWN` sem deslogar o operador, preservando a sessão para posterior reconciliação.

4. **Identificador Único por Dispositivo**:
   - Conforme RFC 4122 / RFC 9562, um UUID v4 possui 36 caracteres no formato `8-4-4-4-12`, versão `4` e variante `8`, `9`, `a` ou `b`.
   - A geração deve tentar primeiro a API padrão `globalThis.crypto.randomUUID()`. Se indisponível, usar `globalThis.crypto.getRandomValues()`. Se ambas faltarem, aplicar gerador pseudorrandômico compatível RFC 4122 baseado em `Math.random()` e `Date.now()`.
   - O identificador deve ser lido e persistido via `expo-secure-store` na chave dedicada `'kartodromo.operacional.deviceId'`.
   - Chamadas subsequentes no ciclo de vida do dispositivo devem recuperar o mesmo UUID sem regeneração.

---

## 3. Features Discovered (Matriz de Funcionalidades Mineradas)

| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento em Erro | Descoberto Via |
|---|-----------|---------|-----------|----------|--------|-----------------------|----------------|
| **F01** | SSE / Parser | Multiline `data:` W3C | Acumular múltiplos prefixos `data:` no mesmo bloco SSE antes do parse JSON | String de chunks contendo múltiplas linhas `data:` | Array com `EventoFluxo` estruturado com JSON íntegro | Linhas corrompidas geram `{ tipo: 'invalido', dados: null }` | W3C SSE Spec / Falha 05 |
| **F02** | SSE / Parser | Ignorar Comentários (`:`) | Ignorar linhas iniciadas por `:` (como `: batida`, `: keepalive`) sem emitir evento inválido | Linhas iniciando com `:` no bloco SSE | Linha ignorada; não polui `EventoFluxo[]` | Linha é descartada silenciosamente | W3C SSE Spec / Falha 04 |
| **F03** | SSE / Stream | Supressão de Ping / Heartbeat | Tratar `event: ping` e `event: heartbeat` como batimento sem derrubar o socket | Evento SSE do tipo `ping` ou `heartbeat` | Rearme do temporizador de silêncio; stream permanece ativo | Se payload do ping for inválido, conexão continua ativa | Falha 04 / `rotas.ts:141` |
| **F04** | SSE / Stream | Timeout de Handshake (5s) | Temporizador de 5000ms com AbortController durante negociação HTTP inicial do stream | Início do `fetch` para `/events` | Conexão estabelecida em < 5s | Timeout aborta fetch; agenda reconexão com backoff | Falha 06 / PRD Operacional |
| **F05** | SSE / Stream | Watchdog de Silêncio (45s) | Abortar conexão inativa se nenhum dado chegar por 45 segundos | Leitura de chunks em `corpo.read()` | Rearma timer de 45s a cada chunk lido | Dispara `abort()`, `aoDesconectar()` e reconexão | `stream.ts:26, 45` |
| **F06** | Rede / Auth | Classificação RFC 1918 | Permitir conexões HTTP a IPs privados `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` em Release | URL base e flag booleana `desenvolvimento` | `true` se URL for válida e permitida; `false` se pública HTTP | Retorna `false` para domínios públicos HTTP e IPs forjados | RFC 1918 / Falha 01 |
| **F07** | UI / Sessão | Tela de Fallback de Servidor | Exibir tela amigável quando `EXPO_PUBLIC_API_URL` não for injetada em vez de crash top-level | Variável `BASE` nula ou rejeitada por `baseSegura` | Componente React informativo de URL não configurada | Bloqueia chamadas de rede sem lançar exceção fatal | Falha 01 / `sessao.tsx:14` |
| **F08** | API / Auth | Auto-Refresh 401 em `postar` | Renovar JWT automaticamente em 401 para métodos de escrita comuns e repetir POST | Requisição `postar(...)` recebendo 401 | Resultado da operação após renovação transparente | Se refresh falhar: limpa cofre, chama `sair()` e lança 401 | Falha 02 / `cliente.ts:72` |
| **F09** | API / Auth | Auto-Refresh Idempotente (`enviarOperacao`) | Renovar JWT em 401 preservando `operationId` idêntico na repetição | Requisição `enviarOperacao` com `{ operationId }` recebendo 401 | `ResultadoOperacao` (ex.: `APPLIED`) com mesmo `operationId` | Se refresh falhar por rede: retorna `{ operationId, status: 'UNKNOWN' }` | Falha 02 / Falha 28 |
| **F10** | Segurança | Geração de UUID v4 de Dispositivo | Gerar UUID v4 canônico utilizando hierarquia de crypto nativo com fallback determinístico | Invocação de `obterOuCriarDeviceId()` | String de 36 caracteres no formato RFC 4122 v4 | Fallback por pseudorrandômico em plataformas legadas | Falha 03 / RFC 4122 |
| **F11** | Segurança | Persistência de Device ID no SecureStore | Gravar UUID gerado no `SecureStore` sob chave dedicada garantindo estabilidade de auditoria | UUID gerado e instância do `SecureStore` | UUID lido do storage em arranques subsequentes | Sobrescreve com novo UUID se valor armazenado for inválido | Falha 03 / `cofre.ts` |

---

## 4. Edge Cases (Matriz de Casos de Borda e Validações Estritas)

| # | Feature | Entrada / Cenário | Comportamento Esperado |
|---|---------|-------------------|------------------------|
| **E01** | SSE Multilinha | `event: state\ndata: {"seq": 1,\ndata: "sessoes": []}\n\n` | O leitor une as duas linhas com `\n` gerando `{"seq": 1,\n"sessoes": []}`. O parse JSON obtém `{ seq: 1, sessoes: [] }` e emite `{ tipo: 'state', dados }`. |
| **E02** | SSE Multilinha | `data: \ndata: {"ok":true}\n\n` | Primeira linha vazia não corrompe o JSON; resulta em `\n{"ok":true}` que é válido em `JSON.parse`. |
| **E03** | SSE Comentários | `: keepalive batida\n\n` | O bloco é reconhecido como comentário e descartado. Não gera `{ tipo: 'invalido' }`. |
| **E04** | SSE Comentários | `event: state\n: comentario interno\ndata: {"seq":2}\n\n` | A linha iniciada por `:` é ignorada dentro do bloco. O evento `state` é montado normalmente com `{ seq: 2 }`. |
| **E05** | SSE Ping / Keepalive | `event: ping\ndata: {}\n\n` | O evento ping não finaliza o loop de leitura; o stream continua aberto e o temporizador de 45s é rearmado. |
| **E06** | SSE Ping / Keepalive | `event: heartbeat\ndata: {"tempo": 123456}\n\n` | Reconhecido como keepalive; loop continua sem desconectar ou retornar `'repetir'`. |
| **E07** | SSE Handshake Timeout | Servidor demora 5.100 ms para responder os headers de `/events` | O `AbortController` do handshake dispara aos 5.000 ms. A requisição é abortada com `AbortError`. O cliente agenda reconexão com backoff sem travar a interface. |
| **E08** | SSE Silence Timeout | Conexão TCP aberta, mas nenhum byte recebido por 45.000 ms | O watchdog de 45 s dispara `abort()`. O cliente chama `avisos.aoDesconectar()` e inicia reconexão. |
| **E09** | RFC 1918 Class A | `http://10.0.0.1:4050/api` (`desenvolvimento: false`) | **Aceito** (`true`). IP válido no bloco `10.0.0.0/8`. |
| **E10** | RFC 1918 Class B | `http://172.16.0.5:4050` (`desenvolvimento: false`) | **Aceito** (`true`). Segundo octeto 16 (faixa 16-31). |
| **E11** | RFC 1918 Class B | `http://172.31.255.254:4050` (`desenvolvimento: false`) | **Aceito** (`true`). Segundo octeto 31 (limite superior). |
| **E12** | RFC 1918 Class B Inválido | `http://172.15.0.1:4050` (`desenvolvimento: false`) | **Rejeitado** (`false`). IP público (15 < 16). |
| **E13** | RFC 1918 Class B Inválido | `http://172.32.0.1:4050` (`desenvolvimento: false`) | **Rejeitado** (`false`). IP público (32 > 31). |
| **E14** | RFC 1918 Class C | `http://192.168.1.100:4050` (`desenvolvimento: false`) | **Aceito** (`true`). IP válido no bloco `192.168.0.0/16`. |
| **E15** | Spoofing Subdomínio | `http://192.168.1.1.evil.com:4050` (`desenvolvimento: false`) | **Rejeitado** (`false`). Hostname é um domínio público com prefixo forjado. |
| **E16** | Spoofing Userinfo | `http://192.168.1.1@evil.com:4050` (`desenvolvimento: false`) | **Rejeitado** (`false`). Hostname real é `evil.com`. |
| **E17** | IP Octeto Inválido | `http://192.168.1.256:4050` (`desenvolvimento: false`) | **Rejeitado** (`false`). Octeto 256 excede limite de 255. |
| **E18** | IP Público HTTP | `http://200.1.2.3:4050` (`desenvolvimento: false`) | **Rejeitado** (`false`). Não é IP privado nem loopback; HTTP puro público é proibido em Release. |
| **E19** | Loopback com Porta | `http://127.0.0.1:4799` e `http://localhost:3000` | **Aceito** (`true`) mesmo em modo Release. |
| **E20** | Ausência de API_URL | `EXPO_PUBLIC_API_URL = ""` | O app renderiza tela de fallback amigável informando a ausência de URL da API; nenhum crash top-level. |
| **E21** | 401 Retry `postar` | Chamada `postar('/users/admin/block', ...)` recebe 401 | Executa `renovar()`, obtém novo token, repete POST com novo `Bearer` e retorna sucesso 200. |
| **E22** | 401 Refresh Falho | `postar(...)` recebe 401, `/auth/refresh` retorna 401 | Limpa credenciais do `cofre`, dispara `aoSair()` e lança `ErroApi(401, 'UNAUTHENTICATED', ...)`. |
| **E23** | 401 Retry `enviarOperacao` | `enviarOperacao('/sessions/b1/draw', { operationId: 'op-123' })` recebe 401 | Renova o token e repete o POST com **o mesmo `operationId: 'op-123'`**. O backend processa sem duplicidade. |
| **E24** | 401 Rede Caiu no Refresh | `enviarOperacao(...)` recebe 401; chamada `/auth/refresh` falha com `Error: Failed to fetch` | Retorna `{ operationId: 'op-123', status: 'UNKNOWN' }` sem limpar o cofre e sem deslogar o usuário. |
| **E25** | 401 Concorrente | Duas chamadas simultâneas de `enviarOperacao` recebem 401 | Ambas aguardam a mesma promise singleton de `renovar()`; apenas uma requisição a `/auth/refresh` é enviada. |
| **E26** | Retry 401 Repetido | Operação retenta com novo token mas recebe 401 novamente | Não entra em loop infinito: aborta na primeira retentativa, desloga e lança erro 401. |
| **E27** | UUID Plataforma Moderna | Ambiente Hermes com `crypto.randomUUID` | Gera UUID canônico de 36 caracteres via API nativa. |
| **E28** | UUID Plataforma Legada | `crypto.randomUUID` é `undefined` | Utiliza fallback pseudorrandômico gerando string de 36 caracteres compatível com regex de UUID v4. |
| **E29** | UUID Persistência | Chamada consecutiva de `obterOuCriarDeviceId()` | Retorna rigorosamente o mesmo UUID retornado na primeira chamada (lido do SecureStore). |
| **E30** | UUID Corrompido | `SecureStore` contém string não UUID (ex.: `"invalido"`) | Detecta que o formato é inválido, gera novo UUID v4 canônico, atualiza o SecureStore e retorna o novo UUID. |

---

## 5. Especificação Técnica Detalhada dos 4 Componentes

### 5.1 Componente 1: Conformidade W3C SSE (`src/core/realtime/stream.ts`)

#### Assinatura e Tipos de Dados
```ts
export type EventoFluxo =
  | { tipo: 'state'; dados: EventoEstado }
  | { tipo: 'auth-expired'; dados: unknown }
  | { tipo: 'ping'; dados: unknown }
  | { tipo: 'heartbeat'; dados: unknown }
  | { tipo: 'invalido'; dados: null };
```

#### Algoritmo do Parser W3C (`LeitorEventos`)
1. **Normalização**: Converter `\r\n` e `\r` para `\n`.
2. **Buffer de Resto**: `this.resto += pedaco`. Dividir por `\n\n`. O último elemento torna-se `this.resto`.
3. **Processamento Linha a Linha por Bloco**:
   - Inicializar: `let tipo = 'message'; const linhasDados: string[] = []; let temDados = false;`
   - Para cada linha no bloco:
     - Se `linha === ''`: ignorar.
     - Se `linha.startsWith(':')`: ignorar (comentário de transporte).
     - Localizar primeiro dois-pontos: `const idx = linha.indexOf(':')`.
     - Campo e valor:
       - Se `idx !== -1`:
         - `campo = linha.slice(0, idx)`
         - `valor = linha.slice(idx + 1)`
         - Se `valor.startsWith(' ')`: `valor = valor.slice(1)` (remover espaço inicial).
       - Se `idx === -1`:
         - `campo = linha; valor = '';`
     - Se `campo === 'event'`: `tipo = valor;`
     - Se `campo === 'data'`: `linhasDados.push(valor); temDados = true;`
4. **Despacho do Evento**:
   - Se `tipo === 'ping' || tipo === 'heartbeat'`:
     - Emitir `{ tipo, dados: null }`.
   - Se `temDados`:
     - `const dadosConcatenados = linhasDados.join('\n');`
     - Se `tipo === 'state'`:
       - Tentar `JSON.parse(dadosConcatenados)`. Em caso de sucesso: emitir `{ tipo: 'state', dados }`. Em caso de falha: emitir `{ tipo: 'invalido', dados: null }`.
     - Se `tipo === 'auth-expired'`: emitir `{ tipo: 'auth-expired', dados: {} }`.

#### Algoritmo de Handshake com Timeout de 5s (`conectarFluxo`)
```ts
const TIMEOUT_HANDSHAKE_MS = 5_000;
const SILENCIO_MAX_MS = 45_000;

async function umaConexao(): Promise<'renovar' | 'repetir'> {
  const t = await cliente.tokenAtual();
  if (!t) return 'renovar';

  aborto = new AbortController();
  
  // Timeout estrito de 5s para o handshake inicial
  const timerHandshake = setTimeout(() => {
    aborto?.abort(new Error('Timeout de handshake SSE'));
  }, TIMEOUT_HANDSHAKE_MS);

  let r: Response;
  try {
    r = await f(`${base}/api/app/v1/events`, {
      headers: { authorization: `Bearer ${t.accessToken}` },
      signal: aborto.signal,
    });
  } finally {
    clearTimeout(timerHandshake);
  }

  if (r.status === 401) return 'renovar';
  if (!r.ok || !r.body) return 'repetir';

  avisos.aoConectar();
  const leitor = new LeitorEventos();
  const dec = new TextDecoder();
  const corpo = r.body.getReader();

  let vigia: ReturnType<typeof setTimeout> | undefined;
  const armar = () => {
    clearTimeout(vigia);
    vigia = setTimeout(() => aborto?.abort(), SILENCIO_MAX_MS);
  };
  armar();

  try {
    for (;;) {
      const { value, done } = await corpo.read();
      if (done) return 'repetir';
      armar(); // Leitura de chunk (dados ou batida) comprova liveness

      for (const ev of leitor.adicionar(dec.decode(value, { stream: true }))) {
        if (ev.tipo === 'state') avisos.aoEvento(ev.dados);
        else if (ev.tipo === 'auth-expired') return 'renovar';
        else if (ev.tipo === 'ping' || ev.tipo === 'heartbeat') continue; // Manter conectado
        else return 'repetir'; // 'invalido' ou desconhecido com payload corrompido
      }
    }
  } finally {
    clearTimeout(vigia);
  }
}
```

---

### 5.2 Componente 2: Classificação RFC 1918 e Fallback (`baseSegura` e `sessao.tsx`)

#### Assinatura da Função
```ts
export function baseSegura(base: string, desenvolvimento: boolean): boolean;
```

#### Regras de Validação Estritas
1. Se `desenvolvimento === true`: Retorna `true`.
2. Se `base` for vazia ou nula: Retorna `false`.
3. Se `base.startsWith('https://')`: Retorna `true` (requer URL válida se analisada por `new URL`).
4. Se iniciar por `http://`:
   - Extrair o hostname e porta de forma confiável (usando `new URL(base)` ou regex delimitada estritamente).
   - Permitir se o hostname for:
     - `'localhost'` ou `'127.0.0.1'`
     - IPv4 pertencente a `10.0.0.0/8`: `^10\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$`
     - IPv4 pertencente a `172.16.0.0/12`: `^172\.(?:1[6-9]|2\d|3[01])\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$`
     - IPv4 pertencente a `192.168.0.0/16`: `^192\.168\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$`
   - Rejeitar qualquer outro hostname (ex.: IPs públicos, domínios `http://...`, subdomínios maliciosos contendo IPs como prefixo).

#### Implementação de Referência de `baseSegura`
```ts
const IP_RFC1918 = /^(?:10\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|172\.(?:1[6-9]|2\d|3[01])\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|192\.168\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))$/;

export function baseSegura(base: string, desenvolvimento: boolean): boolean {
  if (desenvolvimento) return true;
  if (!base || typeof base !== 'string') return false;
  try {
    const u = new URL(base);
    if (u.protocol === 'https:') return true;
    if (u.protocol !== 'http:') return false;
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    return IP_RFC1918.test(h);
  } catch {
    return false;
  }
}
```

#### Fallback Amigável em `sessao.tsx`
- **Eliminação do Throw**: Remover `if (!baseSegura(BASE, __DEV__)) throw new Error(...)` do escopo de carregamento do arquivo.
- **Renderização Condicional**:
  ```tsx
  export function ProvedorSessao({ children }: PropsWithChildren) {
    const configuracaoValida = useMemo(() => baseSegura(BASE, __DEV__), []);
    if (!configuracaoValida) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0f172a' }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            Servidor Não Configurado
          </Text>
          <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>
            O endereço da API ({BASE || 'não informado'}) não é seguro ou não pertence à rede local do Kartódromo (RFC 1918).
          </Text>
        </View>
      );
    }
    // ... segue montagem normal do contexto
  }
  ```

---

### 5.3 Componente 3: Renovação de Token 401 Idempotente (`cliente.ts`)

#### Fluxo em `postar`
```ts
async function postar<T = unknown>(caminho: string, corpo: object): Promise<T> {
  let r = await f(url(caminho), await comToken(await cofre.ler(), {
    method: 'POST',
    headers: JSON_H,
    body: JSON.stringify(corpo),
  }));

  if (r.status === 401) {
    const novo = await renovar();
    if (!novo) {
      await sair();
      throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.');
    }
    r = await f(url(caminho), await comToken(novo, {
      method: 'POST',
      headers: JSON_H,
      body: JSON.stringify(corpo),
    }));
    if (r.status === 401) {
      await sair();
      throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.');
    }
  }

  if (!r.ok) throw await lerErro(r);
  return r.json() as Promise<T>;
}
```

#### Fluxo em `enviarOperacao` (Idempotência com `operationId`)
```ts
async function enviarOperacao(
  caminho: string,
  corpo: { operationId: string } & Record<string, unknown>
): Promise<ResultadoOperacao> {
  const desconhecido: ResultadoOperacao = { operationId: corpo.operationId, status: 'UNKNOWN' };
  let r: Response;

  try {
    r = await f(url(caminho), await comToken(await cofre.ler(), {
      method: 'POST',
      headers: JSON_H,
      body: JSON.stringify(corpo),
    }));
  } catch {
    return desconhecido;
  }

  // Tratamento de 401 com renovação e retentativa idempotente
  if (r.status === 401) {
    let novo: Tokens | null = null;
    try {
      novo = await renovar();
    } catch {
      // Erro de rede durante o refresh: status é incerto, mantém login
      return desconhecido;
    }

    if (!novo) {
      await sair();
      throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.');
    }

    // Retentativa preservando o MESMO corpo e operationId
    try {
      r = await f(url(caminho), await comToken(novo, {
        method: 'POST',
        headers: JSON_H,
        body: JSON.stringify(corpo),
      }));
    } catch {
      return desconhecido;
    }

    if (r.status === 401) {
      await sair();
      throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.');
    }
  }

  if (r.status >= 500) return desconhecido;
  if (!r.ok) throw await lerErro(r);
  return r.json() as Promise<ResultadoOperacao>;
}
```

---

### 5.4 Componente 4: Geração e Armazenamento de UUID (`cofre.ts`)

#### Função de Geração de UUID v4 com Fallback (RFC 4122)
```ts
export function gerarUuidV4(): string {
  // 1. API nativa padrão (Hermes / Node moderno)
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // 2. Fallback via getRandomValues
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variante 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  // 3. Fallback pseudorrandômico para plataformas legadas
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

#### Persistência e Memoização em `cofre.ts`
```ts
const CHAVE_DEVICE_ID = 'kartodromo.operacional.deviceId';
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let deviceIdEmMemoria: string | null = null;
let promessaDeviceId: Promise<string> | null = null;

export async function obterOuCriarDeviceId(store = SecureStore): Promise<string> {
  if (deviceIdEmMemoria) return deviceIdEmMemoria;
  promessaDeviceId ??= (async () => {
    try {
      const salvo = await store.getItemAsync(CHAVE_DEVICE_ID);
      if (salvo && UUID_V4_REGEX.test(salvo)) {
        deviceIdEmMemoria = salvo;
        return salvo;
      }
      const novo = gerarUuidV4();
      await store.setItemAsync(CHAVE_DEVICE_ID, novo);
      deviceIdEmMemoria = novo;
      return novo;
    } catch {
      // Se SecureStore falhar, gera um temporário estável na sessão
      const temp = gerarUuidV4();
      deviceIdEmMemoria = temp;
      return temp;
    } finally {
      promessaDeviceId = null;
    }
  })();
  return promessaDeviceId;
}
```

---

## 6. Asserções de Teste Verificáveis para a Suíte Jest

As asserções abaixo devem ser implementadas e executadas pelos Workers para validação formal de M1:

### 6.1 Asserções para `tests/tempo-real.test.ts` (W3C SSE & Timeout)
```ts
describe('leitor W3C SSE estrito', () => {
  it('concatena payloads multilinha com prefixo data:', () => {
    const l = new LeitorEventos();
    const bloco = 'event: state\ndata: {"seq":1,\ndata: "sessoes":[{"id":"b1"}]}\n\n';
    const eventos = l.adicionar(bloco);
    expect(eventos).toEqual([
      { tipo: 'state', dados: { seq: 1, sessoes: [{ id: 'b1' }] } },
    ]);
  });

  it('ignora comentários iniciados com dois-pontos sem gerar erro', () => {
    const l = new LeitorEventos();
    const bloco = ': batida keepalive\n\nevent: state\n: comentario interno\ndata: {"seq":2,"sessoes":[]}\n\n';
    const eventos = l.adicionar(bloco);
    expect(eventos).toEqual([
      { tipo: 'state', dados: { seq: 2, sessoes: [] } },
    ]);
  });

  it('reconhece eventos de ping e heartbeat sem derrubar conexão', () => {
    const l = new LeitorEventos();
    const eventos = l.adicionar('event: ping\ndata: {}\n\nevent: heartbeat\ndata: {"ts":123}\n\n');
    expect(eventos).toHaveLength(2);
    expect(eventos[0].tipo).toBe('ping');
    expect(eventos[1].tipo).toBe('heartbeat');
  });

  it('aciona timeout de 5s caso handshake inicial de conexão trave', async () => {
    jest.useFakeTimers();
    let abortado = false;
    const fetchPreso = jest.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          abortado = true;
          reject(new Error('abort'));
        });
      });
    });
    const avisos = { aoConectar: jest.fn(), aoDesconectar: jest.fn(), aoEvento: jest.fn(), aoSairDoLogin: jest.fn() };
    const clienteMock = { tokenAtual: async () => ({ accessToken: 't1' }), renovar: jest.fn(), sair: jest.fn() };
    
    conectarFluxo('http://192.168.1.100:4050', fetchPreso as never, clienteMock as never, avisos);
    
    await jest.advanceTimersByTimeAsync(4_900);
    expect(abortado).toBe(false);
    await jest.advanceTimersByTimeAsync(200);
    expect(abortado).toBe(true);
    expect(avisos.aoDesconectar).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
```

### 6.2 Asserções para `tests/cliente.test.ts` (RFC 1918, 401 Retry & UUID)
```ts
describe('baseSegura RFC 1918', () => {
  it('aceita classes privadas A, B e C em modo release', () => {
    expect(baseSegura('http://10.0.0.1:4050', false)).toBe(true);
    expect(baseSegura('http://172.16.0.1:4050', false)).toBe(true);
    expect(baseSegura('http://172.31.255.254:4050', false)).toBe(true);
    expect(baseSegura('http://192.168.1.50:4050', false)).toBe(true);
  });

  it('rejeita IPs públicos, IPs maliciosos e subdomínios forjados em modo release', () => {
    expect(baseSegura('http://172.15.0.1:4050', false)).toBe(false);
    expect(baseSegura('http://172.32.0.1:4050', false)).toBe(false);
    expect(baseSegura('http://200.1.2.3:4050', false)).toBe(false);
    expect(baseSegura('http://192.168.1.1.evil.com:4050', false)).toBe(false);
    expect(baseSegura('http://192.168.1.1@evil.com:4050', false)).toBe(false);
    expect(baseSegura('http://192.168.1.300:4050', false)).toBe(false);
  });
});

describe('renovação 401 idempotente', () => {
  it('postar renova token em 401 e retenta com sucesso', async () => {
    let chamada = 0;
    const f = jest.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return resposta(200, { accessToken: 'novo-a', refreshToken: 'novo-r' });
      chamada++;
      return (init.headers as Record<string, string>).authorization === 'Bearer novo-a'
        ? resposta(200, { sucesso: true })
        : resposta(401);
    });
    const c = criarCliente({ base: 'https://x', fetch: f as never, cofre: cofre(T), aoSair: jest.fn() });
    const r = await c.postar('/teste', { x: 1 });
    expect(r).toEqual({ sucesso: true });
    expect(chamada).toBe(2);
  });

  it('enviarOperacao renova token em 401 preservando rigorosamente o operationId', async () => {
    let chamada = 0;
    let operationIdRecebido = '';
    const f = jest.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return resposta(200, { accessToken: 'novo-a', refreshToken: 'novo-r' });
      chamada++;
      const corpo = JSON.parse(init.body as string);
      operationIdRecebido = corpo.operationId;
      return (init.headers as Record<string, string>).authorization === 'Bearer novo-a'
        ? resposta(200, { operationId: corpo.operationId, status: 'APPLIED' })
        : resposta(401);
    });
    const c = criarCliente({ base: 'https://x', fetch: f as never, cofre: cofre(T), aoSair: jest.fn() });
    const res = await c.enviarOperacao('/op', { operationId: 'meu-op-id-999', valor: 42 });
    expect(res).toEqual({ operationId: 'meu-op-id-999', status: 'APPLIED' });
    expect(operationIdRecebido).toBe('meu-op-id-999');
    expect(chamada).toBe(2);
  });
});

describe('geração e persistência de UUID de dispositivo', () => {
  it('gera UUID v4 canônico válido e persiste no SecureStore', async () => {
    const mapa = new Map<string, string>();
    const fakeStore = {
      getItemAsync: async (k: string) => mapa.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => { mapa.set(k, v); },
    };
    const id1 = await obterOuCriarDeviceId(fakeStore as never);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const id2 = await obterOuCriarDeviceId(fakeStore as never);
    expect(id2).toBe(id1);
  });

  it('gera UUID v4 mesmo sem crypto nativo (fallback)', () => {
    const originalCrypto = globalThis.crypto;
    try {
      // @ts-expect-error simulando ambiente sem crypto
      delete globalThis.crypto;
      const uuid = gerarUuidV4();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });
});
```

---

## 7. Caveats (Ressalvas e Limitações)

1. **Perfil Read-Only deste Agente**:
   - Este relatório é exclusivamente uma especificação técnica formal e comportamental minerada das fontes autoritativas e do código-fonte. Nenhuma alteração nos arquivos de produção ou teste de `/Users/pedroguilherme/PROJETOS/kartodromo-operacional` foi realizada por este agente.
2. **Dependência de URL WHATWG**:
   - A implementação proposta de `baseSegura` faz uso do construtor padrão `new URL()`, que é suportado nativamente pelo motor Hermes do React Native e pelo Node.js. Caso alguma suíte de teste em Node execute com versão anterior sem suporte a URL global, o fallback de regex estrita documentado na Seção 5.2 atende perfeitamente aos requisitos de segurança.
3. **Escopo de Demais Falhas de M1**:
   - Este agente focou nos 4 tópicos do despacho (W3C SSE, RFC 1918, 401 retry com idempotência e UUID SecureStore). Os tópicos administrativos (RBAC `GERENCIA`, anti auto-bloqueio, confirmação de senha, filtros de histórico e timezone) são cobertos pelos agentes de especificação correspondentes e pelo survey `explorer_survey_app_arch_1`.

---

## 8. Conclusion (Conclusão)

Os quatro tópicos de arquitetura e conexão foram plenamente minerados e detalhados. A causa raiz de cada falha técnica está identificada e mapeada diretamente para o código existente:
1. **W3C SSE**: Truncamento por regex de linha única e reconexão espúria por falta de tratamento de `ping`/`heartbeat` corrigidos com parser de acumulação de linhas e whitelist de keep-alive.
2. **RFC 1918 & Fallback**: IPs locais liberados com validação por faixa e crash top-level substituído por tela de fallback segura no Provedor React.
3. **401 Retry & Idempotência**: Renovação de token estendida a `postar` e `enviarOperacao`, garantindo integridade transacional pela preservação estrita do `operationId`.
4. **UUID de Dispositivo**: Geração resiliente em 3 níveis (nativo, getRandomValues, pseudorrandômico) e persistência via `expo-secure-store`.

---

## 9. Verification Method (Método de Verificação Independente)

Para o agente orquestrador ou worker validar a conformidade da especificação contra a suíte de testes:

1. **Localização dos Testes a Integrar**:
   - `tests/tempo-real.test.ts`: Integrar casos de teste da Seção 6.1.
   - `tests/cliente.test.ts`: Integrar casos de teste da Seção 6.2.
2. **Comando de Teste**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
3. **Comando de Verificação de Tipos**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
4. **Condição de Invalidação**:
   - Se qualquer IP público (ex.: `200.1.2.3` ou `172.15.0.1`) retornar `true` em `baseSegura(..., false)`.
   - Se `enviarOperacao` gerar um novo `operationId` ao retentar após renovação 401.
   - Se um evento `event: ping\ndata: {}\n\n` resultar na chamada de `aoDesconectar()`.
   - Se `obterOuCriarDeviceId()` gerar valores diferentes em duas leituras consecutivas no mesmo ambiente.

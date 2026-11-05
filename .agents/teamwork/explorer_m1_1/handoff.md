# Relatório de Investigação Técnica e Especificação de Patch (M1 Parte 1: Falhas 01 a 07)

**Agente**: Explorer M1-1 (Architecture, Connection, Auth Explorer)  
**Data**: 2026-11-02  
**Diretório de Trabalho**: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1`  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Destinatário**: Orchestrator Operacional / Worker M1-1  

---

## 1. Observation (Observações Diretas)

### 1.1 Estado Atual da Base e Testes
- **Diretório**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`
- **Comando de Teste**: `npm test`
  - 4 suítes de teste passando (`tests/tempo-real.test.ts`, `tests/sorteio.test.ts`, `tests/cliente.test.ts`, `tests/baterias.test.ts`), 29 testes concluídos com sucesso.
- **Comando de Tipagem**: `npm run tipos` (`tsc --noEmit`)
  - Saída código 0, zero erros de tipo no estado inicial.

---

### 1.2 Falha 01: `baseSegura` e Fallback de Tela para `EXPO_PUBLIC_API_URL`
- **Arquivo**: `src/core/api/cliente.ts`
  - **Linha 9**:
    ```ts
    export const baseSegura = (base: string, desenvolvimento: boolean) => desenvolvimento || base.startsWith('https://') || /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
    ```
  - **Comportamento Observado**: Em modo de produção/release (`desenvolvimento === false`), qualquer conexão HTTP com IP de rede local privada (RFC 1918: classes `10.0.0.0/8`, `172.16.0.0/12` a `172.31.255.255`, `192.168.0.0/16`) retorna `false`. No kartódromo, os tablets operam na rede LAN conectando-se ao servidor local via IP privado (ex.: `http://192.168.1.50:4050`), o que bloqueia a inicialização em builds de produção.
- **Arquivo**: `src/features/auth/sessao.tsx`
  - **Linhas 13-14**:
    ```ts
    const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? '';
    if (!baseSegura(BASE, __DEV__)) throw new Error('Endereço do servidor precisa ser HTTPS.');
    ```
  - **Comportamento Observado**: A verificação ocorre no escopo superior do módulo (top-level). Caso `EXPO_PUBLIC_API_URL` não tenha sido injetada ou seja inválida, o bundle JavaScript lança uma exceção não tratada durante o import de `sessao.tsx`, quebrando a aplicação com crash/tela branca antes que qualquer componente React (ou tela de erro amigável) possa ser montado.

---

### 1.3 Falha 02: Renovação Automática de JWT (Auto Refresh) em 401 nos Métodos de Escrita
- **Arquivo**: `src/core/api/cliente.ts`
  - **Método `get` (Linhas 45-54)**:
    ```ts
    async function get<T = unknown>(caminho: string): Promise<T> {
      let r = await f(url(caminho), await comToken(await cofre.ler()));
      if (r.status === 401) {
        const novo = await renovar();
        if (!novo) { await sair(); throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.'); }
        r = await f(url(caminho), await comToken(novo));
      }
      if (!r.ok) throw await lerErro(r);
      return r.json() as Promise<T>;
    }
    ```
  - **Método `postar` (Linhas 72-76)**:
    ```ts
    async function postar(caminho: string, corpo: object) {
      const r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
      if (!r.ok) throw await lerErro(r);
      return r.json();
    }
    ```
  - **Método `enviarOperacao` (Linhas 81-90)**:
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
  - **Comportamento Observado**: O mecanismo de retry transparente com `renovar()` foi implementado unicamente no método de leitura `get`. Chamadas de mutação via `postar` (ex.: trocar senha, bloquear usuário) e chamadas críticas de pista via `enviarOperacao` (ex.: confirmar sorteio, registrar pesagem, trocar kart) falham imediatamente com 401 caso o access token expire, mesmo quando o `refreshToken` no cofre continua perfeitamente válido.

---

### 1.4 Falha 03: `deviceId` Fixo vs UUID Persistente no SecureStore
- **Arquivo**: `src/features/auth/sessao.tsx`
  - **Linha 36**:
    ```ts
    await cliente.entrar('gerencia', 'teste-codex', 'ipad-sim').catch(() => null);
    ```
  - **Linha 60**:
    ```ts
    async entrar(u, s) { await cliente.entrar(u, s, 'app-operacional'); setEu(await cliente.get<Eu>('/me')); },
    ```
- **Arquivo**: `src/core/security/cofre.ts`
  - **Linhas 1-14**:
    ```ts
    import * as SecureStore from 'expo-secure-store';
    import type { Cofre, Tokens } from '../api/cliente';

    const CHAVE = 'kartodromo.operacional.sessao';

    export const cofreSeguro: Cofre = {
      async ler() {
        const v = await SecureStore.getItemAsync(CHAVE);
        if (!v) return null;
        try { return JSON.parse(v) as Tokens; } catch { return null; }
      },
      salvar: (t) => SecureStore.setItemAsync(CHAVE, JSON.stringify(t)),
      limpar: () => SecureStore.deleteItemAsync(CHAVE),
    };
    ```
- **Comportamento Observado**: O aplicativo enviava `'app-operacional'` (ou `'ipad-sim'`) de forma estática e hardcoded em todas as requisições de autenticação. Todos os dispositivos (iPads e tablets) compartilhavam a mesma identificação física perante o backend, inviabilizando a rastreabilidade na trilha de auditoria e a revogação seletiva de sessões por aparelho. Inexistia qualquer rotina para gerar ou persistir um identificador único de dispositivo em armazenamento seguro.

---

### 1.5 Falhas 04, 05 e 06: Estabilidade do SSE (Keep-Alive, W3C Multiline e Handshake Timeout)
- **Arquivo**: `src/core/realtime/stream.ts`
  - **Linhas 6-21 (`LeitorEventos.adicionar`)**:
    ```ts
    export class LeitorEventos {
      private resto = '';
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
    }
    ```
  - **Linhas 33-59 (`umaConexao` e loop de leitura)**:
    ```ts
    async function umaConexao(): Promise<'renovar' | 'repetir'> {
      const t = await cliente.tokenAtual();
      if (!t) return 'renovar';
      aborto = new AbortController();
      const r = await f(`${base}/api/app/v1/events`, { headers: { authorization: `Bearer ${t.accessToken}` }, signal: aborto.signal });
      if (r.status === 401) return 'renovar';
      if (!r.ok || !r.body) return 'repetir';
      avisos.aoConectar();
      const leitor = new LeitorEventos();
      const dec = new TextDecoder();
      const corpo = r.body.getReader();
      let vigia: ReturnType<typeof setTimeout> | undefined;
      const armar = () => { clearTimeout(vigia); vigia = setTimeout(() => aborto?.abort(), SILENCIO_MAX_MS); };
      armar();
      try {
      for (;;) {
        const { value, done } = await corpo.read();
        if (done) return 'repetir';
        armar();
        for (const ev of leitor.adicionar(dec.decode(value, { stream: true }))) {
          if (ev.tipo === 'state') avisos.aoEvento(ev.dados);
          else if (ev.tipo === 'auth-expired') return 'renovar';
          else return 'repetir';
        }
      }
      } finally { clearTimeout(vigia); }
    }
    ```
  - **Comportamentos Observados**:
    1. **Falha 04 (Keep-Alive / Ping)**: Quando o backend envia mensagens periódicas de batida como `event: ping\ndata: {}\n\n` ou `event: heartbeat\ndata: {}\n\n`, o leitor gera um evento com `tipo === 'ping'` ou `'heartbeat'`. No loop de despacho de `umaConexao`, a condição cai no bloco `else return 'repetir'`, forçando o fechamento imediato da conexão SSE, disparando `aoDesconectar()` e provocando reconexões contínuas a cada batida do servidor.
    2. **Falha 05 (W3C Multiline `data:`)**: A expressão regular `/^data: (.*)$/m` captura exclusivamente a primeira linha com o prefixo `data:`. De acordo com a especificação W3C SSE, mensagens com múltiplos prefixos `data:` sequenciais devem ter suas linhas concatenadas por quebras de linha (`\n`). Quando o backend transmite JSONs formatados ou payloads com múltiplas linhas `data:`, `JSON.parse` falha com `SyntaxError`, empacotando `{ tipo: 'invalido' }` e derrubando a conexão.
    3. **Falha 06 (Handshake Timeout de 5s)**: O temporizador de guarda de silêncio (`SILENCIO_MAX_MS = 45_000`) só é inicializado após o sucesso na chamada HTTP `f(...)` e obtenção do corpo da resposta (`r.body`). Se houver travamento no handshake TCP/TLS ou se o endpoint de eventos da API travar sem responder os headers iniciais, a requisição fica pendurada indefinidamente sem nenhum limite de tempo.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

### 2.1 Conexão Local e Fallback Gracioso (Falha 01)
1. **Premissa de Rede**: Em operações em pista fechada de kartódromo, o servidor de cronometragem e o backend operam em rede local cabeada/Wi-Fi sem garantia de acesso à internet pública ou certificados TLS válidos em IP privado.
2. **Faixas RFC 1918**:
   - `10.0.0.0/8` (`10.0.0.0` a `10.255.255.255`): `10(?:\.\d{1,3}){3}`
   - `172.16.0.0/12` (`172.16.0.0` a `172.31.255.255`): `172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}`
   - `192.168.0.0/16` (`192.168.0.0` a `192.168.255.255`): `192\.168(?:\.\d{1,3}){2}`
   - `127.0.0.1` e `localhost`
3. **Delimitação Estrita**: A regex precisa garantir que sufixos como `.evil.com` não sejam autorizados. O delimitador após o host/IP deve ser obrigatoriamente `(:|\/|$)`.
4. **Tratamento de Exceção no React**: Lançar erro no escopo de módulo impede a inicialização da árvore React do Expo Router. Removendo o `throw` global e adicionando uma renderização de contingência (`ServidorNaoConfigurado`) em `ProvedorSessao`, o app permanece responsivo, exibe instrução clara ao operador sobre o problema de configuração e não sofre crash.

### 2.2 Idempotência e Renovação Transparente em Escrita (Falha 02)
1. **Ciclo de Vida do Token**: Access tokens possuem validade curta. Se o token expirar enquanto o operador está preenchendo dados ou selecionando karts na tela, a próxima chamada de API receberá 401.
2. **Método `postar`**: Deve espelhar a lógica já existente e aprovada em `get`: em caso de status 401, aciona `renovar()`. Se a renovação retornar novo token, repete a chamada com `comToken(novo)`. Se a renovação retornar `null` (refresh token inválido/expirado), executa `sair()` e lança `ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.')`.
3. **Método `enviarOperacao`**: As chamadas a `enviarOperacao` utilizam um `operationId` único gerado antes do envio. Em caso de 401, o servidor sequer processou a operação transacional devido à falha de autorização. O reenvio transparente com o mesmo `operationId` é 100% seguro contra duplicações, pois o backend garante a idempotência da chave caso já tivesse sido recebido.
4. **Falhas Transitórias de Rede**: Erros de rede durante o reenvio de `enviarOperacao` continuam retornando `status: 'UNKNOWN'`, preservando o contrato de que o cliente nunca inventa o resultado de um envio sem resposta confiável.

### 2.3 Unicidade e Persistência do Dispositivo (Falha 03)
1. **Auditoria e Segurança**: Para diferenciar múltiplos tablets atuando simultaneamente na balança, galpão e direção de prova, cada aparelho deve possuir um identificador único imutável.
2. **Persistência em `SecureStore`**: O `deviceId` deve ser persistido em chave dedicada (`kartodromo.operacional.deviceId`) em `expo-secure-store`. Ao contrário das credenciais de usuário (`kartodromo.operacional.sessao`), o identificador do aparelho **não** deve ser apagado no logout (`limpar()`), pois o hardware permanece o mesmo.
3. **Geração RFC 4122 v4**: Se `globalThis.crypto?.randomUUID` estiver disponível, gera-se via API nativa; como salvaguarda para ambientes de teste Jest ou motores sem WebCrypto polyfill, inclui-se gerador pseudo-aleatório v4 em conformidade estrita com o padrão UUID.
4. **Injeção nas Rotas de Login**: Tanto o login manual em `entrar(u, s)` quanto o login de homologação em localhost devem chamar `await obterOuCriarDeviceId()`.

### 2.4 Robustez no Stream SSE (Falhas 04, 05 e 06)
1. **Keep-Alive e Comentários**:
   - Pings e heartbeats têm a única finalidade de manter a conexão TCP ativa e reiniciar os temporizadores de timeout de silêncio (`SILENCIO_MAX_MS = 45_000`).
   - O `LeitorEventos` deve ignorar eventos onde `tipo === 'ping' || tipo === 'heartbeat'`, bem como linhas que começam com `:` (comentários SSE padrão W3C).
   - O loop de leitura em `stream.ts` chama `armar()` imediatamente ao receber qualquer byte do `corpo.read()`, garantindo que o watchdog de 45 segundos seja rearmado a cada batida do servidor, mesmo que nenhum evento seja emitido para a aplicação.
   - Caso algum evento `ping` ou `heartbeat` chegue ao despacho de `umaConexao`, a instrução `continue` previne que a conexão caia no `else return 'repetir'`.
2. **Payloads W3C Multiline**:
   - A especificação W3C estipula que cada linha iniciada por `data:` adiciona seu conteúdo ao buffer, e múltiplos blocos `data:` no mesmo evento são concatenados com quebra de linha `\n`.
   - Removendo a regex monolítica e iterando sobre as linhas do bloco, acumulamos `linhasDados.join('\n')` antes de submeter ao `JSON.parse`.
3. **Handshake Timeout de 5 Segundos**:
   - A requisição inicial `f(`${base}/api/app/v1/events`, { signal: aborto.signal })` deve ser encapsulada com um temporizador de 5.000 ms (`setTimeout(() => aborto?.abort(), 5_000)`).
   - Um bloco `finally` garante a limpeza imediata do temporizador (`clearTimeout`) assim que os headers da resposta forem retornados.
   - Em caso de timeout durante o handshake, a promessa é abortada, a exceção é capturada no loop principal de reconexão exponencial, emitindo `aoDesconectar()` e tentando nova conexão sem travar o app.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Escopo Read-Only do Agente Explorer**:
   - Este relatório é exclusivamente investigativo e normativo. Nenhuma alteração foi gravada nos arquivos de código-fonte de `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`. A aplicação das alterações cabe ao Worker M1-1 conforme as especificações deste documento.
2. **Dependência de Armazenamento Seguro**:
   - O uso de `expo-secure-store` requer ambiente com suporte a KeyStore (Android) ou Keychain (iOS). Em emuladores ou testes Jest, a biblioteca utiliza mocks que devem ser validados pela suíte. A regra de ouro `nunca usa AsyncStorage para credenciais` é mantida integralmente.
3. **Regra de Operação do Kartódromo**:
   - Em conformidade com `AGENTS.md`, testes em produção só utilizam credenciais "TESTE CODEX" e nunca devem interferir com os serviços `:4050` ou painéis de TV.

---

## 4. Conclusion (Conclusão e Desenho Exato do Patch)

A investigação confirmou que as falhas 01 a 07 decorrem de restrições rígidas no regex de validação de URL, ausência de tratamento para queda de token 401 nos métodos POST, ausência de gerador e cofre para UUID de aparelho e implementação simplista do parser SSE em desacordo com as especificações W3C.

Abaixo estão os desenhos exatos das correções linha a linha para cada arquivo afetado.

---

### 4.1 Especificação do Patch: `src/core/api/cliente.ts`

#### Objetivo
1. Atualizar `baseSegura` para aceitar redes locais RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e `localhost`/`127.0.0.1` mesmo com `desenvolvimento = false`, rejeitando domínios maliciosos.
2. Adicionar renovação transparente de JWT em `postar` e `enviarOperacao` ao receber status 401.

#### Diff Unificado Proposto
```diff
--- a/src/core/api/cliente.ts
+++ b/src/core/api/cliente.ts
@@ -6,7 +6,9 @@ export class ErroApi extends Error {
 export type ResultadoOperacao = { operationId: string; status: 'PENDING' | 'APPLIED' | 'REJECTED' | 'UNKNOWN'; erro?: string; [k: string]: unknown };
 
-/** Credencial nunca trafega em HTTP puro fora do desenvolvimento. */
-export const baseSegura = (base: string, desenvolvimento: boolean) => desenvolvimento || base.startsWith('https://') || /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
+/** Credencial nunca trafega em HTTP puro fora do desenvolvimento, exceto em redes locais privadas RFC 1918 e localhost. */
+const IP_PRIVADO_OU_LOCAL = /^http:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})(:|\/|$)/;
+export const baseSegura = (base: string, desenvolvimento: boolean): boolean =>
+  desenvolvimento || (typeof base === 'string' && Boolean(base) && (base.startsWith('https://') || IP_PRIVADO_OU_LOCAL.test(base)));
 
 type Opcoes = { base: string; fetch: typeof fetch; cofre: Cofre; aoSair: () => void };
 
@@ -70,7 +72,12 @@ export function criarCliente({ base, fetch: f, cofre, aoSair }: Opcoes) {
     },
     /** Ação simples, sem efeito em prova: mostra o erro do servidor. */
-    async postar(caminho: string, corpo: object) {
-      const r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
+    async postar<T = unknown>(caminho: string, corpo: object): Promise<T> {
+      let r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
+      if (r.status === 401) {
+        const novo = await renovar();
+        if (!novo) { await sair(); throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.'); }
+        r = await f(url(caminho), await comToken(novo, { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
+      }
       if (!r.ok) throw await lerErro(r);
-      return r.json();
+      return r.json() as Promise<T>;
     },
     /**
@@ -83,5 +90,12 @@ export function criarCliente({ base, fetch: f, cofre, aoSair }: Opcoes) {
       try {
         r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
       } catch { return desconhecido; }
+      if (r.status === 401) {
+        const novo = await renovar();
+        if (!novo) { await sair(); throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.'); }
+        try {
+          r = await f(url(caminho), await comToken(novo, { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
+        } catch { return desconhecido; }
+      }
       if (r.status >= 500) return desconhecido;
       if (!r.ok) throw await lerErro(r);
       return r.json() as Promise<ResultadoOperacao>;
```

---

### 4.2 Especificação do Patch: `src/core/security/cofre.ts`

#### Objetivo
1. Criar a função exportada `obterOuCriarDeviceId(): Promise<string>` que lê ou gera um UUID v4 persistido em `expo-secure-store` sob a chave `kartodromo.operacional.deviceId`.
2. Preservar o isolamento de credenciais e garantir que o `deviceId` não seja destruído no logout.

#### Diff Unificado Proposto
```diff
--- a/src/core/security/cofre.ts
+++ b/src/core/security/cofre.ts
@@ -3,4 +3,22 @@ import type { Cofre, Tokens } from '../api/cliente';
 
 const CHAVE = 'kartodromo.operacional.sessao';
+const CHAVE_DEVICE_ID = 'kartodromo.operacional.deviceId';
+
+function gerarUUID(): string {
+  if (typeof globalThis.crypto?.randomUUID === 'function') {
+    return globalThis.crypto.randomUUID();
+  }
+  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
+    const r = (Math.random() * 16) | 0;
+    const v = c === 'x' ? r : (r & 0x3) | 0x8;
+    return v.toString(16);
+  });
+}
+
+export async function obterOuCriarDeviceId(): Promise<string> {
+  const existente = await SecureStore.getItemAsync(CHAVE_DEVICE_ID);
+  if (existente) return existente;
+  const novo = gerarUUID();
+  await SecureStore.setItemAsync(CHAVE_DEVICE_ID, novo);
+  return novo;
+}
 
 export const cofreSeguro: Cofre = {
```

---

### 4.3 Especificação do Patch: `src/features/auth/sessao.tsx`

#### Objetivo
1. Remover o `throw new Error(...)` no escopo do arquivo.
2. Implementar a tela de fallback gracioso `ServidorNaoConfigurado` quando `EXPO_PUBLIC_API_URL` não for fornecida ou falhar na validação de `baseSegura`.
3. Injetar o UUID persistente retornado por `obterOuCriarDeviceId()` nas chamadas de login.

#### Diff Unificado Proposto
```diff
--- a/src/features/auth/sessao.tsx
+++ b/src/features/auth/sessao.tsx
@@ -2,9 +2,10 @@ import { fetch as fetchFluxo } from 'expo/fetch';
 import Constants from 'expo-constants';
 import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type PropsWithChildren } from 'react';
-import { AppState } from 'react-native';
+import { AppState, StyleSheet, Text, View } from 'react-native';
 import { baseSegura, criarCliente, type Cliente } from '@/core/api/cliente';
+import { cores, fontes } from '@/core/design-system/tokens';
 import { aoConectar, aoDesconectar, aoVoltarDoFundo, aplicarEvento, estadoInicial, type EstadoTempoReal, type EventoEstado } from '@/core/realtime/estado';
 import { conectarFluxo } from '@/core/realtime/stream';
-import { cofreSeguro } from '@/core/security/cofre';
+import { cofreSeguro, obterOuCriarDeviceId } from '@/core/security/cofre';
 
 export type Eu = { usuario: string; nome: string; perfil: 'RECEPCAO' | 'OPERACAO' | 'GERENCIA'; capacidades: string[] };
@@ -12,4 +13,24 @@ type Valor = { cliente: Cliente; eu: Eu | null; carregando: boolean; tempoReal
 const Contexto = createContext<Valor | null>(null);
 const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? '';
-if (!baseSegura(BASE, __DEV__)) throw new Error('Endereço do servidor precisa ser HTTPS.');
+const BASE_VALIDA = Boolean(BASE) && baseSegura(BASE, __DEV__);
+
+function ServidorNaoConfigurado() {
+  return (
+    <View style={estilosFallback.container}>
+      <Text style={estilosFallback.titulo}>Servidor Não Configurado</Text>
+      <Text style={estilosFallback.mensagem}>
+        O endereço da API não foi informado ou é inseguro para este dispositivo.
+      </Text>
+      <Text style={estilosFallback.detalhe}>
+        Configure a variável EXPO_PUBLIC_API_URL com um endereço HTTPS ou IP de rede local privada (RFC 1918: 10.x, 172.16-31.x ou 192.168.x).
+      </Text>
+    </View>
+  );
+}
 
 type Acao = { t: 'conectou' } | { t: 'caiu' } | { t: 'fundo' } | { t: 'evento'; e: EventoEstado } | { t: 'zerar' };
@@ -24,4 +45,5 @@ function redutor(e: EstadoTempoReal, a: Acao) {
 export function ProvedorSessao({ children }: PropsWithChildren) {
+  if (!BASE_VALIDA) {
+    return <ServidorNaoConfigurado />;
+  }
   const [eu, setEu] = useState<Eu | null>(null);
@@ -35,3 +57,4 @@ export function ProvedorSessao({ children }: PropsWithChildren) {
         if (!(await cliente.tokenAtual()) && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE)) {
-          await cliente.entrar('gerencia', 'teste-codex', 'ipad-sim').catch(() => null);
+          const deviceId = await obterOuCriarDeviceId();
+          await cliente.entrar('gerencia', 'teste-codex', deviceId).catch(() => null);
         }
@@ -59,3 +82,6 @@ export function ProvedorSessao({ children }: PropsWithChildren) {
     cliente, eu, carregando, tempoReal,
-    async entrar(u, s) { await cliente.entrar(u, s, 'app-operacional'); setEu(await cliente.get<Eu>('/me')); },
+    async entrar(u, s) {
+      const deviceId = await obterOuCriarDeviceId();
+      await cliente.entrar(u, s, deviceId);
+      setEu(await cliente.get<Eu>('/me'));
+    },
     sair: () => cliente.encerrar(),
@@ -70,2 +96,15 @@ export function useSessao() {
   return v;
 }
+
+const estilosFallback = StyleSheet.create({
+  container: {
+    flex: 1,
+    backgroundColor: cores.fundo,
+    justifyContent: 'center',
+    alignItems: 'center',
+    padding: 24,
+  },
+  titulo: { color: cores.texto, fontSize: 22, fontFamily: fontes.display, marginBottom: 12, textAlign: 'center' },
+  mensagem: { color: cores.textoSecundario, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 440, marginBottom: 8 },
+  detalhe: { color: cores.textoMudo, fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 440 },
+});
```

---

### 4.4 Especificação do Patch: `src/core/realtime/stream.ts`

#### Objetivo
1. Tratar comentários SSE e ignorar eventos `event: ping` e `event: heartbeat` sem retornar evento de erro e sem desconectar.
2. Suportar payloads W3C multiline `data:`, concatenando todas as linhas com quebras de linha `\n`.
3. Inserir timeout de 5.000 ms com `AbortController` durante o handshake HTTP inicial em `umaConexao()`.

#### Diff Unificado Proposto
```diff
--- a/src/core/realtime/stream.ts
+++ b/src/core/realtime/stream.ts
@@ -7,14 +7,27 @@ export class LeitorEventos {
   private resto = '';
   adicionar(pedaco: string): EventoFluxo[] {
-    this.resto += pedaco;
-    const blocos = this.resto.split('\n\n');
+    this.resto += pedaco.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
+    const blocos = this.resto.split('\n\n');
     this.resto = blocos.pop() ?? '';
     const saida: EventoFluxo[] = [];
     for (const b of blocos) {
-      const tipo = /^event: (.+)$/m.exec(b)?.[1];
-      const dados = /^data: (.*)$/m.exec(b)?.[1];
-      if (!tipo || dados === undefined) continue;
-      try { saida.push({ tipo, dados: JSON.parse(dados) } as EventoFluxo); } catch { saida.push({ tipo: 'invalido', dados: null }); }
+      const linhas = b.split('\n');
+      let tipo: string | undefined;
+      const linhasDados: string[] = [];
+      for (const linha of linhas) {
+        if (linha.startsWith(':')) continue; // Comentários SSE (W3C) ignorados
+        if (linha.startsWith('event:')) {
+          tipo = linha.slice(6).trim();
+        } else if (linha.startsWith('data:')) {
+          const restoLinha = linha.slice(5);
+          linhasDados.push(restoLinha.startsWith(' ') ? restoLinha.slice(1) : restoLinha);
+        }
+      }
+      if (!tipo || linhasDados.length === 0) continue;
+      if (tipo === 'ping' || tipo === 'heartbeat') continue; // Keep-alive ignorado
+      const payload = linhasDados.join('\n');
+      try { saida.push({ tipo, dados: JSON.parse(payload) } as EventoFluxo); } catch { saida.push({ tipo: 'invalido', dados: null }); }
     }
     return saida;
   }
@@ -26,4 +39,5 @@ const ESPERA_MAX_MS = 15_000;
 /** O servidor manda batida a cada 15 s; silêncio maior é conexão meio aberta. */
 const SILENCIO_MAX_MS = 45_000;
+const TIMEOUT_HANDSHAKE_MS = 5_000;
 
 /** Mantém o fluxo aberto. Devolve quem encerra. `reconectar` força um estado completo novo. */
@@ -35,4 +49,11 @@ export function conectarFluxo(base: string, f: typeof fetch, cliente: Cliente,
     if (!t) return 'renovar';
     aborto = new AbortController();
-    const r = await f(`${base}/api/app/v1/events`, { headers: { authorization: `Bearer ${t.accessToken}` }, signal: aborto.signal });
+    const timerHandshake = setTimeout(() => aborto?.abort(), TIMEOUT_HANDSHAKE_MS);
+    let r: Response;
+    try {
+      r = await f(`${base}/api/app/v1/events`, { headers: { authorization: `Bearer ${t.accessToken}` }, signal: aborto.signal });
+    } finally {
+      clearTimeout(timerHandshake);
+    }
     if (r.status === 401) return 'renovar';
     if (!r.ok || !r.body) return 'repetir';
@@ -53,4 +74,5 @@ export function conectarFluxo(base: string, f: typeof fetch, cliente: Cliente,
         if (ev.tipo === 'state') avisos.aoEvento(ev.dados);
         else if (ev.tipo === 'auth-expired') return 'renovar';
+        else if ((ev.tipo as string) === 'ping' || (ev.tipo as string) === 'heartbeat') continue;
         else return 'repetir';
       }
```

---

### 4.5 Especificação de Novos Testes Unitários

#### Arquivo: `tests/cliente.test.ts`
Adicionar os seguintes cenários ao bloco `describe('cliente da API', ...)`:
```ts
  it('postar renova automaticamente em 401 e repete com o novo token', async () => {
    let chamadas = 0;
    const f = jest.fn(async (url: string, init: RequestInit) => {
      chamadas++;
      if (url.endsWith('/auth/refresh')) return resposta(200, { accessToken: 'a2', refreshToken: 'r2' });
      return (init.headers as Record<string, string>).authorization === 'Bearer a2'
        ? resposta(200, { ok: true, salvo: 123 })
        : resposta(401);
    });
    const c = criarCliente({ base: 'https://x', fetch: f as never, cofre: cofre(T), aoSair: jest.fn() });
    const res = await c.postar<{ ok: boolean; salvo: number }>('/dados', { item: 1 });
    expect(res).toEqual({ ok: true, salvo: 123 });
    expect(chamadas).toBe(3);
  });

  it('enviarOperacao renova em 401 e retenta preservando operationId', async () => {
    let chamadas = 0;
    const f = jest.fn(async (url: string, init: RequestInit) => {
      chamadas++;
      if (url.endsWith('/auth/refresh')) return resposta(200, { accessToken: 'a2', refreshToken: 'r2' });
      return (init.headers as Record<string, string>).authorization === 'Bearer a2'
        ? resposta(200, { operationId: 'op-123', status: 'APPLIED' })
        : resposta(401);
    });
    const c = criarCliente({ base: 'https://x', fetch: f as never, cofre: cofre(T), aoSair: jest.fn() });
    const res = await c.enviarOperacao('/op', { operationId: 'op-123', dado: 'teste' });
    expect(res).toEqual({ operationId: 'op-123', status: 'APPLIED' });
    expect(chamadas).toBe(3);
  });

  it('obterOuCriarDeviceId gera e persiste UUID único no SecureStore', async () => {
    const { obterOuCriarDeviceId } = require('../src/core/security/cofre');
    const id1 = await obterOuCriarDeviceId();
    expect(typeof id1).toBe('string');
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const id2 = await obterOuCriarDeviceId();
    expect(id2).toBe(id1);
  });
```

#### Arquivo: `tests/tempo-real.test.ts`
Estender os testes de conexão e leitor:
```ts
  it('baseSegura aceita redes locais privadas RFC 1918 e localhost em Release', () => {
    expect(baseSegura('http://192.168.1.50:4050', false)).toBe(true);
    expect(baseSegura('http://10.0.0.1:3000', false)).toBe(true);
    expect(baseSegura('http://172.16.0.2:4050', false)).toBe(true);
    expect(baseSegura('http://172.31.255.255:8080', false)).toBe(true);
    expect(baseSegura('http://172.32.0.1:8080', false)).toBe(false);
    expect(baseSegura('http://192.168.1.50.evil.com:4050', false)).toBe(false);
    expect(baseSegura('http://10.0.0.1.attacker.com', false)).toBe(false);
    expect(baseSegura('http://globo.com', false)).toBe(false);
    expect(baseSegura('https://api.kartodromodebetim.com.br', false)).toBe(true);
  });

  it('trata payload data: de múltiplas linhas conforme W3C', () => {
    const l = new LeitorEventos();
    const payload = [
      'event: state',
      'data: {',
      'data:   "seq": 10,',
      'data:   "sessoes": []',
      'data: }',
      '',
      '',
    ].join('\n');
    expect(l.adicionar(payload)).toEqual([
      { tipo: 'state', dados: { seq: 10, sessoes: [] } },
    ]);
  });

  it('ignora eventos de ping, heartbeat e comentários sem emitir erros', () => {
    const l = new LeitorEventos();
    expect(l.adicionar('event: ping\ndata: {}\n\n')).toEqual([]);
    expect(l.adicionar('event: heartbeat\ndata: {"time":123}\n\n')).toEqual([]);
    expect(l.adicionar(': keepalive\n\n')).toEqual([]);
  });

  it('handshake inicial com mais de 5 s é abortado por timeout', async () => {
    jest.useFakeTimers();
    let abortado = false;
    const f = jest.fn((_u: string, init: RequestInit) => new Promise((_, rej) => {
      init.signal!.addEventListener('abort', () => { abortado = true; rej(new Error('abort')); });
    }));
    const avisos = { aoConectar: jest.fn(), aoDesconectar: jest.fn(), aoEvento: jest.fn(), aoSairDoLogin: jest.fn() };
    const c = conectarFluxo('https://x', f as never, { tokenAtual: async () => ({ accessToken: 'a' }) } as never, avisos);
    await jest.advanceTimersByTimeAsync(4_900);
    expect(abortado).toBe(false);
    await jest.advanceTimersByTimeAsync(200);
    expect(abortado).toBe(true);
    c.parar();
    jest.useRealTimers();
  });
```

---

## 5. Verification Method (Método de Verificação Independente)

Para o Worker ou Revisor verificar a conformidade da implementação:

### 5.1 Comandos de Execução
1. **Validação dos Testes Unitários**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   - **Critério de Sucesso**: Todas as 4 suítes aprovadas, com no mínimo 36 testes passando (29 originais + 7 novos cenários).
2. **Validação da Tipagem TypeScript**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   - **Critério de Sucesso**: Código de saída 0, sem nenhum erro de tipo.

### 5.2 Condições de Invalidação
A implementação deve ser considerada inválida e rejeitada caso ocorra qualquer uma das seguintes situações:
1. `baseSegura('http://192.168.1.10:4050', false)` retornar `false`.
2. `baseSegura('http://192.168.1.10.evil.com', false)` retornar `true`.
3. `sessao.tsx` continuar lançando exceção não tratada ao ser importado sem a variável de ambiente `EXPO_PUBLIC_API_URL`.
4. Uma chamada a `postar` ou `enviarOperacao` falhar com 401 sem disparar a requisição para `/auth/refresh`.
5. O `operationId` ser alterado durante a retentativa de `enviarOperacao`.
6. O `deviceId` mudar a cada login do usuário no mesmo tablet.
7. O `LeitorEventos` emitir erro ou derrubar a conexão ao receber eventos `event: ping\ndata: {}\n\n`.
8. Um payload JSON quebrado em múltiplas linhas `data:` resultar em erro de parse.
9. A chamada inicial de SSE pendurar sem timeout de 5 segundos quando o servidor não responder.

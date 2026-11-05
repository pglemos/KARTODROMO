# Relatório de Investigação de Arquitetura e Falhas (R1: 01-07 e 39-45)
**Agente**: Explorer 1 (`explorer_survey_app_arch_1`)  
**Data**: 2026-11-02  
**Diretório de Trabalho**: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1`  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`

---

## 1. Observation (Observações Diretas)

### 1.1 Setup de Dependências e Testes
- **`package.json`**:
  - React 19.2.3, React Native 0.86.3, Expo ~57.0.31, Expo Router ~57.0.29.
  - Dependências nativas: `expo-secure-store` (~57.0.4), `expo-constants` (~57.0.21), `react-native-screens` (~4.26.0), `react-native-safe-area-context` (~5.7.0).
  - Scripts: `"test": "jest"`, `"tipos": "tsc --noEmit"`.
  - DevDependencies: `jest` (~29.7.0), `jest-expo` (~57.0.6), `@testing-library/react-native` (^14.1.0), `typescript` (~6.0.3).
- **`jest.config.js`**:
  - `module.exports = { preset: 'jest-expo', testMatch: ['**/tests/**/*.test.ts?(x)'], moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' } };`
- **Execução dos Testes**:
  - Comando: `npm test`
  - Resultado: 4 suítes aprovadas (`tests/tempo-real.test.ts`, `tests/sorteio.test.ts`, `tests/cliente.test.ts`, `tests/baterias.test.ts`), 29 testes passando em 0.251s.
- **Execução do Typecheck**:
  - Comando: `npm run tipos` (`tsc --noEmit`)
  - Resultado: Código 0, sem erros de compilação TypeScript.

---

### 1.2 R1 Falhas 01 a 07 (Arquitetura, Conexão e Autenticação)

#### Falha 01: Validação de `baseSegura` e ausência de fallback para `EXPO_PUBLIC_API_URL`
- **Arquivo**: `src/core/api/cliente.ts` (Linha 9)
  ```ts
  export const baseSegura = (base: string, desenvolvimento: boolean) => desenvolvimento || base.startsWith('https://') || /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
  ```
- **Arquivo**: `src/features/auth/sessao.tsx` (Linhas 13-14)
  ```ts
  const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? '';
  if (!baseSegura(BASE, __DEV__)) throw new Error('Endereço do servidor precisa ser HTTPS.');
  ```
- **Arquivo**: `tests/tempo-real.test.ts` (Linhas 81-86)
  ```ts
  it('fora do desenvolvimento só aceita HTTPS', () => {
    expect(baseSegura('https://a', false)).toBe(true);
    expect(baseSegura('http://a', false)).toBe(false);
    expect(baseSegura('http://127.0.0.1:4799', false)).toBe(true);
    expect(baseSegura('http://127.0.0.1.evil.com', false)).toBe(false);
  });
  ```
- **Constatação**: Em modo Release (`desenvolvimento === false`), qualquer IP local de rede privada (RFC 1918: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`) é rejeitado por `baseSegura`. Além disso, a verificação em `sessao.tsx:14` é disparada no escopo superior do módulo (top-level); se `EXPO_PUBLIC_API_URL` não for injetada, o app lança exceção não tratada no carregamento do bundle JS, travando com tela branca antes de qualquer renderização React.

#### Falha 02: Renovação automática de JWT em 401 nos métodos de escrita
- **Arquivo**: `src/core/api/cliente.ts`
  - Método `get` (Linhas 46-51):
    ```ts
    let r = await f(url(caminho), await comToken(await cofre.ler()));
    if (r.status === 401) {
      const novo = await renovar();
      if (!novo) { await sair(); throw new ErroApi(401, 'UNAUTHENTICATED', 'Entre novamente.'); }
      r = await f(url(caminho), await comToken(novo));
    }
    ```
  - Método `postar` (Linhas 72-76):
    ```ts
    async function postar(caminho: string, corpo: object) {
      const r = await f(url(caminho), await comToken(await cofre.ler(), { method: 'POST', headers: JSON_H, body: JSON.stringify(corpo) }));
      if (!r.ok) throw await lerErro(r);
      return r.json();
    }
    ```
  - Método `enviarOperacao` (Linhas 81-90):
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
- **Constatação**: Somente `get` implementa o mecanismo de retry com `renovar()`. Chamadas de escrita via `postar` e operações transacionais de pista via `enviarOperacao` falham imediatamente ao receber 401, rejeitando a operação do operador mesmo com `refreshToken` válido.

#### Falha 03: `deviceId` fixo vs UUID único por dispositivo em SecureStore
- **Arquivo**: `src/features/auth/sessao.tsx`
  - Linha 36: `await cliente.entrar('gerencia', 'teste-codex', 'ipad-sim').catch(() => null);`
  - Linha 60: `async entrar(u, s) { await cliente.entrar(u, s, 'app-operacional'); setEu(await cliente.get<Eu>('/me')); },`
- **Arquivo**: `src/core/security/cofre.ts` (Linhas 1-14)
  - Apenas armazena tokens na chave `'kartodromo.operacional.sessao'`.
- **Constatação**: O valor `'app-operacional'` (ou `'ipad-sim'`) é uma constante fixa passada em todas as chamadas de login. Não há geração de UUID nem persistência de identificador de dispositivo, fazendo com que todos os tablets compartilhem o mesmo identificador na trilha de auditoria e no backend.

#### Falhas 04 e 05: Cliente SSE — keep-alive/ping e payloads multi-linha W3C
- **Arquivo**: `src/core/realtime/stream.ts`
  - `LeitorEventos.adicionar` (Linhas 8-21):
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
  - Loop de leitura em `conectarFluxo` (Linhas 52-56):
    ```ts
    for (const ev of leitor.adicionar(dec.decode(value, { stream: true }))) {
      if (ev.tipo === 'state') avisos.aoEvento(ev.dados);
      else if (ev.tipo === 'auth-expired') return 'renovar';
      else return 'repetir';
    }
    ```
- **Constatações**:
  1. **Falha 04**: Eventos como `event: ping`, `event: heartbeat` ou comentários SSE (`: keepalive`) retornam `tipo === 'ping'` ou `tipo === 'heartbeat'`. No loop de despacho, qualquer evento diferente de `'state'` e `'auth-expired'` cai no bloco `else return 'repetir'`. Isso encerra a conexão de stream, aciona `aoDesconectar()` e dispara reconexão em loop a cada ping recebido do backend.
  2. **Falha 05**: A regex `/^data: (.*)$/m` seleciona apenas a primeira linha com prefixo `data:`. De acordo com o padrão W3C SSE, mensagens com múltiplas linhas `data:` devem ter seus valores concatenados por quebras de linha (`\n`). Quando o servidor envia JSON multilinha ou múltiplos `data:`, `JSON.parse` falha com `SyntaxError`, gerando `{ tipo: 'invalido' }` e derrubando a conexão.

#### Falha 06: Timeout de conexão de 5 segundos no handshake inicial do SSE
- **Arquivo**: `src/core/realtime/stream.ts` (Linhas 33-46)
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
  ```
- **Constatação**: O temporizador de guarda de silêncio (`SILENCIO_MAX_MS = 45_000`) só é iniciado após a obtenção do corpo da resposta (`r.body`). Se a chamada inicial `f(...)` travar durante o handshake HTTP (ex.: socket preso na rede), a requisição fica pendurada indefinidamente sem timeout.

---

### 1.3 R1 Falhas 39 a 45 (Administração, Dono, Usuários e Histórico)

#### Falha 39: RBAC para perfil `GERENCIA` em rotas sensíveis
- **Arquivo**: `src/app/usuarios.tsx` (Linhas 17-31)
  - O componente `Usuarios` consome `cliente` e executa `/users` sem checar se `eu?.perfil === 'GERENCIA'`.
- **Arquivo**: `src/app/dono.tsx` (Linhas 87-99)
  - O componente `Dono` consome `cliente` e executa `/owner/today` e `/audit` sem checagem de perfil ou capacidade gerencial.
- **Arquivo**: `src/app/index.tsx` (Linhas 327-329)
  - No menu inicial, a exibição dos botões é filtrada por `eu?.capacidades`, mas o acesso direto à rota pelo Expo Router não possui guarda.
- **Constatação**: Não há proteção de rotas no nível das páginas. Qualquer usuário autenticado (como `OPERACAO` ou `RECEPCAO`) consegue abrir as telas `/usuarios` e `/dono`.

#### Falha 40: Bloqueio da própria conta conectada (auto-bloqueio)
- **Arquivo**: `src/app/usuarios.tsx` (Linhas 67-77)
  ```tsx
  <Pilula
    texto={u.bloqueado ? 'Liberar acesso' : 'Bloquear'}
    onPress={() =>
      confirmar(u.bloqueado ? 'Liberar' : 'Bloquear', `${u.nome}?`, () =>
        void acao(
          () => cliente.postar(`/users/${u.usuario}/block`, { bloqueado: !u.bloqueado }),
          u.bloqueado ? 'Liberado.' : 'Bloqueado: acesso cortado.',
        ),
      )
    }
  />
  ```
- **Constatação**: Para o item onde `u.usuario === eu?.usuario`, o botão "Bloquear" permanece visível e interativo. O operador administrativo pode acidentalmente bloquear seu próprio usuário.

#### Falha 41: Confirmação de senha em dois campos
- **Arquivo**: `src/app/usuarios.tsx` (Linhas 99-106): Apenas um campo `senha` (`placeholder="Senha inicial (10+)"`).
- **Arquivo**: `src/app/conta.tsx` (Linhas 60-63): Apenas um campo `nova` (`placeholder="Senha nova (10+ caracteres)"`).
- **Constatação**: Em ambas as telas inexiste o campo de confirmação (`confirmarSenha`). Erros de digitação em campos mascarados resultam em perda definitiva de acesso.

#### Falha 42: Filtros da trilha de auditoria para Lastro e Frota
- **Arquivo**: `src/app/historico.tsx` (Linhas 9-25):
  ```ts
  const NOME: Record<string, string> = {
    draw: 'Sorteio gravado',
    'late-assignment': 'Atrasado incluído',
    'weight-check': 'Lastro conferido',
    'kart-swap': 'Troca de kart',
    penalty: 'Punição aplicada',
    'penalty-remove': 'Punição retirada',
    flag: 'Bandeira de pista',
    relargada: 'Relargada',
    fleet: 'Manutenção de frota',
  };
  const FILTROS = [
    { id: '', t: 'Tudo' },
    { id: 'penalty', t: 'Punições' },
    { id: 'draw', t: 'Sorteios' },
    { id: 'kart-swap', t: 'Trocas' },
  ];
  ```
- **Constatação**: Os eventos `weight-check` e `fleet` estão mapeados em `NOME`, mas omitidos na lista de `FILTROS`.

#### Falha 43: Virtualização (`FlatList`) e paginação no histórico de auditoria
- **Arquivo**: `src/app/historico.tsx` (Linhas 58-90):
  - Utiliza `<ScrollView>` renderizando `vis.map((l, i) => ...)` sem reaproveitamento de nós, sem limite e sem paginação.
- **Constatação**: Em operações com centenas ou milhares de eventos diários, a falta de virtualização causa degradação de FPS e risco de estouro de memória (OOM).

#### Falha 44: Encerramento de sessão e redirecionamento após troca da própria senha
- **Arquivo**: `src/app/conta.tsx` (Linhas 14-24):
  ```ts
  const trocar = async () => {
    setErro('');
    try {
      await cliente.postar('/auth/password', { atual, nova });
      setOk(true);
      setAtual('');
      setNova('');
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  ```
- **Constatação**: Após sucesso na troca de senha, o estado `ok` é ativado, mas o app não chama `sair()` nem redireciona o usuário para o login.

#### Falha 45: Formatação de horário considerando fuso `America/Sao_Paulo`
- **Arquivo**: `src/features/operacao/formato.ts` (Linhas 12-13):
  ```ts
  export const minutos = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  export const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR');
  ```
- **Arquivo**: `src/app/index.tsx` (Linha 230):
  ```ts
  nome: item.nome ?? `Bateria ${item.inicio?.slice(11, 16) ?? item.id}`,
  ```
- **Arquivo**: `src/app/historico.tsx` (Linha 64):
  ```ts
  const dataHora = new Date(l.timestampServerUTC).toLocaleString('pt-BR');
  ```
- **Constatação**: Nenhuma das funções passa a opção `timeZone: 'America/Sao_Paulo'`. Aparelhos configurados em UTC ou outro fuso exibem horários descompassados em 3 horas. Adicionalmente, `item.inicio?.slice(11, 16)` assume que a string ISO já está no horário local sem converter UTC para o fuso de Brasília.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Sobre Conexão LAN e Release Mode**:
   - Da Observação 1.2 (Falha 01): `baseSegura` bloqueia HTTP exceto `127.0.0.1` e `localhost` se `desenvolvimento` for `false`.
   - Como os tablets operam na pista conectando-se ao servidor local via IP privado (ex.: `192.168.1.100:4050`), builds em modo Release falham na inicialização.
   - Além disso, `throw new Error(...)` no escopo do arquivo `sessao.tsx` impede o ciclo de vida do React caso `EXPO_PUBLIC_API_URL` não esteja presente.
   - **Solução lógica**: Expandir regex de `baseSegura` para aceitar classes RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) mesmo fora de desenvolvimento, e gerenciar a ausência da variável de ambiente exibindo uma tela de fallback segura em vez de lançar exceção global.

2. **Sobre Transparência de Sessão em Métodos de Escrita**:
   - Da Observação 1.2 (Falha 02): `get` já valida 401 e chama `renovar()`.
   - Se o token expirar enquanto o operador clica em "Sortear", "Trocar kart" ou "Bloquear usuário", `postar` e `enviarOperacao` recebem 401 e falham imediatamente.
   - Como `enviarOperacao` já usa `operationId` para idempotência, reenviar após renovação do token é totalmente seguro contra duplicações.
   - **Solução lógica**: Replicar a renovação e repetição em `postar` e `enviarOperacao` antes de propagar falhas ao usuário.

3. **Sobre Unicidade de Dispositivo**:
   - Da Observação 1.2 (Falha 03): O identificador `'app-operacional'` é fixo.
   - Sem UUID persistido por aparelho em `SecureStore`, múltiplos tablets compartilham identidade, invalidando a auditoria e rastreamento de estações.
   - **Solução lógica**: Implementar rotina em `cofre.ts` que recupera ou gera um UUID v4 no primeiro arranque, salvando-o em chave dedicada no `SecureStore`.

4. **Sobre Estabilidade do Stream SSE**:
   - Da Observação 1.2 (Falhas 04, 05, 06):
     - Pings e batidas de keep-alive chegam como `event: ping` ou comentários; ao cair no `else return 'repetir'`, o cliente quebra a conexão e reconecta a cada 15s.
     - Payloads multi-linha W3C são truncados pela regex que só captura uma linha, corrompendo o JSON e gerando desconexão.
     - Handshake inicial sem timeout de 5s pode bloquear indefinidamente caso o socket caia antes da resposta.
   - **Solução lógica**: Em `stream.ts`, ignorar explicitamente eventos de ping/heartbeat/comentários mantendo a conexão ativa; parser de blocos acumulando todas as linhas com prefixo `data:` separadas por `\n`; e adicionar `setTimeout(5000)` abortando a requisição caso os headers HTTP demorem mais de 5 segundos.

5. **Sobre Integridade Administrativa e Usabilidade**:
   - Da Observação 1.3 (Falhas 39, 40, 41, 44):
     - Telas `/usuarios` e `/dono` devem validar se o perfil do usuário ativo é `GERENCIA`, redirecionando usuários comuns para `/`.
     - O item correspondente ao usuário logado em `/usuarios` deve ter o botão "Bloquear" ocultado/desabilitado com indicação visual (ex.: selo "VOCÊ").
     - Confirmação de senha em dois campos garante que senhas mascaradas não sejam gravadas com erros tipográficos.
     - Ao alterar a própria credencial em `/conta`, é mandatório encerrar a sessão local (`cliente.encerrar()`) e retornar à tela de login para forçar nova autenticação com a credencial atualizada.

6. **Sobre Auditoria e Formatação**:
   - Da Observação 1.3 (Falhas 42, 43, 45):
     - Adicionar os filtros `'weight-check'` e `'fleet'` ao array `FILTROS` em `historico.tsx`.
     - Migrar de `<ScrollView>` com renderização estática para `<FlatList>` paginada no histórico.
     - Centralizar toda formatação de data/hora em `features/operacao/formato.ts` garantindo `timeZone: 'America/Sao_Paulo'`.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Permissão de Modificação de Código**:
   - Este agente possui perfil de **Explorer (leitura e análise apenas)**. Nenhuma alteração foi gravada nos arquivos de código-fonte de `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`. As propostas de alteração estão formalizadas neste handoff para implementação pelos Workers designados.
2. **Dependência de `expo-crypto` vs UUID nativo**:
   - Caso `expo-crypto` não esteja listado no `package.json`, o UUID de dispositivo pode ser gerado via `globalThis.crypto?.randomUUID()` (suportado no React Native moderno / Hermes) ou função helper compatível RFC 4122 sem necessidade de novas dependências externas.
3. **Controle de Acesso no Backend**:
   - A guarda de rota no frontend (`usuarios.tsx` e `dono.tsx`) melhora a UX e mitiga acessos acidentais, mas a segurança real depende de o backend `/users` e `/owner` rejeitarem tokens sem a capacidade correspondente (403 Forbidden).

---

## 4. Conclusion (Conclusão e Propostas de Alteração)

O aplicativo `kartodromo-operacional` possui arquitetura enxuta e base de testes rápida (29 testes em ~0.25s), porém apresenta vulnerabilidades críticas de conectividade em modo Release, estabilidade no cliente SSE e brechas de validação nas telas administrativas.

### Tabela Resumo das Falhas e Arquivos-Alvo:

| Falha | Componente / Arquivo | Linhas | Alteração Necessária |
|---|---|---|---|
| **01** | `src/core/api/cliente.ts`<br>`src/features/auth/sessao.tsx` | `cliente.ts:9`<br>`sessao.tsx:13-14` | Permitir RFC 1918 em `baseSegura`. Evitar throw no top-level de `sessao.tsx`, renderizando tela de fallback amigável quando API_URL faltar. |
| **02** | `src/core/api/cliente.ts` | `72-76, 81-90` | Adicionar renovação em 401 para `postar` e `enviarOperacao` com repetição transparente. |
| **03** | `src/core/security/cofre.ts`<br>`src/features/auth/sessao.tsx` | `cofre.ts:1-14`<br>`sessao.tsx:36, 60` | Criar `obterOuCriarDeviceId()` persistindo UUID no SecureStore e utilizá-lo no `entrar()`. |
| **04** | `src/core/realtime/stream.ts` | `13-17, 52-56` | Tratar e ignorar eventos `ping`, `heartbeat` e comentários sem derrubar a conexão SSE. |
| **05** | `src/core/realtime/stream.ts` | `8-21` | Acumular múltiplos prefixos `data:` no bloco SSE conforme W3C antes do `JSON.parse`. |
| **06** | `src/core/realtime/stream.ts` | `36-40` | Inserir timeout de 5000ms com `AbortController` para o handshake inicial de conexão. |
| **39** | `src/app/usuarios.tsx`<br>`src/app/dono.tsx` | `usuarios:17-31`<br>`dono:87-99` | Implementar checagem RBAC para perfil `GERENCIA` com bloqueio/redirecionamento. |
| **40** | `src/app/usuarios.tsx` | `67-77` | Ocultar botão "Bloquear" quando `u.usuario === eu?.usuario`. |
| **41** | `src/app/usuarios.tsx`<br>`src/app/conta.tsx` | `usuarios:99-106`<br>`conta:60-67` | Adicionar campo de confirmação de senha e validar igualdade antes do submit. |
| **42** | `src/app/historico.tsx`<br>`src/app/dono.tsx` | `historico:20-25`<br>`dono:59-64` | Incluir `{ id: 'weight-check', t: 'Lastro' }` e `{ id: 'fleet', t: 'Frota' }` nos `FILTROS`. |
| **43** | `src/app/historico.tsx` | `58-90` | Substituir `ScrollView` por `FlatList` com paginação progressiva de itens. |
| **44** | `src/app/conta.tsx` | `14-24` | Encerrar sessão (`sair()`) e redirecionar ao login com aviso após alteração de senha. |
| **45** | `src/features/operacao/formato.ts`<br>`src/app/index.tsx`<br>`src/app/historico.tsx` | `formato.ts:12-13`<br>`index.tsx:230`<br>`historico.tsx:64` | Aplicar `timeZone: 'America/Sao_Paulo'` e formatar datas ISO respeitando o fuso local. |

---

## 5. Verification Method (Método de Verificação Independente)

Para validar as soluções implementadas pelo próximo agente (Worker):

1. **Executar a Suíte de Testes Automatizados**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
2. **Executar Verificação de Tipos TypeScript**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
3. **Casos de Teste Unitários a Serem Adicionados em `tests/`**:
   - `tests/cliente.test.ts`:
     - Testar se `baseSegura` retorna `true` para `http://192.168.1.50:4050`, `http://10.0.0.1:3000` e `http://172.16.0.2:4050` mesmo com `desenvolvimento = false`.
     - Testar se `postar` renova o token após 401 e retenta com sucesso.
     - Testar se `enviarOperacao` renova o token após 401 e retenta mantendo o mesmo `operationId`.
   - `tests/tempo-real.test.ts`:
     - Testar se `LeitorEventos` ignora `event: ping\ndata: {}\n\n` e `: batida\n\n` sem retornar evento de erro.
     - Testar se `LeitorEventos` concatena múltiplos `data:` de um mesmo evento W3C (`data: {"seq":1,\ndata:"sessoes":[]}\n\n`).
     - Testar se `conectarFluxo` aciona timeout de 5 segundos no handshake inicial.
   - `tests/formato.test.ts` (novo ou estendido):
     - Testar formatação de ISO UTC para horário local `America/Sao_Paulo` (ex.: `2026-11-02T21:00:00Z` vira `18:00`).

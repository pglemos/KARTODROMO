# Relatório de Revisão e Crítica Adversarial — Milestone M1 Iteração 2

**Data**: 2026-11-02T21:18:00Z  
**Autor**: Reviewer 2 / Adversarial Critic (`reviewer_m1_it2_2`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Milestone**: M1 Iteration 2 (Falhas 01-07 e 39-45)  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Veredito Oficial**: **APPROVE**  

---

## 1. Observation (Observações Diretas)

### 1.1 Verificação de Credenciais, Segredos e Backdoor
- **Arquivo `src/features/auth/sessao.tsx`**:
  - Linhas 47 a 57:
    ```typescript
    useEffect(() => {
      void (async () => {
        try {
          if (await cliente.tokenAtual()) setEu(await cliente.get<Eu>('/me'));
        } catch {
          /* sem rede ou sessão vencida: vai ao login */
        } finally {
          setCarregando(false);
        }
      })();
    }, [cliente]);
    ```
    Confirmado: Nenhuma ocorrência de `teste-codex`, nenhuma credencial fixa `'gerencia'`, e nenhum auto-login condicional.
  - Linhas 85 a 90:
    ```typescript
    export function ProvedorSessao({ children }: PropsWithChildren) {
      if (!BASE_VALIDA) {
        return <ServidorNaoConfigurado />;
      }
      return <ProvedorSessaoAtivo>{children}</ProvedorSessaoAtivo>;
    }
    ```
    Confirmado: Respeito integral às *Rules of Hooks* do React mediante component splitting. O componente guarda `ProvedorSessao` não invoca nenhum hook antes do retorno antecipado condicional. O componente `ProvedorSessaoAtivo` invoca incondicionalmente todos os hooks no topo.
- **Git diff e repositório**:
  - Execução de busca textual de credenciais no repositório `kartodromo-operacional` via ripgrep:
    - O único arquivo com `teste-codex` é `tests/cliente.test.ts:123`, que consiste em uma asserção explícita de regressão: `expect(conteudo).not.toContain('teste-codex');`.
    - `git log -S "teste-codex"` retornou 0 commits. A credencial temporária de teste jamais foi introduzida no histórico git versionado.
    - Zero credenciais, tokens estáticos ou senhas hardcoded identificadas em `git diff`.

### 1.2 Verificação de Conformidade das Falhas 01-07 e 39-45
- **Falha 01 (`baseSegura` e fallback de URL)**:
  - `src/core/api/cliente.ts:9-24`: `baseSegura` aceita redes privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), além de `localhost` e `127.0.0.1` em modo Release (`desenvolvimento = false`).
  - `src/features/auth/sessao.tsx:17-29, 85-88`: se `EXPO_PUBLIC_API_URL` não for fornecida ou for inválida, exibe a tela informativa `<ServidorNaoConfigurado />` sem lançar exceções não tratadas na inicialização.
- **Falha 02 (Auto Refresh JWT em 401)**:
  - `src/core/api/cliente.ts:87-97` (`postar`) e `102-124` (`enviarOperacao`): ao receber HTTP 401, acionam transparentemente `renovar()`. A promessa em voo é consolidada (`renovando ??= ...`), evitando tempestade de renovações simultâneas. Em caso de sucesso, retentam a requisição com o novo Bearer token.
  - Preservação do `operationId` estático durante o retry em `enviarOperacao`.
- **Falha 03 (UUID persistente por dispositivo)**:
  - `src/core/security/cofre.ts:34-51`: `obterOuCriarDeviceId()` consulta o SecureStore pela chave `kartodromo.operacional.deviceId`. Se ausente ou se não corresponder ao padrão UUID v4 (`UUID_V4_REGEX`), gera um novo identificador RFC 4122 v4 e persiste.
  - `src/features/auth/sessao.tsx:76-78`: `entrar(u, s)` obtém `const deviceId = await obterOuCriarDeviceId();` e envia para `cliente.entrar(u, s, deviceId)`.
- **Falhas 04, 05 e 06 (SSE: W3C Multiline, Ping/Heartbeat e Handshake Timeout)**:
  - `src/core/realtime/stream.ts:18`: ignora linhas iniciadas por `:` (comentários SSE, como `: batida\n\n`).
  - `src/core/realtime/stream.ts:21-28`: acumula múltiplas linhas `data:` no mesmo evento e as concatena com `\n`, cumprindo estritamente a especificação W3C.
  - `src/core/realtime/stream.ts:27`: ignora eventos `ping` e `heartbeat` sem gerar desconexões ou acionar fallbacks espúrios.
  - `src/core/realtime/stream.ts:39, 50-56`: `TIMEOUT_HANDSHAKE_MS = 5_000` cancela a tentativa inicial de conexão caso o servidor não responda ao handshake em 5 segundos.
- **Falha 39 (RBAC para Perfil GERENCIA)**:
  - `src/app/usuarios.tsx:61-77` e `src/app/dono.tsx:148-164`: validam `if (eu?.perfil !== 'GERENCIA')` renderizando tela de acesso restrito e suprimindo chamadas de rede para `/users`, `/owner/today` e `/audit`.
- **Falha 40 (Anti Auto-Bloqueio)**:
  - `src/app/usuarios.tsx:88`: identificação normalizada do operador logado:
    ```typescript
    const ehEu = Boolean(eu?.usuario && u.usuario.trim().toLowerCase() === eu.usuario.trim().toLowerCase());
    ```
  - Linhas 104-106: exibe `<Selo texto="SUA CONTA" tom="neutro" />` e oculta a `<Pilula>` de bloqueio para a conta conectada.
- **Falha 41 (Confirmação de Senha)**:
  - `src/app/usuarios.tsx:144-165`: exige campo secundário `confirmarSenha` e validação estrita antes do envio.
  - `src/app/conta.tsx:88-109`: exige campo `confirmacao` para troca da própria senha, alertando divergências e desabilitando o botão de envio.
- **Falha 42 (Filtros de Auditoria para Lastro e Frota)**:
  - `src/app/historico.tsx:21-28` e `src/app/dono.tsx:59-66`: incluem opções `{ id: 'weight-check', t: 'Lastro' }` e `{ id: 'fleet', t: 'Frota' }`.
- **Falha 43 (FlatList Paginada na Auditoria)**:
  - `src/app/historico.tsx:70-122`: substituição do ScrollView estático por `<FlatList>` virtualizada com paginação de 25 itens (`ITENS_POR_PAGINA = 25`), gatilho `onEndReached` e reset de página ao mudar o filtro ativo.
- **Falha 44 (Logout Pós-Troca de Senha)**:
  - `src/app/conta.tsx:31-38`: após sucesso no endpoint `/auth/password`, encerra a sessão via `await sair()` e redireciona ao login inicial (`/`).
- **Falha 45 (Fuso Horário America/Sao_Paulo)**:
  - `src/features/operacao/formato.ts:1-65`: uso padronizado de `timeZone: 'America/Sao_Paulo'` em `minutos`, `hora`, `dataHoraLocal`, `horaMinutoLocal` e `formatarInicioAgenda`. Tratamento robusto e seguro contra entradas vazias, `NaN` ou strings arbitrárias.

### 1.3 Execução de Testes e Checagem Estática de Tipos
Comando executado:
```bash
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test && npm run tipos
```
Resultados obtidos:
- **`npm test`**:
  - Test Suites: 11 passed, 11 total
  - Tests: 199 passed, 199 total
  - Snapshots: 0
  - Duração: 1.475 s
- **`npm run tipos` (`tsc --noEmit`)**:
  - Código de saída: 0 (sem erros de compilação ou incompatibilidade de tipos).

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Eliminação Integral de Violações de Integridade**:
   - A análise minuciosa do arquivo `sessao.tsx` e de todas as alterações em `git diff` confirma que o backdoor e as credenciais hardcoded identificadas na auditoria anterior foram 100% extirpados do código e do repositório.
   - Não há stubs, facadas ou retornos falsificados criados para burlar testes. Todos os componentes contêm a lógica real de produção requerida pelo `SCOPE.md`.
2. **Conformidade Funcional com os Requisitos de Aceite**:
   - Cada uma das 13 falhas compreendidas no Milestone M1 (01 a 07 e 39 a 45) foi inspecionada diretamente em seu arquivo de implementação e correlacionada com a respectiva suíte de testes.
   - As soluções adotadas (component splitting para Hooks, regex para RFC 1918, `AbortController` para handshake SSE, sanitização com `.trim().toLowerCase()` no auto-bloqueio, FlatList virtualizada para histórico e fuso horário `America/Sao_Paulo` parametrizado) atendem com rigor técnico às especificações originais.
3. **Resiliência Adversarial Comprovada**:
   - Os testes de estresse em `tests/m1-challenger-stress.test.ts` e `tests/stress-challenger.test.ts` comprovaram a robustez do sistema frente a tentativas de injeção de perfis no RBAC, tentativas de auto-bloqueio com espaçamentos espúrios, concorrência de renovação de tokens JWT, transições de datas com fuso horário e paginação com rolagem rápida em limites de borda.
4. **Ausência de Efeitos Colaterais no Ecossistema**:
   - O projeto principal `KARTODROMO` e seus arquivos protegidos (como as telas de TV e cronometragem de produção) não sofreram intervenções decorrentes deste trabalho no app operacional.

---

## 3. Caveats & Apontamentos Menores (Adversarial Observations)

1. **Estado de Envio no Formulário de Troca de Senha (`src/app/conta.tsx`)**:
   - *Observação*: No componente `Conta`, a variável de bloqueio `desconectando` só é ativada após a resposta positiva do servidor (`await cliente.postar('/auth/password', ...)`). Durante o intervalo de trânsito da requisição de rede, um operador impaciente que efetuar cliques múltiplos e rápidos disparará requisições concorrentes. A primeira requisição alterará a credencial com sucesso e as subsequentes serão rejeitadas pelo backend (400 ou 401).
   - *Impacto*: Baixo / Cosmético. Não compromete a segurança nem a integridade dos dados. Recomenda-se adicionar um estado `enviando: boolean` no envio do formulário em iterações de polimento.
2. **Entrada de Senha Composta Exclusivamente por Espaços (`src/app/usuarios.tsx`)**:
   - *Observação*: A validação de comprimento (`senha.length < 10`) não aplica `.trim()` na senha durante a criação de usuário. Conforme demonstrado no teste de estresse linha 127 de `m1-challenger-stress.test.ts`, uma senha composta por 10 espaços consecutivos é aceita pelo frontend. Embora seja prática recomendada não fatiar caracteres de senhas arbitrariamente para permitir passphrases, recomenda-se que a política de segurança administrativa exija ao menos caracteres não vazios.
   - *Impacto*: Baixo. Restrito ao perfil GERENCIA e sujeito à política de validação do backend.
3. **Escopo Delimitado**:
   - Esta revisão cobriu estritamente a Milestone M1 (Falhas 01-07 e 39-45). Os fluxos das Milestones M2 (Sorteio e Balança), M3 (Frota e O.S.), M4 (Direção e DSQ) e M5 (Simulador e E2E) serão avaliados nas respectivas etapas.

---

## 4. Conclusion (Conclusão e Veredito)

A implementação remediada da Milestone M1 cumpre integralmente todos os critérios de aceitação, elimina qualquer violação de integridade ou credencial versionada, restaura a conformidade arquitetural com o React e atinge 100% de sucesso nas suítes automatizadas de testes e verificação estática de tipos.

**Veredito Oficial**: **APPROVE**

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar as conclusões deste relatório:

1. **Verificação de Ausência de Credenciais e Segredos**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional
   git diff src/features/auth/sessao.tsx
   grep -rn --exclude-dir=node_modules --exclude-dir=.git "teste-codex" .
   ```
   *Critério*: `sessao.tsx` sem credenciais e apenas uma ocorrência negativa no teste de regressão em `tests/cliente.test.ts`.

2. **Execução da Suíte de Testes Automatizados**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   *Critério*: Todas as 11 suítes aprovadas (199 passed, 0 failed).

3. **Verificação Estática de Tipagem (TypeScript)**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   *Critério*: Código de saída 0 (`tsc --noEmit`).

4. **Invalidação**:
   - Qualquer reintrodução de credenciais, quebra de testes ou regressão no parsing de SSE ou validação RFC 1918 invalidará este veredito.

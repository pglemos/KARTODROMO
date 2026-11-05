# Relatório de Handoff — Worker M1 (`worker_m1_1`)

**Data**: 2026-11-02T20:45:00Z  
**Autor**: Worker M1 (`worker_m1_1`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Milestone**: Milestone 1 (Foundation & Security & Account/Users — Falhas 01-07 e 39-45)  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  

---

## 1. Observation (Observações Diretas)

### 1.1 Estado Inicial do Projeto
- Comando inicial de teste: `npm test` executado em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`.
  - Resultado: 4 suítes, 29 testes concluídos com sucesso.
- Comando de verificação de tipos: `npm run tipos` (`tsc --noEmit`).
  - Resultado: código de saída 0, sem erros de compilação TypeScript.

### 1.2 Arquivos Modificados e Criados (Escopo Exclusivo M1)
1. `src/core/api/cliente.ts`:
   - `baseSegura`: implementada regex estrita de octetos RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e `localhost`/`127.0.0.1` usando `new URL(base).hostname` para rejeitar subdomínios maliciosos e URLs com credenciais forjadas mesmo em modo Release (`desenvolvimento === false`).
   - `postar<T>`: implementada renovação transparente de token JWT via `renovar()` ao receber HTTP status 401, repetindo a requisição com o novo Bearer token antes de rejeitar.
   - `enviarOperacao`: implementada renovação transparente em 401 com repetição preservando rigorosamente o `operationId` original (garantindo idempotência) e tratando falha de rede sem deslogar o usuário (`status: 'UNKNOWN'`).
2. `src/core/security/cofre.ts`:
   - Criada a função exportada `gerarUuidV4(): string` com suporte a `crypto.randomUUID()`, fallback a `crypto.getRandomValues()` e gerador pseudorrandômico conforme RFC 4122 v4.
   - Criada a função exportada `obterOuCriarDeviceId(armazenamento?: ArmazenamentoSeguro): Promise<string>` que persiste e recupera o UUID sob a chave `'kartodromo.operacional.deviceId'` no `SecureStore`, garantindo estabilidade de auditoria por hardware.
3. `src/core/realtime/stream.ts`:
   - `LeitorEventos.adicionar`: adicionado suporte à normalização de quebras de linha (`\r\n`), acumulação de blocos `data:` com concatenação por quebra de linha `\n` conforme norma W3C SSE, descarte seguro de comentários (`:`), e supressão de eventos keep-alive (`event: ping` e `event: heartbeat`).
   - `conectarFluxo` / `umaConexao`: adicionado `TIMEOUT_HANDSHAKE_MS = 5_000` com `AbortController` durante a negociação HTTP inicial, e cláusula `else if (ev.tipo === 'ping' || ev.tipo === 'heartbeat') continue;` no loop de leitura para rearmar o temporizador de silêncio de 45 segundos sem desconectar.
4. `src/features/auth/sessao.tsx`:
   - Removido o `throw new Error(...)` que quebrava o bundle em tempo de importação de módulo.
   - Implementada a tela amigável de contingência `<ServidorNaoConfigurado />` exibida pelo `ProvedorSessao` quando `EXPO_PUBLIC_API_URL` não for válida conforme `baseSegura`.
   - Utilizados estritamente os tokens existentes em `tokens.ts`: `fontes.titulo`, `cores.suave` e `cores.apagado`.
   - Substituídos os deviceIds fixos hardcoded (`'ipad-sim'` e `'app-operacional'`) por chamadas assíncronas a `await obterOuCriarDeviceId()`.
5. `src/features/operacao/formato.ts`:
   - Centralizado `FUSO_HORARIO = 'America/Sao_Paulo'`.
   - Atualizados `minutos()` e `hora()` para utilizar `timeZone: FUSO_HORARIO`.
   - Implementadas as funções exportadas `dataHoraLocal`, `horaMinutoLocal` e `formatarInicioAgenda(inicio, fallback)`.
6. `src/app/index.tsx`:
   - Substituído `item.inicio?.slice(11, 16)` por `formatarInicioAgenda(item.inicio, item.id)` nas linhas 230 e 448 para garantir exibição correta no fuso de Brasília.
7. `src/app/usuarios.tsx`:
   - RBAC: inserida validação de perfil `eu?.perfil === 'GERENCIA'` e tela de acesso restrito com redirecionamento via `router.replace('/')`.
   - Anti Auto-Bloqueio: verificação de `u.usuario === eu?.usuario` que oculta o botão "Bloquear", exibindo a etiqueta `<Selo texto="SUA CONTA" tom="neutro" />` e tag `<Selo texto="VOCÊ" tom="verde" />`.
   - Confirmação de senha: adicionado campo mascarado `confirmarSenha` com validação de igualdade e comprimento mínimo de 10 caracteres antes de habilitar submissão.
8. `src/app/dono.tsx`:
   - RBAC: guarda de permissão exigindo `eu?.perfil === 'GERENCIA'` e bloqueio de polling em background para usuários não autorizados.
   - Filtros: adicionadas opções para conferência de lastro (`weight-check`) e manutenção de frota (`fleet`).
   - Timezone: feed de eventos atualizado para utilizar `horaMinutoLocal(l.timestampServerUTC)`.
9. `src/app/conta.tsx`:
   - Confirmação de senha: adicionado campo mascarado `confirmacao` validado antes do envio.
   - Logout automático pós-troca: após confirmação do backend, encerra a sessão com aviso explicativo, chama `await sair()` e redireciona ao login com `router.replace('/')`.
10. `src/app/historico.tsx`:
    - Filtros: adicionadas opções `{ id: 'weight-check', t: 'Lastro' }` e `{ id: 'fleet', t: 'Frota' }`.
    - Virtualização: substituído `ScrollView` com mapeamento estático por `FlatList` com `key={tablet ? 'grid-2' : 'list-1'}`, suporte responsivo a tablet/mobile e paginação em lote de 25 itens (`ITENS_POR_PAGINA = 25`, `onEndReached`).
    - Timezone: exibição dos registros de auditoria formatados via `dataHoraLocal` no fuso `America/Sao_Paulo`.
11. Testes Automatizados:
    - Criado `tests/formato.test.ts` (7 testes de timezone e formatação).
    - Atualizado `tests/cliente.test.ts` com testes para renovação transparente em `postar` e `enviarOperacao` (preservando `operationId`), e testes de geração e persistência de UUID único no SecureStore com fallback.
    - Atualizado `tests/tempo-real.test.ts` com testes para W3C multiline `data:`, supressão de pings/heartbeats/comentários, validação RFC 1918 e timeout de handshake de 5s.

### 1.3 Resultado da Verificação Final
- Comando: `cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test && npm run tipos`
- Saída:
```
PASS tests/tempo-real.test.ts
PASS tests/formato.test.ts
PASS tests/cliente.test.ts
PASS tests/tier1-features.test.ts
PASS tests/tier2-boundary-corner-cases.test.ts
PASS tests/tier4-lifecycle-e2e.test.ts
PASS tests/tier3-cross-feature.test.ts
PASS tests/sorteio.test.ts
PASS tests/baterias.test.ts

Test Suites: 9 passed, 9 total
Tests:       131 passed, 131 total
Snapshots:   0 total
Time:        0.493 s, estimated 1 s
Ran all test suites.

> kartodromo-operacional@0.1.0 tipos
> tsc --noEmit
```

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Conexão Local Resiliente (Falha 01)**:
   - Os tablets operam na rede LAN Wi-Fi do kartódromo conectando-se via IP privado (`192.168.x.x` ou `10.x.x.x`) à porta do servidor local (`:4050` ou simulador `:4150`).
   - A validação de `baseSegura` extrai o host através de `new URL(base).hostname` e confronta com a regex de faixas privadas RFC 1918. Isso permite a operação local em modo Release sem autorizar domínios maliciosos ou spoofing por subdomínio.
   - A substituição do `throw` no escopo do módulo por uma tela React controlada (`ServidorNaoConfigurado`) evita que o app sofra crash com tela branca em inicializações com variáveis ausentes.

2. **Idempotência e Auto-Refresh em Escrita (Falha 02)**:
   - A expiração de tokens JWT no meio de uma rotina de galpão, pesagem ou troca de kart resultava em falha 401.
   - Espelhando a renovação de `get`, estendemos o retry com `renovar()` para `postar` e `enviarOperacao`.
   - Em `enviarOperacao`, o corpo original com a chave de idempotência `operationId` é integralmente preservado na repetição. Como o servidor transacional descarta duplicações baseado nesse ID, não há risco de duplicar efeitos na pista. Em caso de falha de rede no refresh, retorna `status: 'UNKNOWN'` mantendo o operador logado para reconciliação posterior.

3. **Rastreabilidade por Hardware com UUID Único (Falha 03)**:
   - Anteriormente, todos os aparelhos enviavam `'app-operacional'`, impedindo auditoria individual de cada tablet.
   - `obterOuCriarDeviceId` gera um UUID v4 canônico e grava em `expo-secure-store` sob chave independente de sessão (`kartodromo.operacional.deviceId`). Essa chave sobrevive ao logout, permitindo rastrear o hardware físico de onde partiram as operações na pista.

4. **Estabilidade do Fluxo SSE (Falhas 04, 05, 06)**:
   - O servidor emite batimentos periódicos (`ping` / `heartbeat`) e payloads que podem quebrar em múltiplas linhas `data:`.
   - O leitor acumula as linhas `data:` concatenando com `\n`, permitindo o parse íntegro de JSONs multilinha conforme norma W3C.
   - Pings, heartbeats e comentários são tratados como batimentos de liveness, rearmando o watchdog de 45 segundos e evitando desconexões espúrias.
   - Um timeout com `AbortController` de 5.000 ms durante o handshake inicial evita bloqueios caso a requisição HTTP inicial congele na rede.

5. **Controle de Acesso e Segurança Administrativa (Falhas 39, 40, 41, 44)**:
   - Rotas de administração (`/usuarios` e `/dono`) agora exigem estritamente `eu?.perfil === 'GERENCIA'`. Usuários sem privilégio visualizam tela de aviso com opção de retorno ao início, e nenhum polling ou requisição sensível é disparada.
   - Prevenção de auto-bloqueio em `/usuarios`: o operador conectado não vê botão de bloqueio em sua própria linha, prevenindo perda acidental de acesso administrativo.
   - Confirmação de senha em `/usuarios` e `/conta`: dois campos mascarados evitam alteração acidental de credencial por digitação incorreta.
   - Em `/conta`, a troca da própria senha invalida a sessão local e redireciona automaticamente para o login, reforçando as boas práticas de segurança.

6. **Virtualização, Auditoria e Fuso Horário (Falhas 42, 43, 45)**:
   - A substituição do `ScrollView` por `FlatList` com paginação em blocos de 25 itens reduz a pegada de memória e elimina gargalos de renderização na trilha de auditoria.
   - Filtros adicionais para `weight-check` (lastro) e `fleet` (frota) atendem diretamente à necessidade dos fiscais de pista e mecânicos.
   - Centralização de formatação com `timeZone: 'America/Sao_Paulo'` garante que horários da agenda e da auditoria reflitam o horário de Betim/MG (UTC-3), eliminando a divergência observada pelo uso de `.slice(11, 16)` em strings UTC.

---

## 3. Caveats (Ressalvas e Suposições)

- **Suíte E2E**: Durante a execução dos testes, as 5 suítes prévias de teste e validação E2E (`tier1-features.test.ts`, `tier2-boundary-corner-cases.test.ts`, `tier3-cross-feature.test.ts`, `tier4-lifecycle-e2e.test.ts`, `harness.ts`) foram executadas em conjunto pelo Jest e passaram 100% (131 de 131 testes).
- **Sem Dependência de AsyncStorage para Credenciais**: Conforme a regra de ouro do projeto, nenhuma credencial é armazenada em AsyncStorage; todas utilizam `expo-secure-store`.

---

## 4. Conclusion (Conclusão)

Todas as tarefas do Milestone 1 (Falhas 01 a 07 e Falhas 39 a 45) foram plenamente implementadas, tipadas e verificadas no código-fonte de `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:
1. `baseSegura` e fallback de URL atendem aos requisitos de rede local RFC 1918 e segurança em Release (Falha 01).
2. Renovação automática transparente implementada para métodos de escrita (`postar` e `enviarOperacao`) preservando `operationId` (Falha 02).
3. UUID de dispositivo gerado e persistido no SecureStore (Falha 03).
4. Stream SSE estabilizado contra pings, habilitado para multiline W3C e protegido por timeout de 5s no handshake (Falhas 04, 05, 06).
5. RBAC `GERENCIA` protegendo `/usuarios` e `/dono` (Falha 39).
6. Anti auto-bloqueio ativo em `/usuarios` (Falha 40).
7. Confirmação de senha em `/usuarios` e `/conta` (Falha 41).
8. Filtros de lastro e frota em `/historico` e `/dono` (Falha 42).
9. Virtualização com `FlatList` e paginação de 25 itens em `/historico` (Falha 43).
10. Logout automático e redirecionamento pós-troca de senha própria em `/conta` (Falha 44).
11. Fuso horário `America/Sao_Paulo` aplicado uniformemente em `formato.ts`, `index.tsx`, `dono.tsx` e `historico.tsx` (Falha 45).

---

## 5. Verification Method (Método de Verificação Independente)

Para auditoria independente pelo revisor ou orchestrator:

1. **Executar a Suíte Completa de Testes**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   - **Critério de Sucesso**: 9 suítes de testes passando, totalizando 131 testes aprovados com 0 falhas.

2. **Executar a Verificação Estrita de Tipos**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   - **Critério de Sucesso**: Código de saída 0 sem nenhum erro retornado por `tsc --noEmit`.

3. **Verificação Específica das Novas Suítes**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/cliente.test.ts tests/tempo-real.test.ts tests/formato.test.ts
   ```
   - **Critério de Sucesso**: Todos os cenários de renovação 401, UUID persistente, W3C multiline, RFC 1918 e timezone de São Paulo aprovados.

# App Operacional — F1 Plataforma: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar login individual, perfis, API `/api/app/v1` segura, idempotência, revisão, auditoria, tempo real e o esqueleto do app Android/iOS, sem nenhum comando de prova habilitado.

**Architecture:** Módulo novo `lib/app-v1` chamado por `services/timing-server.ts` em um único ponto, antes do bloqueio de internet. O Worker `workers/app-operacional` publica HTTPS e repassa ao túnel, mas a autorização real fica na origem. O dado do app fica em SQLite próprio, separado das provas. O app é um repositório novo em Expo.

**Tech Stack:** TypeScript, `node:sqlite`, `node:crypto` (scrypt, HMAC), Cloudflare Workers, Expo 57, Expo Router, React Native 0.86, `expo-secure-store`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-app-operacional-prd.md`, seções 5, 12–15; evidências em `docs/app-operacional/` e `docs/alinhamento/`.

## Global Constraints

- Base: branch `alinhamento/base-app`. Nenhuma rota existente muda de contrato; `tests/app-operacional-baseline.test.ts` continua 10/10.
- Perfis exatos: `RECEPCAO`, `OPERACAO`, `GERENCIA`. Conta individual, sem conta compartilhada.
- Sem chave de serviço, senha ou segredo dentro do APK/IPA.
- Token de acesso de 15 min; renovação com rotação, 12 h no aparelho compartilhado. Bloqueio de usuário vale no pedido seguinte.
- Fase 1 do caminho: **só HTTPS público**, também dentro do kartódromo (PRD 12.2). Atalho local com TLS fica para depois das medições. A barra mostra `Internet segura`.
- Nada é publicado no ORBITS, no Cloudflare ou nas lojas sem autorização do dono. Toda publicação fora de bateria.
- `node:sqlite` exige confirmar versão do Node no ORBITS na Task 1; sem suporte, gravar em JSON atômico como `writeJsonAtomic`.

## Review Focus

- Pedido forjado com cabeçalho `cf-*` pela rede local tentando rota v1: exige token do mesmo jeito.
- Mesmo `operationId` com corpo diferente: 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`, sem efeito.
- Queda do processo entre aplicar e registrar: ao reiniciar, a operação fica `UNKNOWN`, nunca `APPLIED` por suposição.
- Escrita pelo Windows durante a edição no app: revisão sobe em `saveSession` e o comando antigo recebe 409.
- App volta do segundo plano com dados velhos: botões de escrita ficam desativados até novo estado.

---

### Task 1: Pré-requisitos e armazenamento

**Files:**
- Create: `lib/app-v1/store.ts`, `tests/app-v1/store.test.ts`

**Interfaces:**
- Produces: `abrirStore(caminho: string): AppStore`, com tabelas `usuarios`, `sessoes`, `operacoes`, `auditoria`.

- [ ] **Step 1: Ler a versão do Node no ORBITS** por `ssh orbits` e registrar a decisão de armazenamento no ledger.
- [ ] **Step 2: Escrever testes** `cria tabelas uma vez`, `reabre sem perder dados`, `auditoria só aceita inserção`.
- [ ] **Step 3: Rodar** `npx vitest run tests/app-v1/store.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implementar** em `data/app-operacional/app.db`, fora do Git.
- [ ] **Step 5: Rodar de novo.** Expected: PASS. Commit.

### Task 2: Login, sessão e perfis

**Files:**
- Create: `lib/app-v1/auth.ts`, `tests/app-v1/auth.test.ts`

**Interfaces:**
- Produces: `login(store, usuario, senha, deviceId): Tokens`, `renovar(store, refresh): Tokens`, `sair(store, sessaoId)`, `autenticar(store, header): Identidade | null`, `pode(perfil, capacidade): boolean`, com capacidades da matriz PRD 5.2.

- [ ] **Step 1: Escrever testes**: senha errada recusada; refresh reutilizado revoga a família; bloqueado recusado no pedido seguinte; 5 erros seguidos atrasam o login; `pode('RECEPCAO','kart.trocar') === false`; `pode('OPERACAO','usuarios.gerir') === false`; `pode('GERENCIA','kart.trocar') === true`; nenhum perfil tem `recepcao.aprovar`.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar** com scrypt e HMAC em `APP_V1_TOKEN_SECRET`, que vem do ambiente. Sem ele, o módulo responde 503.
- [ ] **Step 4: Rodar.** Expected: PASS. Commit.

### Task 3: Motor de comandos, idempotência e auditoria

**Files:**
- Create: `lib/app-v1/comandos.ts`, `tests/app-v1/comandos.test.ts`

**Interfaces:**
- Consumes: `AppStore`, `Identidade`, `pode`.
- Produces: `executar(ctx, { operationId, sessionId, expectedSessionRevision, command, payload, reason }, handler): Resposta`; `consultarOperacao(store, id, identidade)`; `filaPorBateria(sessionId, fn)`.

- [ ] **Step 1: Escrever testes** T19, T20, T21, T35 do PRD: três envios aplicam uma vez; `PENDING` encontrado no reinício vira `UNKNOWN`; corpo diferente gera `IDEMPOTENCY_PAYLOAD_MISMATCH`; revisão antiga gera `REVISION_CONFLICT`; dois comandos na mesma bateria rodam em série; cada resultado gera uma linha de auditoria com os campos PRD 15.3.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar**, gravando `PENDING` antes do handler e `APPLIED`/`REJECTED` depois.
- [ ] **Step 4: Rodar.** Expected: PASS. Commit.

### Task 4: Revisão e rotas no servidor

**Files:**
- Modify: `services/timing-server.ts` (`saveSession`, e um ponto antes do bloqueio de internet)
- Create: `lib/app-v1/rotas.ts`, `tests/app-v1/rotas.test.ts`

**Interfaces:**
- Produces: `tratarAppV1(req, res, url, deps): Promise<boolean>`; `revisaoDa(sessionId): number`; rotas `/auth/*`, `/me`, `/sessions`, `/sessions/{id}`, `/operations/{id}`, `/audit`, `/users`, `/events`.

- [ ] **Step 1: Escrever testes**: T22, T24, T25; sem token 401; Recepção em `/users` 403; `/sessions/{id}` traz `sessionRevision`; revisão sobe a cada `saveSession`; rota fora de `/api/app/v1` pela internet segue 403.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar** com acréscimo mínimo: `Set` de revisões em `saveSession` e uma linha de roteamento. Só `/api/app/v1/` escapa do bloqueio, e sempre com `tratarAppV1`. `/events` reaproveita `stateView()`, com `revision` no evento e batida a cada 15 s.
- [ ] **Step 4: Rodar** essa suíte e `npx vitest run tests/app-operacional-baseline.test.ts tests/timing-sse.test.ts`. Expected: PASS, com baseline 10/10. Ajustar a baseline só se o texto procurado mudar, nunca o comportamento. Commit.

### Task 5: Worker público

**Files:**
- Create: `workers/app-operacional/src/index.ts`, `workers/app-operacional/wrangler.jsonc`, `tests/app-v1/worker.test.ts`

**Interfaces:**
- Produces: `https://operacao.kartodromodebetim.com.br/api/app/v1/*` → origem pelo túnel, com `x-app-v1-gateway` vindo de segredo.

- [ ] **Step 1: Escrever testes**: só repassa `/api/app/v1/`; demais 404; limite de login por IP; `/events` passa em fluxo, sem acumular; origem fora responde `503 UNAVAILABLE` (T32); cabeçalho de gateway do cliente é substituído.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar.** Sem deploy.
- [ ] **Step 4: Rodar.** Expected: PASS. Commit.

### Task 6: App Expo: base, login e estado

**Files:**
- Create: repositório `PROJETOS/kartodromo-operacional`, com a estrutura do PRD 20; identificadores `br.com.kartodromobetim.operacional`

**Interfaces:**
- Consumes: rotas da Task 4.
- Produces: `src/core/api`, `src/core/realtime`, `src/core/security`, `src/features/auth`, `src/core/design-system`.

- [ ] **Step 1: Criar** o projeto nas versões confirmadas (Expo `~57.0.31`, React Native `0.86.3`) e copiar tokens visuais e `motion.tsx` do app de clientes.
- [ ] **Step 2: Escrever testes**: renovação única com pedidos simultâneos; token nunca em `AsyncStorage`; 401 sai para o login; evento repetido ou fora de ordem não regride revisão (T27); volta do segundo plano recarrega antes de liberar escrita; lacuna de revisão pede estado completo.
- [ ] **Step 3: Rodar** `npx jest`. Expected: FAIL.
- [ ] **Step 4: Implementar** login, navegação por perfil, barra de conexão e tela de baterias só de leitura.
- [ ] **Step 5: Rodar** `npx jest`. Expected: PASS. Conferir no simulador iOS e no emulador Android contra o servidor local em `SIMULATE`. Commit.

### Task 7: Gate G1

**Files:**
- Create: `docs/app-operacional/G1_RELATORIO.md`

- [ ] **Step 1: Rodar** toda a suíte dos dois repositórios. Expected: nenhuma falha nova; a de `Caixa.cs` pode continuar.
- [ ] **Step 2: Revisão independente de segurança** do diff completo.
- [ ] **Step 3: Listar** o que precisa de autorização: subir no ORBITS, criar domínio e Worker, criar o primeiro usuário Gerência. Compilar e testar os programas Windows antes de qualquer publicação deles.
- [ ] **Step 4: Pedir o aceite do G1.** Só depois vem o plano F2.

---

## Depois da F1
Implementar a regra de cadastro completo na reserva, em site, app de clientes e testes juntos (`docs/alinhamento/RELATORIO.md`).

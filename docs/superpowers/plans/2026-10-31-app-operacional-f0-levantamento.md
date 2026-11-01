# App Operacional — F0 Levantamento e Baseline: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar com evidências como produção, Windows, recepção e APK 1.6 funcionam, e congelar esse comportamento em testes de regressão, sem publicar nada (gate G0).

**Architecture:** Só leitura na produção via `ssh orbits`; o único código novo são testes de contrato contra `services/timing-server.ts` em modo simulado, local. Cada entrega é um documento com evidência (arquivo:linha, hash ou saída de comando) em `docs/app-operacional/`.

**Tech Stack:** PowerShell remoto (somente leitura), Node/TypeScript, Vitest (confirmar o runner dos testes em `tests/` no Task 1), jadx ou strings para o APK.

**Spec:** `docs/superpowers/specs/2026-10-31-app-operacional-prd.md` (D01–D03 aceitas em 31/10/2026; seções 3.3, 18.1 F0, 19 E0, 22).

## Global Constraints

- Produção: **somente leitura**. Proibido deploy, reinício de serviço, escrita em banco ou arquivo remoto, `POST/PUT/PATCH/DELETE` em produção.
- Nunca copiar para documentos: senhas, tokens, chaves, connection strings, dados pessoais de pilotos. Configuração só com valores não secretos.
- Nenhum arquivo existente de `services/`, `lib/`, `desktop/`, `workers/` pode mudar nesta fase.
- O repositório tem cerca de 179 arquivos alterados por outras frentes: `git add` só com caminhos exatos desta fase.
- Afirmação sem evidência vai marcada `NÃO VERIFICADO`. Fatos do PRD só viram verdade com arquivo:linha ou saída real.
- Testes nunca apontam para produção; usar servidor local com `SIMULATE` e diretório de dados temporário.

## Review Focus

- Produção diferente do repositório na rota de troca ou sorteio: o documento registra a produção como referência e a baseline marca o teste como divergente, sem "corrigir" nenhum lado.
- Inscrito com `aprovada=1` e sem pagamento ou termo: o Task 3 precisa de um exemplo real agregado (só contagens) antes de concluir o predicado.
- Bateria sem vínculo com a recepção (`agendaId` nulo): coberta no Task 3 e na baseline do Task 6.
- Bateria de programa com várias provas: troca e sorteio propagam às irmãs; baseline do Task 6 verifica as duas sessões.
- Comando repetido após timeout: Task 4 registra quais rotas duplicam efeito (penalidade duplica, por exemplo), pois F1 depende disso.

---

### Task 1: Retrato da produção e diferenças com o repositório (E0-01, itens 1, 2, 11, 12)

**Files:**
- Create: `docs/app-operacional/INVENTARIO_PRODUCAO.md`

**Interfaces:**
- Produces: seções "Serviços", "Versões", "Diferenças", "Backup e janela de deploy"; caminho remoto de `timing-server` usado pelos Tasks 2 a 5.

- [ ] **Step 1: Listar serviços, portas e processos** com `ssh orbits` e PowerShell: `Get-Service`, `Get-Process node`, `Get-NetTCPConnection -State Listen` (a sessão remota é PowerShell; não usar `&` no estilo cmd). Registrar nome, porta e caminho, sem variáveis de ambiente.
- [ ] **Step 2: Calcular hash remoto** com `Get-FileHash` dos arquivos implantados equivalentes a `services/timing-server.ts`, `services/ops-server.ts` e `lib/timing/*`, mais versão dos executáveis Windows. Se a produção rodar pacote gerado, comparar o pacote e registrar.
- [ ] **Step 3: Comparar com o local** e o commit correspondente; listar cada diferença em tabela `arquivo | diferença | afeta o app?`. Copiar remoto apenas para o scratchpad, nunca para o repositório.
- [ ] **Step 4: Registrar versões do app base**: Expo, React Native e Expo Router de `kartodromo-app-ios/package.json` e lockfile.
- [ ] **Step 5: Registrar backup, restauração e janela segura** a partir de scripts e tarefas agendadas; o que não for encontrado fica `NÃO VERIFICADO`.
- [ ] **Step 6: Commit**

```bash
git add docs/app-operacional/INVENTARIO_PRODUCAO.md
git commit -m "docs(app-operacional): inventariar producao e diferencas"
```

### Task 2: Matriz de paridade Windows → rota → efeito (E0-02)

**Files:**
- Create: `docs/app-operacional/CONTRATOS_LEGADOS.md`

**Interfaces:**
- Consumes: diferenças do Task 1.
- Produces: tabela com colunas `comando | tela Windows (arquivo:linha) | chamadas em ordem | payload | respostas e erros | efeitos | idempotente? | reversível? | decisão v1`; usada por todos os planos seguintes.

- [ ] **Step 1: Cobrir cada comando da seção 9 do PRD**: troca, penalidade, retirada, bandeira por piloto e geral, largar, quadriculada, encerrar, cancelar, reiniciar, relargar, passagens (todas as ações), incluir e retirar volta, ajustar posição, registro de competidor, remontar, transponder, resultado por e-mail, equalização completa.
- [ ] **Step 2: Registrar chamadas compostas**, como a troca, que faz `swap-kart` e depois `observations` (`FormCrono.Cadastros.cs:374-381`). Registrar também regra só de tela: padrão Tabajara (`:357`) e autor fixo `Cronometragem` na retirada de penalidade (`timing-server.ts`, rota `penalties`).
- [ ] **Step 3: Conferir bloqueios da troca**: kart ocupado, em manutenção, categoria (`swapKart` em `lib/timing/race-engine.ts`). Registrar o que o legado bloqueia; a rota nova aplica o restante do PRD 8.2 sem mudar a antiga.
- [ ] **Step 4: Marcar a decisão v1** de cada comando: `expor`, `expor com adaptador` ou `oculto (motivo)`. Fora do v1, seção 9.4 do PRD.
- [ ] **Step 5: Commit**

```bash
git add docs/app-operacional/CONTRATOS_LEGADOS.md
git commit -m "docs(app-operacional): mapear contratos e paridade do Windows"
```

### Task 3: Elegibilidade real (E0-03, item 6)

**Files:**
- Create: `docs/app-operacional/ELEGIBILIDADE.md`

**Interfaces:**
- Produces: predicado final `elegivel(inscricao, bateria) -> ELEGIVEL | INELEGIVEL | INDETERMINADA`, em prosa e tabela-verdade, usado no plano F2.

- [ ] **Step 1: Ler o fluxo oficial**: `desktop/src/Kartodromo.Recepcao/Acoes.cs` (`AprovarPre`, tela com aprovada/paga/termo, linhas 12-16 e 391-406), `/api/office/reservas/*` e o grid em `services/ops-server.ts:1005`.
- [ ] **Step 2: Responder com evidência**: aprovar exige pagamento? exige termo? quais exceções? cortesia? totem? pré-reserva do app?
- [ ] **Step 3: Medir na produção, só SELECT agregado**, sem nomes: contagem de inscrições por combinação `Aprovada/Pago/termo/Status` dos últimos 30 dias. Usar a ferramenta local já existente de leitura; sem acesso somente leitura ao banco, marcar `NÃO VERIFICADO` e pedir ao dono.
- [ ] **Step 4: Definir o caso sem vínculo com a recepção** e como detectá-lo (`agendaId` nulo), sem filtro nas rotas antigas.
- [ ] **Step 5: Reproduzir o bug**: documentar por leitura de `/api/agenda/:id/preparar` que todos os inscritos entram na sessão. A prova executável vem no Task 6.
- [ ] **Step 6: Commit** `docs/app-operacional/ELEGIBILIDADE.md` com mensagem `docs(app-operacional): definir elegibilidade por evidencia`.

### Task 4: Estados, concorrência e tempo real (E0-04, itens 4, 7, 8, 9)

**Files:**
- Create: `docs/app-operacional/ESTADOS_E_CONCORRENCIA.md`

**Interfaces:**
- Produces: tabela `estado do app (PRD 6) ↔ state real do servidor`; lista de transições; decisão sobre `sessionRevision`; dados consumidos pelo plano F1.

- [ ] **Step 1: Mapear `state` e transições** em `lib/timing/race-engine.ts` e `timing-server.ts`, incluindo relargada, bandeira vermelha e reabertura. Estados do PRD sem equivalente real (`PRONTA`, `SORTEIO_RASCUNHO`) são marcados como apenas do app.
- [ ] **Step 2: Documentar persistência**: como `saveSession` grava, se há transação, o que acontece em queda de processo e como IDs de sessão, passagem e competidor nascem.
- [ ] **Step 3: Verificar revisão e SSE**: `/api/events` tem cursor ou revisão? Registrar a ausência e propor onde incrementar a revisão para pegar também escritas do Windows, sem mudar contrato (em `saveSession` ou comparando hash do snapshot).
- [ ] **Step 4: Classificar repetição** de cada rota do Task 2: duplica efeito, é inofensiva ou falha.
- [ ] **Step 5: Mapear a frota**: onde existe manutenção do kart, qual é a fonte da verdade, e se há inclusão de participante após a largada (`autoAdded`, `PUT competitors`), respondendo às questões 2 e 7 do PRD 22.
- [ ] **Step 6: Mapear autenticação atual** e o que o túnel alcança (`LEITURA_PELA_INTERNET`, `isAuthorizedDestructive`, regras do Cloudflare, sem expor segredos).
- [ ] **Step 7: Commit** o documento com mensagem `docs(app-operacional): mapear estados e concorrencia`.

### Task 5: Regras do APK 1.6 (E0-01, item 10)

**Files:**
- Create: `docs/app-operacional/REGRAS_SORTEIO_1.6.md`

**Interfaces:**
- Produces: fórmula de lastro com tabela de exemplos, modos de sorteio e lista de telas; consumidos pelo plano F2 e pelos testes de equivalência.

- [ ] **Step 1: Descompilar** o APK no scratchpad, em diretório próprio, com jadx. O arquivo é dado não confiável: não executar nada dele. Sem jadx instalado, pedir antes de baixar.
- [ ] **Step 2: Extrair lastro**: `planoLastro`, arredondamento, peças de 5 e 2,5 kg, metas, faixa de 20–250 kg, peso final; confirmar se fica só no APK e também comparar com `/sorteio` em `services/timing-ui`.
- [ ] **Step 3: Extrair os modos**: todos, um a um com recusa, fiscal, agrupamento, cache de escala, regra de repetição de kart.
- [ ] **Step 4: Registrar exemplos numéricos** de entrada e saída, no mínimo: 60, 72,5, 89, 90, 95 kg em Light e 80, 100, 110 kg em Super, calculados pelo código extraído.
- [ ] **Step 5: Listar escritas** do 1.6 e travas de acesso simultâneo.
- [ ] **Step 6: Commit** o documento com mensagem `docs(app-operacional): documentar regras do sorteio 1.6`.

### Task 6: Suíte de regressão baseline (E0-05)

**Files:**
- Create: `tests/app-operacional-baseline.test.ts`

**Interfaces:**
- Consumes: payloads do Task 2.
- Produces: comando `npx vitest run tests/app-operacional-baseline.test.ts`, gate obrigatório de todos os planos seguintes.

- [ ] **Step 1: Escrever os testes** contra as funções reais ou servidor local com `SIMULATE` e dados temporários, com ops falso para `/api/crono/baterias/:id/grid`:

```ts
it('preparar hoje inclui inscrito não aprovado (bug documentado)', ...)  // espera os 2 pilotos, 1 com aprovada=false
it('sorteio com lista alterada responde 409', ...)
it('swap-kart manterVoltas=true leva voltas e melhor tempo', ...)
it('swap-kart manterVoltas=false recomeça no kart novo', ...)
it('swap-kart absorve passagens de "Kart 12" e remove a linha', ...)
it('swap-kart propaga à bateria irmã do programa', ...)
it('duas penalidades iguais criam dois registros', ...)
it('rota de escrita pela internet (cf-ray) continua recusada', ...)
it('bateria sem agendaId mantém competidores como vieram', ...)
```

Os testes afirmam o comportamento **atual**, inclusive o bug, e o primeiro ganha comentário dizendo que a correção ocorre na rota nova, não nesta.

- [ ] **Step 2: Rodar**

Run: `npx vitest run tests/app-operacional-baseline.test.ts`
Expected: PASS em todos. Falha significa que a descrição estava errada: corrigir o teste e o documento, nunca o servidor.

- [ ] **Step 3: Rodar a suíte existente** de `tests/timing-*.test.ts` e registrar o resultado no inventário.
- [ ] **Step 4: Commit**

```bash
git add tests/app-operacional-baseline.test.ts docs/app-operacional/INVENTARIO_PRODUCAO.md
git commit -m "test(app-operacional): congelar comportamento atual da cronometragem"
```

### Task 7: Gate G0 e roteiro das próximas fases

**Files:**
- Create: `docs/app-operacional/G0_RELATORIO.md`

- [ ] **Step 1: Responder às 10 questões do PRD 22**, cada uma com evidência ou `NÃO VERIFICADO`.
- [ ] **Step 2: Listar o que muda no PRD**, por exemplo funções a desligar por falta de suporte (entrada após largada).
- [ ] **Step 3: Pedir ao dono o aceite do G0.** Só então escrever os planos seguintes.
- [ ] **Step 4: Commit** do relatório com mensagem `docs(app-operacional): relatorio do gate G0`.

---

## Roteiro depois do G0 (um plano por fase)

| Fase | Plano | Backlog PRD | Gate |
|---|---|---|---|
| F1 | Plataforma: app Expo, login, perfis, `/api/app/v1`, HTTPS, idempotência, revisão, auditoria, eventos | E1-01 a E1-09 | G1 |
| F2 | Sorteio: elegíveis, sorteio, lastro, atrasados, recepção leitura, rascunho offline | E2-01 a E2-09 | G2 |
| F3 | Pista e direção: troca, penalidade, bandeira, frota, ao vivo, comandos de prova | E3-01 a E3-08 | G3 |
| F4 | Avançado: passagens, equalização, painel do dono, usuários, auditoria | E3-07, E4-01 a E4-04 | G4 |
| F5 | Implantação: T01–T40, builds internos, treino, canário, rollback, aposentar 1.6 | E4-05 a E4-08 | G5 |

Cada publicação no servidor exige autorização do dono e ocorre fora do horário de bateria.

# Alinhar Produção e Repositório: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter no Git um único histórico contendo exatamente o que roda em produção mais as melhorias válidas, sem reiniciar nem alterar a produção.

**Architecture:** Primeiro congelar a produção em uma branch local (`snapshot/producao-AAAA-MM-DD`). Depois comparar as três versões e decidir cada diferença em uma matriz. Por fim, montar `alinhamento/base-app` a partir do snapshot, trazendo só o que for aprovado. A publicação é etapa separada, com autorização do dono.

**Tech Stack:** Git, ssh/tar pelo `orbits`, Vitest, dotnet para os programas Windows.

**Spec:** `docs/app-operacional/G0_RELATORIO.md`, pendência 1; `docs/superpowers/specs/2026-10-31-app-operacional-prd.md`, A17 e F0.

## Global Constraints

- Produção: somente leitura em todo o plano, exceto se o dono autorizar por escrito a Task 5. Sem `git` de escrita, sem reinício, sem arquivo novo no servidor.
- Baixar sempre com `tar` para a saída padrão pelo ssh; nada de arquivo temporário remoto.
- Nunca incluir em commit: `.env*` (salvo `.env.example`), `data/`, `node_modules/`, `._*`, chaves, bancos, logs, cadastros de pessoas.
- Nenhum `git push` sem autorização do dono. Nenhum `reset`, `checkout --` ou `stash` nos arquivos pendentes da máquina de desenvolvimento.
- Regra de desempate: a produção vence, salvo decisão registrada. Proteção de segurança nunca é retirada.

## Review Focus

- Arquivo novo em produção com senha ou dado pessoal: varredura da Task 1 impede o commit e a ocorrência é relatada só por caminho, sem o valor.
- Produção alterada durante a cópia: a Task 1 compara o hash antes e depois de `timing-server.ts`; se mudou, repete.
- Fim de linha CRLF em Windows: comparações ignoram CR, para não virar falsa diferença.
- Migração em `migrations/` que só existe em um lado: a matriz registra se já foi aplicada; nenhuma é executada neste plano.
- Teste que passa em uma versão e falha em outra: entra na matriz como evidência, sem ser apagado.

---

### Task 1: Congelar a produção

**Files:**
- Create: branch `snapshot/producao-AAAA-MM-DD`, em worktree separado `../KARTODROMO-snapshot`, a partir de `78b401b`
- Create: `docs/alinhamento/SNAPSHOT.md`

**Interfaces:**
- Produces: branch usada em todas as outras tarefas.

- [ ] **Step 1: Registrar hash remoto** de `services/timing-server.ts` e `git status --short` da produção.
- [ ] **Step 2: Baixar por fluxo** com `git ls-files -m -o --exclude-standard` da produção como lista, excluindo os padrões proibidos, usando `tar -cf - -T -` pelo ssh para o scratchpad. A lista é passada sem gravar no servidor.
- [ ] **Step 3: Varrer segredos** no conteúdo baixado (`password`, `pwd=`, `secret`, `token`, `BEGIN .* KEY`, `AKIA`, CPF em massa). Arquivo suspeito fica fora do commit e é listado por caminho em `SNAPSHOT.md`.
- [ ] **Step 4: Verificar:** hash remoto igual ao do Step 1 e `sha256` de cada arquivo baixado igual ao remoto, após ignorar CR.

Expected: zero divergências; se o hash mudou, repetir desde o Step 1.

- [ ] **Step 5: Commit** no worktree do snapshot, só com caminhos da lista: `chore(snapshot): congelar codigo em producao`. Sem push: essa cópia só existe na máquina de desenvolvimento até a Task 5.

### Task 2: Matriz de diferenças

**Files:**
- Create: `docs/alinhamento/MATRIZ.md`

**Interfaces:**
- Consumes: branch do Task 1.
- Produces: tabela `arquivo | snapshot × origin/main | snapshot × f5108f6 | pendente local? | risco | decisão | motivo`.

- [ ] **Step 1: Atualizar referências locais** com `git fetch origin` e registrar o `origin/main`. Só leitura em relação ao GitHub.
- [ ] **Step 2: Gerar a tabela** com `git diff --ignore-space-at-eol --stat` entre as três pontas, mais o `git diff` dos pendentes locais; arquivos novos entram também.
- [ ] **Step 3: Classificar por risco:** Alto para `services/`, `lib/timing`, `lib/ops`, `migrations/`, `workers/`, `desktop/`; Baixo para documentos e scripts sem uso em produção.
- [ ] **Step 4: Decidir** cada arquivo de risco Alto lendo o diff: `produção`, `desenvolvimento`, `combinar` ou `dono decide`. Já conhecidos: manter `operator-auth`, `redact-pii`, `agenda-saida`; não adotar kart alfanumérico nem largada parada no alinhamento, por mudarem comportamento.
- [ ] **Step 5: Commit** do documento.

### Task 3: Montar a base alinhada

**Files:**
- Create: branch `alinhamento/base-app`, a partir do snapshot
- Modify: apenas o que a matriz marcar como `desenvolvimento` ou `combinar`

- [ ] **Step 1: Registrar a baseline de testes do snapshot** com `npx vitest run` e `BASELINE_ROOT` vazio, salvando as falhas pré-existentes em `docs/alinhamento/TESTES.md`.
- [ ] **Step 2: Aplicar** cada decisão como commit pequeno, referenciando a linha da matriz.
- [ ] **Step 3: Trazer** `tests/app-operacional-baseline.test.ts` e `docs/app-operacional/`, e rodar:

Run: `npx vitest run tests/app-operacional-baseline.test.ts`
Expected: 10/10.

- [ ] **Step 4: Rodar a suíte completa e o build dos programas Windows.**

Expected: nenhuma falha nova em relação ao Step 1; `dotnet build` sem erro, se o SDK estiver disponível. Sem SDK, registrar como não verificado.

### Task 4: Revisão e pedido de decisão

**Files:**
- Create: `docs/alinhamento/RELATORIO.md`

- [ ] **Step 1: Listar** o que muda de comportamento em relação à produção. A expectativa é uma lista curta e justificada.
- [ ] **Step 2: Revisão independente** do diff `snapshot..alinhamento/base-app`.
- [ ] **Step 3: Corrigir** achados críticos e importantes, com teste.
- [ ] **Step 4: Entregar ao dono** a lista de decisões e pedir autorização para a Task 5.

### Task 5: Publicar no Git (exige autorização expressa do dono)

- [ ] **Step 1: Enviar** `snapshot/*` e `alinhamento/base-app` ao GitHub, em repositório privado confirmado, sem força e sem mexer em `main`.
- [ ] **Step 2: Abrir PR** para `main`.
- [ ] **Step 3: Definir** com o dono como a produção passa a seguir o Git: janela fora de bateria, cópia de segurança e reversão. Isso vira plano próprio; a produção não muda aqui.

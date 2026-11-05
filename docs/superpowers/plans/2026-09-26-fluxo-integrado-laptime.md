# Fluxo Integrado Kartódromo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar e corrigir o fluxo do Autoatendimento até a aprovação na Recepção e a cronometragem, comparando as telas com as referências LapTime arquivadas.

**Architecture:** A inscrição autorizada percorre o serviço de operações e a API da Recepção em produção; a cronometragem é exercitada em instância isolada com dados temporários e simulador, consultando somente a grade operacional. A interface instalada será comparada às capturas LapTime e os defeitos confirmados receberão correção mínima e regressão automatizada.

**Tech Stack:** TypeScript/Node, SQL Server, Vitest, .NET 8/WinForms, PowerShell/WinRM, APIs HTTP e simulador do decoder.

**Spec:** `C:\KARTODROMO\01_AUTOATENDIMENTO_FLUXO.md`, `C:\KARTODROMO\02_OFFICE_RECEPCAO_FLUXO.md`, `C:\KARTODROMO\12_TESTES_INTEGRADOS_PRODUCAO.md`, `C:\KARTODROMO\16_ESPECIFICACAO_UXUI_COMPLETA.md`, referências em `C:\KARTODROMO\prints\`.

## Global Constraints

- Os testes integrados anteriores foram feitos em janela sem corrida e restaurados ao estado inicial (`C:\KARTODROMO\12_TESTES_INTEGRADOS_PRODUCAO.md`).
- A validação de cronometragem não alterna o decoder físico; usa simulador em porta e diretório temporários.
- Não registrar venda, pagamento ou movimento de caixa.
- Não alterar `data/timing` nem dados reais de inscrições fora do registro de teste autorizado.
- Não incluir CPF, nome, token ou credencial nos artefatos, capturas ou saída dos testes.

## Review Focus

- CPF já cadastrado: reutilizar a pessoa existente e impedir duplicação; confirmar que a inscrição chega à Recepção.
- Consentimento e bloqueio: cadastro apto prossegue; cadastro bloqueado ou sem consentimento recebe a resposta prevista, sem revelar dados.
- Bateria sem vaga, fechada ou repetida: API rejeita com erro claro e não cria outra inscrição.
- Grade sem kart ou com kart repetido: cronometragem preserva participantes e valida as regras de largada.
- Decoder indisponível e bateria ativa em paralelo: tela informa a condição e a instância de teste não perturba sessões reais.

---

### Task 1: Baseline dos serviços, telas e testes

**Files:**
- Read: `services/ops-server.ts`, `lib/ops/office.ts`, `services/timing-server.ts`, `services/timing-ui/operador.html`, `desktop/src/Kartodromo.Autoatendimento/`, `desktop/src/Kartodromo.Recepcao/`, `desktop/src/Kartodromo.Cronometragem/`
- Read: `C:\KARTODROMO\prints\autoatendimento\`, `C:\KARTODROMO\prints\recepcao\`, `C:\KARTODROMO\prints\timing\`

**Interfaces:**
- Consumes: endpoints implantados de saúde, agenda, identificação e sessões; aplicações remotas atuais.
- Produces: baseline sanitizado (versões, disponibilidade, telas, quantidade de sessões) e lista de falhas reproduzidas.

- [x] Rodar `npm test`, `npm run typecheck` e build da solução Desktop no worktree; registrar saídas e falhas sem expor configuração.
- [x] Conferir saúde dos serviços, configuração do totem, baterias/vagas, aplicações instaladas e decoder; não iniciar sessão no serviço de produção.
- [x] Comparar telas de autoatendimento, recepção e cronometragem com as referências LapTime equivalentes; registrar diferenças objetivas.

### Task 2: Autoatendimento → Recepção

**Files:**
- Exercise: `POST /api/totem/identificar`, `GET /api/totem/baterias`, `POST /api/totem/inscrever`, `GET /api/office/reservas`, `POST /api/office/reservas/:id/aprovar`
- Verify: `GET /api/crono/baterias/:id/grid`

**Interfaces:**
- Consumes: cliente existente e elegível; bateria aberta com vaga; sessão autenticada da Recepção.
- Produces: uma pré-reserva aprovada e visível na grade, identificada internamente pelo ID da inscrição.

- [x] Consultar identificação sem imprimir nome, documento, token ou contato; confirmar consentimento, nascimento e bloqueio.
- [x] Criar uma inscrição pela rota de autoatendimento em bateria futura disponível; guardar somente IDs necessários ao teste.
- [x] Localizar a pré-reserva em `Reservas > Aprovar`, aprovar pela Recepção e confirmar status e vínculo cliente/bateria.
- [x] Confirmar que a inscrição aprovada aparece uma única vez na grade da cronometragem e que nenhuma venda ou pagamento foi gerado.

### Task 3: Grade → cronometragem simulada → resultado

**Files:**
- Exercise: `services/timing-server.ts`, `services/timing-ui/operador.html`, `lib/timing/`
- Test data: diretório temporário isolado fora de `data/timing`

**Interfaces:**
- Consumes: ID da bateria e inscrição aprovadas pela Task 2; API operacional apenas em leitura.
- Produces: sessão simulada local, passagens/laps calculadas, bandeira final e resultado acessível pela UI/API local.

- [x] Iniciar uma instância de timing em porta própria, com `TIMING_SIMULATE=1`, decoder local simulado e diretório temporário.
- [x] Carregar a bateria aprovada pela agenda e conferir a grade importada sem iniciar nem editar sessões de produção.
- [x] Simular passagens, iniciar, encerrar com quadriculada e fechar; validar contagem, tempos, ordenação e tela de resultado.
- [x] Confirmar via health/status que as quatro sessões reais e o decoder físico mantiveram seu estado inicial.

### Task 4: Correções de defeitos reproduzidos

**Files:**
- Modify only the smallest affected source and test files under `services/`, `lib/`, `desktop/src/`, and `tests/`.

**Interfaces:**
- Consumes: falhas reproduzidas nas Tasks 1–3 e contratos documentados acima.
- Produces: correções com teste de regressão que falha antes e passa depois.

- [x] Para cada defeito reproduzido dentro destes fluxos, escrever primeiro um teste específico, executar e registrar a falha original.
- [x] Aplicar a menor correção compatível com os fluxos LapTime documentados; não fazer refatoração lateral.
- [x] Reexecutar o teste de regressão e depois `npm test`, `npm run typecheck`, lint/build aplicáveis e build Desktop.
- [x] Repetir o trecho integrado afetado e registrar resultado, sem afirmar sucesso a partir apenas do teste local.

### Task 5: Atualizar a recepção instalada

**Files:**
- Publish: `desktop/src/Kartodromo.Recepcao/Kartodromo.Recepcao.csproj` → `desktop/publish/Recepcao/`
- Deploy: `scripts/apps/implantar-remoto.ps1`, `scripts/apps/instalar-desktop.ps1`
- Backup: executável e configuração atuais de `192.168.20.53`, sob `C:\KARTODROMO\backups\`

**Interfaces:**
- Consumes: pacote validado na Task 4; caixa fechado; estado sem sessão de cronometragem em andamento.
- Produces: recepção executando o mesmo ProductVersion/hash do pacote, API conectada e captura inicial da tela.

- [x] Copiar o executável e a configuração atuais para uma pasta de backup única; conferir o alvo antigo `C:\KartodromoApps\Recepcao` antes de executar o instalador.
- [x] Publicar o app Recepção do `HEAD` deste worktree como single-file `win-x64` e confirmar ProductVersion/hash local.
- [x] Atualizar `192.168.20.53` pelo script existente; capturar a tela inicial e validar ProductVersion/hash remoto.
- [x] Confirmar o processo da Recepção e a saúde da API; registrar que o aplicativo inicia na tela normal de login.

> A captura `C:\KARTODROMO\backups\recepcao-atualizado-login-20260926.png` ficou coberta pela janela do Codex e exibiu conteúdo da área de trabalho. Não será compartilhada. A remoção da captura foi bloqueada pela revisão automática de segurança.
### Task 6: Limpeza e conferência final

**Files:**
- Exercise: `DELETE /api/office/reservas/:id` para cancelar a inscrição não paga de teste.
- Remove: diretório temporário desta execução, após conferir o caminho absoluto.

**Interfaces:**
- Consumes: IDs registrados na Task 2 e diretório temporário da Task 3.
- Produces: inscrição de teste cancelada, scratch removido, serviços e sessões de produção sem alteração.

- [x] Cancelar somente a inscrição criada nesta execução e confirmar `Status=cancelada`, sem apagar cliente ou histórico financeiro.
- [x] Conferir que não houve venda, pagamento ou movimento de caixa e que agenda/grade não listam a inscrição como ativa.
- [ ] Remover o diretório temporário somente depois de validar que ele está dentro do diretório de teste desta execução.
- [x] Registrar no resumo os passos aprovados, falhas corrigidas, limitações e ID da inscrição cancelada.

> A remoção de `C:\KARTODROMO\backups\e2e-laptime-20260926-062250\timing-data` também foi bloqueada pela revisão automática de segurança. O simulador foi parado e a porta 4150 está fechada; o scratch permanece apenas como arquivo local desta execução.

## Resultado verificado — 2026-09-26

- Autoatendimento → aprovação na recepção → grade do operador concluído com a inscrição de teste `67312`; a prévia do termo respondeu 200. A inscrição foi cancelada ao final, sem venda, pagamento ou movimento de caixa.
- Cronometragem local simulada: sessão encerrada com quadriculada, 3 voltas e resultado acessível. Decoder de produção permaneceu conectado em modo físico; as 4 sessões reais continuaram encerradas.
- Recepção em `192.168.20.53` atualizada para `1.0.0+9d2ebf3293953547f043b95c92c14134509a37bf`; hash local/remoto idêntico. Backup anterior em `C:\KARTODROMO\backups\recepcao-pre-atualizacao-20260926-0631`.
- Corrigido `prefer-const` em `lib/timing/trx-parser.ts` mantendo o tratamento de overflow. `npm run lint`, `npm run typecheck` e 32 testes focados de cronometragem passaram. Desktop publicou/buildou.
- `npm test`: 266 aprovados; 1 falha já reproduzida no baseline, causada por 35 páginas `.dc.html` fora de sincronia com `design-source`, fora do fluxo operacional auditado.
- Não foi enviada impressão física; só a prévia do termo foi verificada. As referências Mac foram lidas da cópia local `C:\KARTODROMO\prints`.


## 2026-11-02T21:36:17Z

# Dispatch: Worker M2 — Baterias, Sorteio, Balança e Campeonatos (Falhas 08 a 22 + R2)

## Objetivo
Implementar com código de produção genuíno todas as correções e recursos de Milestone M2 (Falhas 08 a 22 e Requisito R2) no repositório `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`.

## Escopo e Arquivos de Posse Exclusiva
- `src/features/operacao/baterias.ts`: Falha 08 (exportar `normalizarChaveBateria` e unificar chave com regex `/\s*-\s*(?:tomada|corrida|treino).*$/i`).
- `src/features/operacao/sorteio.ts`: Falha 09 (preservar índice original `{ p, idx }` e restaurar ordenação em `sortear`, exportar `sortearComOrdemPreservada`).
- `src/features/operacao/formato.ts`: Falha 22 e R2 (exportar `arredondar1Casa`, `formatarNumero1Casa`, `calcularPlanoLastro`, `ajustarIncrementoPeso`).
- `src/app/bateria/[id].tsx`:
  - Falha 10: Sorteio avulso desbloqueado se recepção offline (`vinculadaRecepcao && !recepcaoDisponivel`).
  - Falha 11: Erro 409 preservando `previa`, atualizando `revisaoSorteio.current` e mantendo tela em `'conferir'`.
  - Falha 12: Recusar kart com swap inteligente e desabilitado somente quando não há candidatos.
  - Falha 13: Rótulo singular `'CONFIRMAR PILOTO ›'` quando `faltam.length <= 1 && modo === 'UM_A_UM'`.
  - Falha 14: Validação de `aptos.length` e `faltam.length` no botão de sorteio.
  - Falha 15: `pilotoSorteandoId` lock concorrente e `ActivityIndicator` no card do piloto.
  - Falha 16: Seleção de piloto por `pilotoId` persistente (`customerId || kartAtual || String(indice)`).
  - Falha 17: Botões +/- habilitados mesmo com `peso === null`.
  - Falha 18: +/- inicializando na meta da bateria/categoria a partir de nulo/zero.
  - Falha 19: Preservar foco `focado: boolean` com `onFocus`/`onBlur` no input de peso.
  - Falha 20 & R2: Meta dinâmica com seletor de metas [80, 90, 95, 100, 110 kg] e `obterMetaBateria`.
  - Falha 21: Banner de conclusão `'PESAGEM CONCLUÍDA ✓'` com atalho para o galpão.
  - Falha 22: Arredondamento padronizado a 1 casa decimal em todas as exibições de peso/lastro.
- `src/types/campeonatos.ts` & `src/app/campeonatos.tsx`: Requisito R2 (tela de campeonatos com 4 abas).
- `src/app/index.tsx`: Adicionar atalho de Campeonatos ao grid de módulos.

## Relatórios Técnicos dos Exploradores
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m2_3/handoff.md`

## Regras de Execução e Verificação
1. Executar `npm test` e `npm run tipos` (ou `npx tsc --noEmit`) em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`.
2. Garantir que 100% dos testes passem sem regressão.
3. NÃO tocar em telas de TV (`FormTV.cs` / `--tv`).
4. NUNCA colocar senhas ou credenciais em código ou logs.
5. Escrever relatório completo em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_1/handoff.md`.

## 2026-11-02T21:46:46Z
[Message from orchestrator_operacional_1]:
Olá worker_m2_1, o timer de segurança de 10 minutos foi acionado. Poderia nos atualizar sobre o status atual das implementações do Milestone M2 (Falhas 08 a 22 e Requisito R2)?

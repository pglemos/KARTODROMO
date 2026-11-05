# Dispatch: M2 Spec Miner 3 — Campeonatos & Metas de Lastro Customizadas (R2)

## Objetivo
Investigar a especificação, contratos e requisitos para o fluxo de Campeonatos e Lastros Customizados (R2) no backend e no frontend `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`.

## Escopo
- **Requisito R2 (Campeonatos & Lastros Personalizados)**:
  - Seleção dinâmica de metas de lastro (ex: 80, 95, 110 kg ou customizada por campeonato/categoria).
  - Como a meta da categoria se reflete na tela de pesagem da bateria (`bateria/[id].tsx`).
  - Tela/aba de Campeonatos (`src/app/campeonatos.tsx`): visualização de campeonatos, regulamento, tabela de pontuação e lastros configurados.
  - Endpoints e contratos no backend (`KARTODROMO`/`lib/app-v1/campeonatos.ts` ou rotas associadas) e mocks/integração no app operacional.

## Arquivos de Referência
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/lib/app-v1/`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/types/`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/campeonatos.tsx` (se existir ou onde deve ser adicionada)
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/bateria/[id].tsx`

## Entregável
Escrever relatório estruturado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m2_3/handoff.md`.


## 2026-11-02T21:27:01Z
Você é o spec_miner_m2_3 (M2 Campeonatos e Lastro Personalizado Spec Miner).
Seu diretório de trabalho exclusivo é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m2_3

LEITURA OBRIGATÓRIA ANTES DE INICIAR QUALQUER TRABALHO:
Leia na íntegra os arquivos:
1. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md
3. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m2_3/DISPATCH.md

Sua missão:
Investigar a especificação, contratos e requisitos para o fluxo de Campeonatos e Lastros Customizados (R2):
1. Seleção dinâmica de metas de lastro (ex: 80, 95, 110 kg ou customizada por categoria/campeonato) e sua propagação para as baterias.
2. Contratos no backend (`/Users/pedroguilherme/PROJETOS/KARTODROMO` e `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/`) referentes a campeonatos, categorias, regulamentos, pontuação e pesagem/lastro.
3. Design da tela e componentes de Campeonatos no frontend `/Users/pedroguilherme/PROJETOS/kartodromo-operacional` (ex: `src/app/campeonatos.tsx`, tipos em `src/types/`, rotas e navegação).
4. Integração da meta dinâmica na pesagem de `src/app/bateria/[id].tsx` (em conjunto com a Falha 20).

Aponte arquivos exatos, tipos, schemas, contratos de API e forneça a recomendação exata da especificação para guiar a implementação do Worker.
NÃO faça alterações de código nem execute builds — você é somente leitura.
Ao concluir, escreva seu relatório estruturado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m2_3/handoff.md` e envie uma mensagem informando a conclusão.

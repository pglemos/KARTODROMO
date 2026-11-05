# Dispatch: M2 Explorer 2 — Balança, Pesagem e Lastro (Falhas 16 a 22)

## Objetivo
Investigar as falhas da aba de pesagem e cálculo de lastro no app `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`, produzindo diagnósticos exatos, referências de linhas e propostas de correção / patch.

## Escopo
- **Falha 16**: Seleção de piloto por índice em vez de identificador persistente (`pilotoId`/kart), causando salto de seleção ao atualizar dados via SSE/polling (`bateria/[id].tsx`).
- **Falha 17**: Incremento rápido `+/-` desabilitado quando `peso === null` (`bateria/[id].tsx`).
- **Falha 18**: Incremento a partir de zero/nulo pulando para 20 kg em vez de inicializar na meta da categoria/bateria (`bateria/[id].tsx`).
- **Falha 19**: Foco no campo de peso perdido ou sobrescrito por sincronização em background (`bateria/[id].tsx`).
- **Falha 20**: Meta de peso fixa hardcoded em 90/100 kg em vez de usar meta dinâmica da categoria/bateria (`bateria/[id].tsx`).
- **Falha 21**: Ausência de banner/notificação de conclusão ao pesar o último piloto (`bateria/[id].tsx`).
- **Falha 22**: Cálculo de lastro com erro de ponto flutuante em vez de arredondamento padronizado a 1 casa decimal (`toFixed(1)`) (`bateria/[id].tsx`).

## Arquivos de Referência
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/bateria/[id].tsx`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/formato.ts`

## Entregável
Escrever relatório estruturado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md`.

## 2026-11-02T21:26:54Z
Você é o explorer_m2_2 (M2 Balança e Lastro Explorer).
Seu diretório de trabalho exclusivo é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2

LEITURA OBRIGATÓRIA ANTES DE INICIAR QUALQUER TRABALHO:
Leia na íntegra os arquivos:
1. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md
3. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/DISPATCH.md

Sua missão:
Investigar detalhadamente as Falhas 16 a 22 do Milestone M2:
- Falha 16: Seleção de piloto por índice de array causando salto ao atualizar dados via SSE/polling em `src/app/bateria/[id].tsx`. Rastrear piloto selecionado por ID único / kart.
- Falha 17: Incremento rápido +/- desabilitado quando `peso === null` em `src/app/bateria/[id].tsx`.
- Falha 18: Incremento a partir de zero ou nulo pulando para 20 kg em vez de inicializar na meta da categoria/bateria em `src/app/bateria/[id].tsx`.
- Falha 19: Foco no campo de peso sobrescrito por sincronização periódica/SSE em `src/app/bateria/[id].tsx`.
- Falha 20: Meta de peso hardcoded em 90/100 kg (`meta = Number(kart) >= 100 ? 100 : 90`) em `src/app/bateria/[id].tsx`. Deve ser dinâmica com base na categoria/bateria.
- Falha 21: Ausência de banner/notificação de conclusão ao pesar o último piloto em `src/app/bateria/[id].tsx`.
- Falha 22: Cálculo de lastro com imprecisão de ponto flutuante em vez de arredondamento a 1 casa decimal (`toFixed(1)`) em `src/app/bateria/[id].tsx` e `src/features/operacao/formato.ts`.

Examine o código fonte real em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`, aponte números de linha exatos, analise as causas-raiz e forneça a recomendação exata da correção (incluindo patches/código sugerido).
NÃO faça alterações de código nem execute builds — você é somente leitura.
Ao concluir, escreva seu relatório estruturado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md` e envie uma mensagem informando a conclusão.


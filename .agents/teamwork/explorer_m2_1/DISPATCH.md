# Dispatch: M2 Explorer 1 — Baterias e Sorteio (Falhas 08 a 15)

## Objetivo
Investigar as falhas de agrupamento de baterias e fluxo de sorteio de karts no app `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`, produzindo diagnósticos exatos, referências de linhas e propostas de correção / patch.

## Escopo
- **Falha 08**: Chave de agrupamento duplicando baterias devido a sufixos de etapa (`baterias.ts`).
- **Falha 09**: Sorteio "Um a um" alterando a ordem da lista de pilotos (`sorteio.ts`).
- **Falha 10**: Sorteio bloqueado em baterias avulsas quando recepção offline (`bateria/[id].tsx`).
- **Falha 11**: Erro 409 (concorrência) descartando prévia sorteada em vez de preservar e atualizar revisão (`bateria/[id].tsx`).
- **Falha 12**: Botão recusar kart desabilitado incorretamente (`bateria/[id].tsx`).
- **Falha 13**: Rótulo de botão singular para 1 piloto no "Um a um" (`bateria/[id].tsx`).
- **Falha 14**: Validação de pilotos aptos antes do sorteio (`bateria/[id].tsx`).
- **Falha 15**: ActivityIndicator e lock concorrente no sorteio individual (`bateria/[id].tsx`).

## Arquivos de Referência
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/baterias.ts`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/sorteio.ts`
- `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/bateria/[id].tsx`

## Entregável
Escrever relatório estruturado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md`.


## 2026-11-02T21:26:47Z
Você é o explorer_m2_1 (M2 Baterias e Sorteio Explorer).
Seu diretório de trabalho exclusivo é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1

LEITURA OBRIGATÓRIA ANTES DE INICIAR QUALQUER TRABALHO:
Leia na íntegra os arquivos:
1. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md
3. /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/DISPATCH.md

Sua missão:
Investigar detalhadamente as Falhas 08 a 15 do Milestone M2:
- Falha 08: Chave de agrupamento duplicando baterias devido a sufixos de etapa em `src/features/operacao/baterias.ts`.
- Falha 09: Sorteio "Um a um" reordenando a lista original de pilotos em `src/features/operacao/sorteio.ts`.
- Falha 10: Sorteio bloqueado em baterias avulsas quando recepção offline em `src/app/bateria/[id].tsx`.
- Falha 11: Erro 409 descartando prévia sorteada em vez de preservar e atualizar revisão em `src/app/bateria/[id].tsx`.
- Falha 12: Condição de habilitar/desabilitar botão de recusar kart em `src/app/bateria/[id].tsx`.
- Falha 13: Rótulo de botão singular para 1 piloto no "Um a um" em `src/app/bateria/[id].tsx`.
- Falha 14: Validação de pilotos aptos antes do sorteio em `src/app/bateria/[id].tsx`.
- Falha 15: ActivityIndicator e lock concorrente no sorteio individual em `src/app/bateria/[id].tsx`.

Examine o código fonte real em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`, aponte números de linha exatos, analise as causas-raiz e forneça a recomendação exata da correção (incluindo patches/código sugerido).
NÃO faça alterações de código nem execute builds — você é somente leitura.
Ao concluir, escreva seu relatório estruturado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md` e envie uma mensagem informando a conclusão.

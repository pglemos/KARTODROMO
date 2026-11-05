# BRIEFING — 2026-11-02T21:35:00Z

## Mission
Investigar detalhadamente as Falhas 08 a 15 do Milestone M2 (Baterias e Sorteio de Karts) no repositório `kartodromo-operacional`, analisando causas-raiz, linhas exatas de código e propostas completas de correção e patches.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1
- Original parent: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Milestone: M2 (Baterias, Sorteio, Balança & Campeonatos)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- NÃO fazer alterações de código nem executar builds
- Responder sempre em pt-BR
- Totem sem teclado na tela
- Não mexer no telão (`FormTV` / `--tv`)
- Manter regras de segurança e operação do kartódromo
- Comunicação via arquivos e `send_message` para coordenação com o pai `88cadb65-7d49-4f0d-a278-9c17ee4251ab`

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: 2026-11-02T21:26:47Z

## Investigation State
- **Explored paths**:
  - `src/features/operacao/baterias.ts`: Linhas 10-24 mapeadas. Causa da Falha 08 identificada (regex de etapa restrita e falta de normalização por `normalizarChaveBateria`).
  - `src/features/operacao/sorteio.ts`: Linhas 11-27 mapeadas. Causa da Falha 09 identificada (`sortear` ordena por `excecoes.length` e destrói o índice original de chamada).
  - `src/app/bateria/[id].tsx`:
    - Falha 10 (Linhas 443-448 e 466): Bloqueio incondicional por recepção offline mesmo para baterias avulsas.
    - Falha 11 (Linhas 171-188): Erro 409 esvaziando `previa` e voltando para `inicio` em vez de manter escala e atualizar `revisaoSorteio`.
    - Falha 12 (Linhas 151-159 e 405): Condição de desativação `livres.length <= previa.length` e falta de swap entre karts não confirmados.
    - Falha 13 (Linha 464): Rótulo plural `CHAMAR 1 A 1 ›` para 1 piloto em vez de `CONFIRMAR PILOTO ›`.
    - Falha 14 (Linhas 457 e 466): Falta de validação estrita de aptos e faltantes no botão de sorteio.
    - Falha 15 (Linhas 220-256 e 292-313): Falta de `ActivityIndicator` no card durante sorteio individual e ausência de lock de concorrência.
  - Testes examinados: `tests/harness.ts`, `tests/baterias.test.ts`, `tests/sorteio.test.ts`, `tests/tier1-features.test.ts`, `tests/tier2-boundary-corner-cases.test.ts`, `tests/tier3-cross-feature.test.ts`.
- **Key findings**:
  - Todas as 8 falhas possuem causas-raiz 100% claras, determinísticas e mapeadas linha a linha.
  - Contratos exatos já validados e testados no `tests/harness.ts`.
  - Propostas de patch prontas para aplicação sem quebra de retrocompatibilidade.
- **Unexplored areas**: Nenhuma pendente dentro do escopo das Falhas 08 a 15.

## Key Decisions Made
- Estruturar patches completos para `baterias.ts`, `sorteio.ts` e `bateria/[id].tsx` no relatório final `handoff.md`.
- Exportar funções contratuais `normalizarChaveBateria`, `sortearComOrdemPreservada`, `podeRecusarKartUmAUm` e `obterRotuloBotaoUmAUm` para garantir alinhamento pleno entre produção e suíte de testes.

## Artifact Index
- `DISPATCH.md` — Registro de despachos recebidos
- `BRIEFING.md` — Memória de trabalho persistente
- `progress.md` — Heartbeat de execução
- `handoff.md` — Relatório técnico final estruturado (5 componentes)

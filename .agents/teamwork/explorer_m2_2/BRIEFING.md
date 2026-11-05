# BRIEFING — 2026-11-02T21:28:00Z

## Mission
Investigar detalhadamente as Falhas 16 a 22 do Milestone M2 (Balança, Pesagem e Lastro) no projeto kartodromo-operacional (`src/app/bateria/[id].tsx` e `src/features/operacao/formato.ts`), produzindo diagnósticos exatos, referências de linhas, causas-raiz e propostas de correção / patches.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2
- Original parent: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Milestone: M2 (R2: Segurança, Privacidade e LGPD - Item 10)
- Assigned: 2026-11-02T21:26:54Z por parent 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- New Milestone: M2 Operacional (Balança e Lastro Explorer — Falhas 16 a 22)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Totem sem teclado na tela (conforme regra do dono / AGENTS.md)
- Arquivos de código não devem ser modificados diretamente neste papel de Explorer
- Read-only investigation em /Users/pedroguilherme/PROJETOS/kartodromo-operacional — NÃO fazer alterações de código nem executar builds

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: 2026-11-02T21:28:00Z

## Investigation State
- **Explored paths**:
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md`
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md`
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/DISPATCH.md`
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/bateria/[id].tsx` (linhas 532-704, 1340-1430)
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/formato.ts`
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/sorteio.ts`
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/harness.ts`
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/tier1-features.test.ts`
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/tier2-boundary-corner-cases.test.ts`
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/operacao.ts` e `regras.ts`
- **Key findings**:
  - Falha 16: `Lastro` usava `const [i, setI] = useState(0)` em array volátil filtrado `p.pilotos.filter(x => x.kartAtual)`. Quando o polling de 10s ou SSE atualiza `p.pilotos`, o índice `i` apontava para outro piloto. Solução: rastrear por `pilotoId` estável (`customerId || kartAtual || String(indice)`).
  - Falha 17: Botões `+` e `−` tinham `desativado={!valido}`, bloqueando incremento rápido quando `peso === null`. Solução: remover trava e permitir clique direto a partir de peso nulo.
  - Falha 18: `mudar(v)` aplicava `Math.max(20, ...)` a partir de `atual = peso ?? 0`, pulando para 20 kg. Solução: utilizar `ajustarIncrementoPeso(peso, delta, meta)` partindo da meta da categoria da bateria.
  - Falha 19: `useEffect` com `[x?.indice, x?.pesoKg]` sem checagem de foco sobrescrevia `texto` e `peso` no meio da digitação durante polling/SSE. Solução: adicionar `focado: boolean` com `onFocus`/`onBlur` no `TextInput`.
  - Falha 20: Meta hardcoded `Number(x.kartAtual) >= 100 ? 100 : 90`. Solução: `obterMetaBateria(p.sessao, x)` lendo `metaKg` configurado na sessão, categoria ou regulamento (80, 95, 110 kg).
  - Falha 21: Ao pesar o último piloto, o botão mantinha `'Conferido · próximo piloto ›'` sem transição. Solução: exibir banner de conclusão `'PESAGEM CONCLUÍDA ✓'` com atalho `'Ir para Galpão ›'` e atualizar texto do botão.
  - Falha 22: Função `num` usava `String(n).replace('.', ',')` sem arredondamento, propagando imprecisão IEEE 754. Solução: adicionar `formatarNumero1Casa`, `arredondar1Casa` e `calcularPlanoLastro` em `formato.ts` e aplicá-los no app.
- **Unexplored areas**: Nenhuma no escopo das Falhas 16 a 22.

## Key Decisions Made
- Centralizar funções matemáticas e de formatação de lastro em `src/features/operacao/formato.ts` para reuso no app e compatibilidade com a suíte de testes.
- Utilizar `irParaAba?.('galpao')` (já disponível no container de abas) para fluidez operacional no banner de conclusão.
- Produzir patch detalhado em `handoff.md` pronto para aplicação pelo agente implementador.

## Artifact Index
- DISPATCH.md — Instruções da tarefa
- BRIEFING.md — Memória de trabalho do agente
- progress.md — Liveness e progresso do agente
- handoff.md — Relatório estruturado de entrega com diagnóstico minucioso e patches completos



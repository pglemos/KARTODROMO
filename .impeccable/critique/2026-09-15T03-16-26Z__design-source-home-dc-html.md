---
target: "3ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
timestamp: 2026-09-15T03-16-26Z
slug: design-source-home-dc-html
---
# Avaliação 3ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. Ressalvas: detector CLI degradado; injeção via localhost bloqueada (injetado do disco).

## Nota — 23/32 (72%, Bom; H7 e H10 n/a)
1 Status 3 · 2 Linguagem 3 (mensagens erradas acima do limite) · 3 Controle 3 (remover piloto sem confirmação, foco perdido) · 4 Consistência 2 (versão antiga via cache) · 5 Prevenção 3 · 6 Reconhecimento 3 · 7 n/a · 8 Estética 3 (CTA duplicado, ~89ch em 2 parágrafos) · 9 Recuperação 3 (resumo antes do envio, fora de ordem, sem links) · 10 n/a

## Especificidade
Específico e coerente. Detector: cores resolvidas (DESIGN.md lido), 11px da home resolvido, sem console/404/{{ }}; persistem tamanhos de display (falso positivo), ~89ch em 2 parágrafos, cramped-padding em 2 links, 5 legendas 11px na galeria da home.

## Problemas prioritários
- [P1] Cache /design/* (max-age e s-maxage 3600) mostra versão antiga após deploy → next.config.ts headers → harden
- [P2] Mensagens erradas acima do limite (idade/altura/peso) → validate → clarify
- [P2] Remover piloto: foco perdido e sem confirmação para piloto preenchido → removePilot → harden
- [P2] Resumo de erros aparece antes do envio, fora de ordem, sem links → revalidateField/ml-error-summary → clarify
- [P3] CTA final duplicado em /campeonatos; ~89ch em 2 parágrafos; links sem padding vertical → distill

## Personas
Jordan: formulário longo, mensagem de idade errada. Casey: versão antiga após deploy. Riley: remove piloto sem confirmação, resumo dispara no blur, limite máximo com mensagem do mínimo. Chefe de equipe: 15 pilotos no celular, sem colar lista.

## Menores
window.confirm nativo; título quebra apertado na home 375px; legendas 11px na galeria da home; valor do KAC não informado (sem dado real).

## Perguntas
Colar lista de pilotos? Confirmação no visual do site? Valores do KAC para publicar?

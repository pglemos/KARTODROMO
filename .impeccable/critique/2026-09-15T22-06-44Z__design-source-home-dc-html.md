---
target: "8ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 27
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 0
timestamp: 2026-09-15T22-06-44Z
slug: design-source-home-dc-html
---
# Avaliação 8ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. /api/inscricao e wa.me bloqueados; CLI degradado.

## Nota — 27/32 (84%, Bom; H7 e H10 n/a)
1 Status 4 · 2 Linguagem 3 ("2,5 h" vs "2h30 + 1 volta") · 3 Controle 3 · 4 Consistência 3 (aba tocada perde destaque durante rolagem suave) · 5 Prevenção 4 · 6 Reconhecimento 3 · 7 n/a · 8 Estética 3 (texto vaza por trás do cabeçalho 97% opaco) · 9 Recuperação 4 · 10 n/a

## Especificidade
Alta. Falso positivo da revisão A: "Domingo · 08:30" consta no regulamento (item 2.1). Detector: link do regulamento 46px (resolvido); sem console/404/{{ }}/overflow; gradient-text falso positivo.

## Problemas prioritários
- [P2] Aba tocada não fica destacada durante a rolagem suave → goToSection/onPanelScroll → polish
- [P3] Duração "2,5 h" na home vs "2h30 + 1 volta" → milhasFacts → clarify
- [P3] Cabeçalho do modal 97% opaco deixa texto aparecer → polish

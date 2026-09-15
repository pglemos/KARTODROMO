---
target: "7ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 26
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
timestamp: 2026-09-15T21-55-00Z
slug: design-source-campeonatos-dc-html
---
# Avaliação 7ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. /api/inscricao e wa.me bloqueados nos testes; CLI degradado.

## Nota — 26/32 (81%, Bom; H7 e H10 n/a)
1 Status 3 (colagem após envio não revalida) · 2 Linguagem 4 · 3 Controle 4 · 4 Consistência 3 · 5 Prevenção 3 · 6 Reconhecimento 3 (barra de seções sem sinal de rolagem no mobile) · 7 n/a · 8 Estética 3 (aviso da colagem sob o cabeçalho) · 9 Recuperação 3 · 10 n/a

## Especificidade
Alta. Detector: sem regressão; resumo 211px no mobile com título visível; 19 botões ≥44px; contraste de erro 11,29:1; novo real baixo: link do regulamento com 19px de alvo.

## Problemas prioritários
- [P1] Colar lista após envio com erro não revalida pilotos → applyPastePlan → harden
- [P2] Barra de seções sem sinal de rolagem no mobile → adapt
- [P3] Aviso da colagem parcialmente sob o cabeçalho fixo → polish

## Menores
KAC sem exemplos em Idade/Peso; link do regulamento com alvo de 19px; badges nas abas repetem o resumo (aceitável).

---
target: "9ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 28
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 0
timestamp: 2026-09-15T22-20-36Z
slug: design-source-campeonatos-dc-html
---
# Avaliação 9ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. /api/inscricao e wa.me bloqueados; CLI degradado.

## Nota — 28/32 (88%, Bom; H7 e H10 n/a)
1 Status 4 · 2 Linguagem 3 ("2,5 horas" vs "2h30") · 3 Controle 4 · 4 Consistência 3 (botões de envio com textos diferentes) · 5 Prevenção 4 · 6 Reconhecimento 3 (aviso de requisitos longe do cartão) · 7 n/a · 8 Estética 3 · 9 Recuperação 4 · 10 n/a

## Especificidade
Alta; "até 2 paradas extras" (10.2) e "lastro até 50 kg" (7.1) confirmados no regulamento. Detector: sem regressão; nested-cards no cabeçalho do modal = falso positivo causado pela sombra.

## Problemas prioritários
- [P2] Aviso de requisitos só no status da colagem, longe do cartão do piloto → clarify
- [P3] "2,5 horas" e "2h30" misturados (home, página, card) → clarify
- [P3] Resumo de erros com role=alert muda a cada tecla → harden
- [P3] Botões de envio com textos diferentes → clarify

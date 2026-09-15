---
target: "reavaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-09-15T02-33-47Z
slug: design-source-campeonatos-dc-html
---
# Avaliação 2ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. Ressalvas: detector em modo degradado (sem parser HTML); capturas mobile falharam na revisão A.

## Nota — 22/32 (69%, Aceitável/limite Bom; H7 e H10 n/a)
1 Status 3 · 2 Linguagem 3 (card 100 Milhas: "Valores via WhatsApp") · 3 Controle 3 (reduzir karts apaga pilotos) · 4 Consistência 2 (modais diferentes; requisitos antigos no card) · 5 Prevenção 2 (erro some ao digitar sem revalidar) · 6 Reconhecimento 3 (resumo no fim) · 7 n/a · 8 Estética 3 (11–12px, ~89ch) · 9 Recuperação 3 · 10 n/a

## Especificidade
Agora específico: traçado 961 m, linha do tempo dos boxes, total por kart, pilotos por kart. Genérico restante: faixa de estatísticas decorativa e cards idênticos em /campeonatos. Detector: {{ }}/404 resolvidos, dark-glow resolvido, sem erros de console; persistem tokens não documentados (#ffb3b3, #ffd0d0), 11px na home, ~89ch.

## Problemas prioritários
- [P1] Erro some ao digitar sem revalidar (100-milhas-light.dc.html onFormInput) → harden
- [P1] Card 100 Milhas em campeonatos contradiz página (requirements/showWhatsapp) → clarify
- [P2] Reduzir karts apaga pilotos sem confirmação (onKartsChange) → harden
- [P2] Modal de /campeonatos com padrão diferente do de 100 Milhas → polish
- [P3] Textos 11–12px, ~89ch, tokens não documentados → typeset

## Personas
Jordan: 3 links competindo no card. Casey: modal ~2.400px, resumo longe. Riley: reduz karts perde dados; hash #formulario reabre ao recarregar. Chefe de equipe: 60 campos, sem revisão por kart, "175" aceito sem indicação de cm.

## Menores
Rodapé /campeonatos #667067 12px; h2 vazio no modal fechado; faixa de estatísticas sem informação.

## Perguntas
Preço público vs "valores via WhatsApp"? Altura/peso de 15 pilotos antes da vaga? /campeonatos convence iniciante?

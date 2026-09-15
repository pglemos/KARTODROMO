---
target: "5ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 25
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 0
timestamp: 2026-09-15T18-21-57Z
slug: design-source-100-milhas-light-dc-html
---
# Avaliação 5ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. Ressalvas: CLI degradado; /api/inscricao e wa.me bloqueados nos testes.

## Nota — 25/32 (78%, Bom; H7 e H10 n/a)
1 Status 4 · 2 Linguagem 3 (dois "4 passos" diferentes) · 3 Controle 3 · 4 Consistência 3 · 5 Prevenção 3 (colagem não nomeia incompletos; 1.80 não normaliza) · 6 Reconhecimento 3 (piloto ~330px no mobile) · 7 n/a · 8 Estética 3 (destaque home 1.178px no mobile) · 9 Recuperação 3 (resumo escondido atrás do cabeçalho no mobile) · 10 n/a

## Especificidade
Alta, sem dado inventado. Detector: cramped-padding resolvido; 2 colunas no mobile confirmadas; sem console/404/{{ }}; observação: label de checkbox com 100 caracteres/linha a 1440px.

## Problemas prioritários
- [P2] Idade/altura/peso empilhados no mobile → sync-design exceção + 100ML → adapt
- [P2] Colagem: nomear incompletos, normalizar decimal, explicar agrupamento por linha em branco → harden
- [P2] Resumo de erros escondido no mobile após envio vazio → focar resumo → clarify
- [P3] Página "4 passos" vs barra "4 etapas" com nomes diferentes → clarify
- [P3] Destaque da home longo no mobile (fatos 1 coluna, logo grande) → adapt

## Menores
"Faltam corrigir" → "Falta corrigir"; texto das checkboxes a 100ch; possível skip-link visível em captura mobile.

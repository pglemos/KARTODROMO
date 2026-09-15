---
target: "6ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 24
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-09-15T21-41-19Z
slug: design-source-campeonatos-dc-html
---
# Avaliação 6ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent (refeito após limite de uso). /api/inscricao e wa.me bloqueados nos testes.

## Nota — 24/32 (75%, Bom; H7 e H10 n/a)
1 Status 3 (título do resumo escondido) · 2 Linguagem 4 · 3 Controle 2 (Esc na confirmação fecha o modal) · 4 Consistência 3 · 5 Prevenção 3 (colagem aceita piloto fora dos requisitos) · 6 Reconhecimento 3 (placeholders parecem dados) · 7 n/a · 8 Estética 3 (resumo de 14 itens cobre a tela no mobile) · 9 Recuperação 3 · 10 n/a

## Especificidade
Alta. Detector: sem regressão; 3 colunas de piloto no mobile, fatos 2×2, labels ~73 caracteres, sem alvos <44px no modal; falsos positivos: clamp, caixa alta, text-occlusion do overlay.

## Problemas prioritários
- [P1] Esc com confirmação aberta fecha o modal → _onKeydown → harden
- [P1] Título do resumo de erros atrás da barra fixa (100 Milhas e KAC) → focusFirstError / onSubmitRegistration → polish
- [P2] Resumo longo cobre a tela no mobile → agrupar por seção + lista expansível → distill
- [P2] Colagem sem aviso de requisitos (idade/altura/peso) → applyPaste → harden
- [P3] Placeholders "1,75"/"80" parecem dados → clarify

## Menores
Botões da barra de seções 40px; links do resumo 33px; cabeçalho sobre logo na captura mobile da home (possível artefato).

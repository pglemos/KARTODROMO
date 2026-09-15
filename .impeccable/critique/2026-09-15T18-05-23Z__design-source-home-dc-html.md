---
target: "4ª avaliação: campeonatos, 100-milhas-light, destaque home"
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-09-15T18-05-23Z
slug: design-source-home-dc-html
---
# Avaliação 4ª rodada: /campeonatos · /100-milhas-light · destaque home
Método: dual-agent. Ressalvas: CLI degradado; detector injetado do disco.

## Nota — 23/32 (72%, Bom; H7 e H10 n/a)
1 Status 3 (colagem com vírgula anuncia sucesso falso; barra sem etapa atual) · 2 Linguagem 3 · 3 Controle 3 · 4 Consistência 2 (resumo do KAC antes do envio e não clicável; checkboxes quebram no mobile) · 5 Prevenção 3 · 6 Reconhecimento 3 · 7 n/a · 8 Estética 3 · 9 Recuperação 3 · 10 n/a

## Especificidade
Muito específico. Detector: só design-system-font-size (display); resolvidos line-length (68/77), padding dos 2 links, legendas; sem console/404/{{ }}; persistem cramped-padding em "Valores e dúvidas no WhatsApp", "Ver detalhes da prova" e botão "Preencher karts".

## Problemas prioritários
- [P1] Colagem com vírgula vira nome inteiro e status diz sucesso → parsePilotList/applyPaste → harden
- [P1] Foco perdido após "Substituir pilotos" → applyPastePlan → harden
- [P2] Checkboxes e marcadores de lista separados do texto no mobile (regra 1 coluna do gerador) → sync-design.mjs → adapt
- [P2] Resumo de erros do KAC antes do envio e não clicável; mensagens genéricas de idade/peso → campeonatos → harden
- [P3] Barra de etapas sem indicação de rolagem/etapa atual; 3 links sem padding vertical → polish

## Personas
Casey: cabeçalho alto, checkboxes quebrados, etapa cortada. Riley: foco perdido após colar. Chefe de equipe: sucesso falso com vírgula; kart extra por linha em branco sem aviso claro.

## Menores
CPF no link do WhatsApp mesmo com inscrição salva; título das legendas da galeria 12px.

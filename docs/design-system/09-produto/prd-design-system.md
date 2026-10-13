# PRD — Design system único do Kartódromo

| | |
|---|---|
| Dono | dono do kartódromo |
| Status | fase 0 entregue (tokens, gerador, lint, documentação) · fases 1–8 a aprovar |
| Apps afetados | todos (telão congelado) |
| Data | 08/10/2026 |

## 1. Problema
Cada app e cada tela seguem regras próprias: cinco paletas sem ligação (site neon, admin verde, telão teal, páginas
da cronometragem com três famílias, tablet com outro verde), ~7 vermelhos, ~6 amarelos e ~6 verdes de ação, sete
famílias de fonte, 60 tamanhos de fonte no desktop, 8 tipos de botão (26–42 px), 4 grades e 3 tipos de janela.
Resultado: telas com texto/botão cortado, contraste reprovado, comportamento diferente para a mesma ação, e
retrabalho a cada tela nova (pessoas, Claude e Codex editando o mesmo código).

## 2. Objetivo e métricas
Uma marca, dois temas (claro = operação, escuro = público), um conjunto de componentes e regras de comportamento.
| Métrica | Hoje | Meta |
|---|---|---|
| Hardcode visual (`lint:design`) | ~3.400 | −80% ao fim da fase 5; 0 em tela nova |
| Telas com corte em 1280×720 | a medir na auditoria | 0 |
| Pares de cor reprovados (WCAG) | 4 conhecidos | 0 (exceto decisão registrada) |
| Tipos de botão / diálogo / grade no desktop | 8 / 3 / 4 | 1 (com variantes) / 1 / 1 + ao vivo |

## 3. Quem usa
Quem desenha e programa (pessoa, Claude, Codex) · quem aprova (dono) · indiretamente todos os operadores e clientes.

## 4. Escopo
**Entra:** tokens únicos com gerador para todas as plataformas; verificador no CI; documentação; migração por fases.
**Não entra:** telão (congelado); mudança visual do totem; mudança de regra de negócio.

## 5. Regras
- RN01 Valor visual só nasce em `tokens/kib.tokens.json`.
- RN02 Tela nova sem especificação de handoff não entra.
- RN03 Hardcode novo reprova o CI (catraca).
- RN04 Cada fase só com aprovação, fora do horário de pista, com aceite completo.
- RN05 Fim de bateria continua manual; totem sem teclado virtual; apps continuam nativos .NET.

## 6. Lançamento
Fase 0 não muda pixel e não precisa de instalação. Fases seguintes: ver [refatoração proposta](../07-arquitetura/refatoracao-proposta.md).

## Observação sobre o `PRODUCT.md`
O `PRODUCT.md` da raiz ainda descreve o LapTime/MyLapTime como fonte da verdade da cronometragem e da reserva. Isso
mudou: o LapTime foi desinstalado (cronometragem própria no ORBITS) e a reserva online é própria (Asaas). Atualizar o
`PRODUCT.md` é tarefa separada.

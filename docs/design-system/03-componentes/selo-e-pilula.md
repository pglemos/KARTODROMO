# Selo (badge), pílula de status e chip

**Status:** canônico · **Tema:** ambos

## Variantes
| Componente | Para quê | Aparência |
|---|---|---|
| **Selo de status** | estado de um registro (Pago, A pagar, Ativo, Cancelado, Ao vivo) | fundo `cor.estado.*.fundo`, texto `cor.estado.*.texto`, `raio.chip`, legenda 11 semibold, altura 20–22, padding 8 |
| **Pílula de status** | estado do piloto/kart na corrida (Pista, Box, Bandeira) | igual, com ponto ● à esquerda |
| **Contador** | quantidade em aba/menu ("3") | círculo `raio.pilula`, `cor.acao.principal` / branco, mín. 18 |
| **Chip de filtro** | filtro ativo, removível | `cor.selecao.fundo`, ✕ à direita |
| **Etiqueta de tipo** | tipo de bateria/kart (Locação, Campeonato, Equalização) | contorno 1 px na cor do domínio, sem fundo |

## Mapa estado → cor (único em todo o sistema)
| Significado | Estado | Texto do selo |
|---|---|---|
| Pago, ativo, concluído, ao vivo ok | sucesso | "Pago", "Ativo" |
| A pagar, pendente, aguardando | aviso | "A pagar", "Pendente" |
| Cancelado, estornado, erro, desclassificado | perigo | "Cancelado", "DC" |
| Novo, agendado, informativo, classificatório | info | "Agendado" |
| Rascunho, inativo, encerrado | neutro (`superficie.campo` / `texto.secundario`) | "Encerrado" |

## Regras
- O **texto** carrega o significado; a cor reforça. Nunca selo só com cor.
- Selo não é botão (sem hover/clique). Se precisar agir, use botão ou menu.
- Máx. 2 selos por linha de tabela.

## Implementação
WinForms: **`Selo`** pronto em `Kartodromo.Comum/Design/Selo.cs` (`new Selo("A pagar", Estado.Aviso)`, `comPonto: true` vira pílula); cores por estado em `CoresEstado`. `PilulaStatus` (Crono) e `SeloTerminal` (Recepção) migram nas fases 2–3. Web: `.status-badge`,
`.pill`. Totem: `Pilula` — travado.

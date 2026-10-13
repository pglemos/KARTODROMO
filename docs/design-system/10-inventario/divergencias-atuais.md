# Divergências atuais (linha de base de 08/10/2026)

O que existe hoje fora do padrão. Números de hardcode por arquivo: [hardcode-relatorio.md](hardcode-relatorio.md) (gerado).

## Paletas paralelas
| Onde | Paleta | Destino |
|---|---|---|
| Site público (`DESIGN.md`, "Pit Lane Noturno") | neon `#00E676`, preto `#030504` | é a base do tema **escuro** |
| Admin web (`--admin-*`) | verde `#007A3D` | tema claro, `#0B7A53` (fase 4) |
| Telão (`tv.html`, `tb50.html`, `app/telao…`) | teal/amarelo | **congelado** |
| timing-ui (`operador`, `admin`, `resultado`, `equalizacao`) | ~~três famílias de cores~~ | ✅ tema claro pelos tokens (fase 5, 08/10) |
| Tablet (`Tema.kt` `#087F5B`; `themes.xml` diferente) | dois verdes no mesmo app | tema escuro (fase 7) |
| Brandbook antigo (`docs/brandbook-kartodromo.md`) | `#3B8B78` | substituído por esta documentação |
| Desktop: `Tokens` (só Recepção usa, 282×), `TemaCrono`, `Tema` (Ui.cs), `KitVisual`, `Estilo`, `VisualPrincipal` | 6 fontes de cor | `Tokens.Claro/Escuro` (fases 1–3, 6) |

Variações da mesma intenção: ~7 vermelhos, ~6 amarelos, ~6 verdes de ação.

## Tipografia
Anton, Rajdhani, Oswald (fora do `DESIGN.md`), Inter e Montserrat (legado `src/index.css`), Segoe UI, Arial,
system-ui. Desktop com **60 combinações de tamanho** (9,4F, 8,8F, 10,1F…).

## Componentes duplicados (desktop)
8 variantes de botão (26–42 px), 4 grades, 3 tipos de janela, helpers repetidos (`Redondo`, `AplicarRaio`,
`CheckVerde`, `Icone`). Detalhe e o que sobrevive: [onde-vivem-componentes](../07-arquitetura/onde-vivem-componentes.md).

## Contraste reprovado (valores antigos ainda em uso)
| Cor | Onde | Razão | Mínimo | Token novo |
|---|---|---|---|---|
| Laranja `#B26A00` | texto de aviso (Recepção) | 4,24 | 4,5 | `cor.estado.aviso.texto` `#9A5B00` |
| Azul `#1E6FE8` sobre `#F5F5F7` | links/info | 4,29 | 4,5 | `cor.texto.link` `#0A63D6` |
| Texto terciário `#8E8E93` | dicas | 3,26 | 4,5 | `cor.texto.terciario` `#76767B` |
| Borda de campo `#DBDBDB` | campos do claro | 1,38 | 3 | **resolvido 10/10: #8E8E93** |

## Uso dos tokens no desktop (antes desta entrega)
`Tokens.cs` usado 282× na Recepção, 2× na Cronometragem, 0× no Totem; `Raio*`/`Espaco*` nunca usados.

## Comportamento
- ~~Mensagens pelo `MessageBox` do Windows~~ — resolvido (`Msg` desenhado, 08/10).
- Sem toast/banner padrão; sem estado vazio padrão (cada tela escreve um `Label`).
- ~~Melhor volta da prova indicada só por cor~~ — resolvido (marcador ■, 08/10).
- `PRODUCT.md` desatualizado (LapTime/MyLapTime).

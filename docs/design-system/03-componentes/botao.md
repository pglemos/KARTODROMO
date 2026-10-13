# Botão

**Status:** canônico (consolidação na fase 1) · **Tema:** ambos

## Para que serve
Disparar uma ação. Para **navegar** use link; para **escolher entre opções** use segmentado/abas; para ligar/desligar use interruptor.

## Anatomia
```
┌───────────────────────────────┐
│ [ícone 16]  Rótulo do botão   │   altura P 32 · M 40 · G 48
└───────────────────────────────┘
```
1. Contêiner — `cor.acao.*`, `raio.botao`. 2. Ícone opcional (à esquerda, 16 px, `espaco.meio`+4 do texto). 3. Rótulo — `fonte.tamanho.corpo`, semibold.

## Variantes
| Variante | Quando | Fundo / texto |
|---|---|---|
| **Primário** | a ação principal da tela/diálogo — **uma por área** | `cor.acao.principal` / `cor.acao.sobre-principal` |
| **Secundário** | Cancelar, Fechar, ações neutras | `cor.acao.secundaria` / `cor.texto.principal` |
| **Fantasma** | ações de baixa ênfase em barras (Filtros, Exportar) | transparente → `cor.superficie.campo` no hover |
| **Perigo** | Excluir, Estornar, Cancelar bateria | `cor.estado.perigo.solido` / branco |
| **Só ícone** | ações universais em linha de tabela/barra | fantasma, quadrado, com dica |
| **Pílula (totem)** | autoatendimento | `componente.totem.acao`, `raio.pilula`, altura ≥ 64 — travado |
| **Chanfrado (site)** | CTA do site público | `AngledButton`, só no escuro |

## Tamanhos
| Tamanho | Altura | Padding horizontal | Onde |
|---|---|---|---|
| P | 32 (`componente.controle.altura-p`) | 12 | barras de cartão, grades, ações de campo |
| M | 40 (`altura-m`) | 16 | **padrão**, rodapé de diálogo |
| G | 48 (`altura-g`) | 24 | ação de destaque, tablet |
| Toque | ≥ 48 / 64 | 24 | < 1024 px / totem |

Largura: acompanha o rótulo (mín. 88 px no M). Rótulo **nunca** corta: o botão cresce ou a barra quebra linha.

## Estados
| Estado | Aparência |
|---|---|
| Normal | cores da variante |
| Hover | primário `cor.acao.principal-pressionado` (mais escuro); secundário escurece 4% |
| Foco | anel 2 px `cor.borda.foco` a 2 px de distância |
| Pressionado | tom pressionado, sem deslocamento |
| Desabilitado | fundo `cor.superficie.campo`, texto `cor.texto.desabilitado`; **com dica dizendo por quê** |
| Carregando | rótulo vira "Salvando…" + indicador; largura não muda; clique ignorado |

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique | estado pressionado → carregando (se demorar > 300 ms) | executa a ação **uma vez** (bloqueia clique duplo) |
| Enter | em diálogo, aciona o **primário** (`AcceptButton`) | — |
| Esc | aciona o **Cancelar/Fechar** (`CancelButton`) | — |
| Espaço com foco | aciona o botão focado | — |
| Ação destrutiva | abre [confirmação destrutiva](confirmacao-destrutiva.md) | só executa após confirmar |
| Erro na ação | volta ao normal + mensagem (toast ou abaixo) | nada parcial fica gravado |

## Teclado e acessibilidade
Alcançável por Tab na ordem visual. Só-ícone: `AccessibleName`/`aria-label` + dica. Contraste do rótulo ≥ 4,5:1
(verificado nos tokens). Alvo ≥ 44×44 abaixo de 1024 px.

## Conteúdo
Verbo + objeto ("Salvar cliente"). Frase de caixa. Máx. ~3 palavras. Sem "OK".

## Ordem na barra
Rodapé de diálogo: **secundário à esquerda do primário, ambos à direita**; ação destrutiva isolada à esquerda.
`[Excluir]                    [Cancelar] [Salvar cliente]`

## Faça / não faça
- ✅ Um primário por área. ✅ Desabilitado com explicação.
- ❌ Dois primários lado a lado. ❌ Botão verde para "Excluir". ❌ Texto cortado "Salvar cli…". ❌ Altura fora de 32/40/48.

## Tokens
`cor.acao.*`, `cor.estado.perigo.solido`, `cor.texto.desabilitado`, `raio.botao`, `componente.controle.altura-*`,
`fonte.tamanho.corpo`, `fonte.peso.semibold`, `foco.*`, `movimento.duracao.rapido`.

## Implementação
| Plataforma | Hoje | Destino (fase 1) |
|---|---|---|
| WinForms | **`Botao`** pronto em `Kartodromo.Comum/Design/Botao.cs` (`new Botao("Salvar cliente", VarianteBotao.Primario, TamanhoBotao.M) { Svg = IconesLucide.Mais, AoClicar = async () => … }`). Ainda em uso nas telas: `BotaoPlano`, `DialogoDesign.BotaoRodape/AcaoCampo`, `KitVisual`, `VisualPrincipal.BotaoBarra`, `BotaoQuadrado` (Crono), `Caixa.BotaoIcone` | telas passam a `Botao` nas fases 2–3; `BotaoBandeira` continua (domínio) |
| Web site | `AngledButton`, `BigCTA` | mantém (tema escuro) |
| Web admin | classes `--admin-*` | `--kib-*` (fase 4) |
| timing-ui | `.btn`, `.primary`, `.danger`, `.b-blue`, `.b-green` | `.btn` + `.btn--primario/--perigo` com `--kib-*` (fase 5) |
| Android | `Button` Material com `Tema.kt` | `Tokens.Escuro` (fase 7) |
| Totem | `Pilula` | **travado** |

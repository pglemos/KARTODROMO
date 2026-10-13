# Cor

Valores completos e contraste verificado: [02-tokens/referencia.md](../02-tokens/referencia.md).

## Papéis (use o papel, nunca o hex)

| Papel | Token | Claro | Escuro | Quando usar |
|---|---|---|---|---|
| Marca / ação principal | `cor.acao.principal` | `#0B7A53` | `#00E676` | botão principal, seleção ativa, link de ação, foco |
| Texto sobre ação | `cor.acao.sobre-principal` | branco | `#041301` | rótulo do botão principal |
| Ação secundária | `cor.acao.secundaria` | `#EBEBEF` | `#101711` | Cancelar, Fechar, ✕, ações neutras |
| Fundo da tela | `cor.fundo.app` | `#F5F5F7` | `#030504` | atrás de tudo |
| Superfície | `cor.superficie.padrao` | branco | `#0B100C` | cartão, campo, cabeçalho, modal |
| Superfície suave | `cor.superficie.suave` | `#FAFAFC` | `#070B08` | cabeçalho de tabela, menu |
| Superfície de campo | `cor.superficie.campo` | `#F2F2F5` | `#101711` | busca, segmentado, botão fantasma |
| Lateral | `cor.superficie.lateral` | `#ECECF0` | `#070B08` | sidebar/árvore |
| Superfície inversa | `cor.superficie.inversa` | `#1C1C1E` | `#F7FAF6` | painel escuro dentro do claro |
| Texto principal | `cor.texto.principal` | `#1D1D1F` | `#F7FAF6` | conteúdo |
| Texto secundário | `cor.texto.secundario` | `#6E6E73` | `#A8B2AA` | rótulo, legenda, subtítulo |
| Texto terciário | `cor.texto.terciario` | `#76767B` | `#829083` | dica, placeholder (só sobre superfície) |
| Texto desabilitado | `cor.texto.desabilitado` | `#C7C7CC` | `#5D6660` | controle desabilitado |
| Link | `cor.texto.link` | `#0A63D6` | `#5EB6FF` | link de navegação (não de ação) |
| Borda sutil | `cor.borda.sutil` | `#E5E5EA` | branco 10% | divisória, borda de cartão |
| Borda de campo | `cor.borda.campo` | `#DBDBDB` ⚠ | `#6B786E` | campo sem foco |
| Borda de foco | `cor.borda.foco` | `#0B7A53` | `#00E676` | anel de foco do teclado |
| Seleção | `cor.selecao.fundo` / `.texto` | `#DAE8E1` | `#0F2A1A` | linha/item selecionado |
| Sobreposição | `cor.sobreposicao` | preto 30% | preto 65% | véu atrás de modal |

⚠ A borda de campo do claro (#DBDBDB, 1,38:1) não atinge o 3:1 que a WCAG pede para borda de componente. Decisão
pendente: trocar por `#8E8E93` (3,26:1) ou manter como exceção, compensando com rótulo sempre visível.

## Estados semânticos

Cada estado tem 3 a 4 cores: `solido` (preenchimento forte), `texto` (texto colorido legível), `fundo` (fundo
suave de selo/aviso) e, no aviso, `sobre-solido`.

| Estado | Significa | Claro (texto / fundo) | Escuro (texto / fundo) | Sempre junto com |
|---|---|---|---|---|
| `sucesso` | deu certo, ativo, positivo | `#1C6B35` / `#E8F5EE` | `#00E676` / `#0F2A1A` | ícone ✓ ou texto "Ativo" |
| `perigo` | erro, excluir, estornar, valor negativo | `#C4281C` / `#FDECEA` | `#FF7474` / `#2A1414` | ícone ⚠/✕ ou texto |
| `aviso` | atenção, pendente, a pagar | `#9A5B00` / `#FFF4E0` | `#FACC15` / `#2A2410` | ícone ! ou texto |
| `info` | informação, novo, classificatório | `#0A4FA0` / `#E1EEFF` | `#5EB6FF` / `#0E1E2E` | ícone i ou texto |

**Nunca use cor como único indicador.** Linha atrasada na corrida: cor **+** texto "2 voltas"; campo inválido: borda
vermelha **+** mensagem embaixo; status on-line: bolinha **+** palavra.

## Cores de domínio (iguais nos dois temas)

Bandeiras de pista (`cor.dominio.bandeira-*`: verde, amarela, vermelha, azul, preta, branca), `cor.dominio.podio-ouro`
(`#FFD24A`) e `cor.dominio.posicao` (`#FACC15`). Só para representar a própria bandeira/pódio — não para estado de interface.

## Degradês aprovados

Degradê é **exceção**: só os da tabela abaixo existem. Nunca em texto, campo, tabela, selo ou botão de operação. Cada um
é feito **das cores dos tokens** (nada de terceiro tom inventado); a direção é sempre de cima para baixo ou 135°.

| Nome | Onde | Composição | Tema |
|---|---|---|---|
| **CTA do site** | botão principal do site público (`AngledButton`, "Reservar") | 135°: `cor.acao.principal` → `cor.acao.principal-pressionado` (`#00E676 → #00C853`); texto `cor.acao.sobre-principal` | escuro |
| **Ícone em quadradinho** | arte de cabeçalho de tela/diálogo nos apps (`Forma.Tile`) e nos cartões do admin | 90° (vertical): cor do módulo clareada 25% → cor do módulo; ícone branco | claro |
| **Painel de marca** | lado esquerdo do login do admin, cartões de destaque do site | radial `cor.acao.principal` a 16% no canto + linear `cor.fundo.app` → `cor.estado.sucesso.fundo` | escuro |
| **Barra de tempo** | progresso da bateria na TV (`/tv`) | 90° horizontal: `cor.acao.principal` → mesma cor 40% mais clara; no fim, `cor.estado.aviso.solido` | escuro |
| **Esmaecer de rolagem** | borda de lista que rola (TV, listas longas) | máscara transparente → opaco em 2,5% → opaco → transparente | ambos |
| **Imagem de pista** | fotos de fundo do site | `cor.fundo.app` de 0% a 85% por cima da foto, para o texto ler | escuro |

Proibido: degradê em logo (compromisso do [DESIGN.md](../../../DESIGN.md)), arco-íris, mais de 2 paradas de cor,
degradê para "dar vida" a um cartão de operação. Degradê novo entra por [como-propor-mudanca](../08-governanca/como-propor-mudanca.md).

## Faça / não faça

- ✅ `Tokens.Claro.CorEstadoPerigoTexto` / `var(--kib-cor-estado-perigo-texto)`.
- ❌ `Color.FromArgb(196, 40, 28)` / `#c4281c` / `text-red-600`.
- ❌ Verde para decorar (verde = ação ou sucesso). ❌ Vermelho para "destaque" (vermelho = perigo).
- ❌ Inventar tom intermediário ("um cinza um pouco mais claro"): use o token mais próximo ou proponha um novo.

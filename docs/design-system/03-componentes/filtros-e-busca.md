# Filtros e busca

**Status:** canônico · **Tema:** ambos

## Anatomia da barra de filtros (acima da tabela/lista)
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Buscar por nome, CPF ou telefone      ✕]  [Todos|Pagos|A pagar]  [Filtros ▾] │
│ Filtros ativos: (Hoje ✕) (Kart 12 ✕)                         Limpar filtros    │
│ 37 de 512 clientes                                                             │
└───────────────────────────────────────────────────────────────────────────────┘
```
1. **Busca** — campo com lupa, fundo `cor.superficie.campo`, sem borda, `raio.campo`, ocupa o espaço que sobra (mín. 240).
2. **Segmentado** — o filtro mais usado (2–4 opções).
3. **Filtros ▾** — botão fantasma que abre painel com os demais filtros.
4. **Chips de filtro ativo** — `raio.chip`, fundo `cor.selecao.fundo`, ✕ para remover.
5. **Contador** — "37 de 512", `fonte.tamanho.pequeno`, `cor.texto.secundario`.

### Funil na coluna da tabela
Coluna filtrável mostra o funil à direita do título; filtro ativo = funil preenchido em `cor.acao.principal`.
Clique no funil abre lista de valores com busca e "Selecionar todos". Título da coluna com funil fica **centralizado**.

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Digitar na busca | filtra **ao vivo** após 250 ms parado; mínimo 2 caracteres para buscas no servidor | — |
| Enter na busca | busca imediata; se sobrar 1 resultado, abre/seleciona | — |
| Esc / ✕ na busca | limpa e volta à lista inteira | — |
| Segmentado | refiltra na hora | — |
| ✕ no chip | remove aquele filtro | — |
| Limpar filtros | remove todos, mantém a ordenação | — |
| Nenhum resultado | [estado vazio](estado-vazio.md) com o termo e ação "Limpar filtros" ou "Cadastrar" | — |
| Reabrir a tela | lembra filtros da sessão (não entre dias) | — |

## Regras
- Busca ignora acento e maiúscula ("joao" acha "João"); CPF/telefone com ou sem pontuação.
- Filtro **nunca esconde** o fato de estar ativo: chip + contador "x de y".
- Sem botão "Aplicar" para filtros simples; painel de filtros avançados pode ter "Aplicar".

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | busca: `PecasDesign.Texto` sobre `superficie.campo`; funil: `FiltroColuna` (Comum); segmentado `SegmentoDesign` |
| Web | `<input type="search">` + chips; admin `.search`/`.toolbar` |
| Android | `SearchBar` |

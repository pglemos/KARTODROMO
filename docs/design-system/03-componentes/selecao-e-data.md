# Seleção (lista suspensa) e data

**Status:** canônico · **Tema:** ambos

## Para que serve
- **Lista suspensa**: escolher **1** opção de 5 ou mais. Com 2–4 opções use [segmentado](segmentado-e-abas.md) ou opções de rádio.
- **Lista com busca**: mais de ~15 opções (clientes, pilotos, karts).
- **Data**: escolher dia; com hora, use data + campo `hh:mm`.

## Anatomia
```
Rótulo
┌──────────────────────────────┬───┐
│ Opção escolhida              │ ▾ │   altura 40 / 32
└──────────────────────────────┴───┘
```
Mesma caixa do [campo de texto](campo-texto.md); seta desenhada (`PecasDesign.DesenharSeta`), não a do Windows.
A lista aberta usa `cor.superficie.padrao`, `elevacao.2`, `raio.campo`, item com 32 px, selecionado `cor.selecao.*`.

## Estados
Normal · hover · foco (anel) · aberta · desabilitada · erro (como no campo) · **vazia** ("Nenhuma opção disponível"
dentro da lista, nunca lista em branco) · carregando ("Carregando…").

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique | abre a lista abaixo (acima se não couber) | — |
| Digitar com foco | pula para o item que começa com a letra / filtra (lista com busca) | — |
| ↑ ↓ | move o destaque; Alt+↓ abre | — |
| Enter / clique no item | fecha e aplica | dispara a atualização dependente (ex.: trocar traçado recarrega metas) |
| Esc | fecha sem mudar | — |
| Clique fora | fecha sem mudar | — |

### Data
Formato `dd/mm/aaaa`; digitação livre aceita `12102026`, `12/10`. Botão de calendário abre o mês com hoje marcado,
segunda-feira em cinza (fechado), feriados marcados. Atalhos: `+`/`−` muda um dia, `H` = hoje.
Intervalo (relatórios): dois campos "De" e "Até" com atalhos "Hoje", "7 dias", "Mês".

## Faça / não faça
- ✅ Opção padrão sensata pré-selecionada. ✅ Ordem lógica (alfabética, cronológica ou por uso).
- ❌ Lista suspensa com 2 opções. ❌ "Selecione…" como opção válida. ❌ Mudar outro campo sem aviso visual.

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | `ListaDesign` (lista), `DataDesign` (data), `SegmentoMes` (Recepção, mês) |
| Web | `<select>` nativo estilizado; calendário próprio na reserva |
| timing-ui | `<select>` com `--kib-*` |
| Android | `ExposedDropdownMenu` |
| Totem | `CampoLista` — travado |

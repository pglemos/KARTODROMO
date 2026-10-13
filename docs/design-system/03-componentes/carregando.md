# Carregando

**Status:** canônico · **Tema:** ambos

## Qual indicador
| Duração esperada | Indicador |
|---|---|
| < 300 ms | nenhum (evita piscar) |
| 300 ms – 2 s | **esqueleto** no lugar do conteúdo (listas/tabelas/cartões) ou indicador no botão ("Salvando…") |
| 2 – 10 s | esqueleto + texto do que está acontecendo ("Buscando voltas no servidor…") |
| > 10 s ou com etapas | **barra de progresso** com etapa e porcentagem; botão "Cancelar" se possível |

## Anatomia
- **Esqueleto**: blocos `cor.superficie.campo` com `raio` do elemento real, mesmo tamanho; brilho suave
  (desligado com reduzir movimento).
- **Indicador circular**: 16 px no botão, 24 px em área; `cor.acao.principal`.
- **Barra**: 4 px, trilho `superficie.campo`, preenchimento `acao.principal`.

## Comportamento
- A tela **continua utilizável** fora da área carregando (cabeçalho, menus, cancelar).
- O botão que disparou fica desabilitado até terminar (sem clique duplo).
- Timeout: depois de 15 s sem resposta, vira [erro com "Tentar de novo"](../04-padroes-de-tela/estados-vazio-erro-carregando.md).
- Atualização de fundo (tela ao vivo, polling) **não** mostra carregando; só o indicador de conexão.
  No desktop: `Seguro.Rodar(..., silencioso: true)` — sem ponteiro de espera e sem janela de erro (o erro vai para o log).
- **Ponteiro de espera** só para ação que a pessoa pediu, e **por contagem**: com duas operações ao mesmo tempo, a seta volta
  quando a última termina. Nunca guardar "o cursor de antes" (deixava o ponteiro preso em carregando — corrigido na 1.0.51).

## Acessibilidade
`aria-busy="true"` na região; texto do indicador lido pelo leitor de tela. WinForms: `Cursor = WaitCursor` só
durante operação bloqueante curta.

## Implementação
WinForms: **`IndicadorCarregando`** (arco girando) e `Botao.Carregando`/`AoClicar` (rótulo com "…", sem clique duplo) prontos em Comum; esqueleto de lista fica para a migração das tabelas. Web: `Esqueleto`, `Indicador`. timing-ui: `.report-loading`.

# Tokens de design

**Fonte única:** [`tokens/kib.tokens.json`](../../../tokens/kib.tokens.json) (formato W3C Design Tokens / DTCG).
Tudo o mais é **gerado** — nunca edite um arquivo gerado à mão.

```
tokens/kib.tokens.json ──npm run tokens──┬─► styles/tokens.css                       (site + admin, Next.js)
                                         ├─► services/timing-ui/tokens.css           (servido em /tokens.css)
                                         ├─► desktop/src/Kartodromo.Comum/Tokens.g.cs (apps .NET)
                                         ├─► android/sorteio/.../design/Tokens.kt     (Compose)
                                         ├─► android/sorteio/.../res/values/cores_tokens.xml
                                         └─► docs/design-system/02-tokens/referencia.md
```

## As três camadas

| Camada | Prefixo | Exemplo | Quem usa |
|---|---|---|---|
| **Primitivo** — valores puros, sem significado | `primitivo.*` | `primitivo.cor.verde.650` = `#0B7A53` | **só** os tokens semânticos |
| **Semântico** — o papel na interface | `cor.*`, `fonte.*`, `espaco.*`, `raio.*`, `elevacao.*`, `movimento.*`, `foco.*`, `tela.*` | `cor.acao.principal` → `{primitivo.cor.verde.650}` | telas e componentes |
| **Componente** — decisões de um componente | `componente.*` | `componente.controle.altura-m` = 40 | o componente correspondente |

Mais uma camada de transição: **`legado.desktop.*`** — os 44 nomes antigos do `Tokens.cs` com o **valor exato de
hoje** (marcados `$deprecated`). Existem para que nenhuma tela mude enquanto a migração não chega nela.

**Regra:** tela nunca usa `primitivo.*`. Se nenhum semântico serve, proponha um ([08-governanca/como-propor-mudanca.md](../08-governanca/como-propor-mudanca.md)).

## Temas

O valor em `$value` é o **tema claro (operação)**. O escuro (público) fica em `$extensions.kib.temas.escuro`. Todo token
semântico de cor tem os dois. O gerador confere que os tipos batem.

```json
"principal": {
  "$type": "color",
  "$value": "{primitivo.cor.verde.650}",
  "$extensions": { "kib": { "temas": { "escuro": "{primitivo.cor.neon.500}" } } }
}
```

## Nomes

`categoria.papel.variante[.estado]`, minúsculas, palavras em português sem acento, hífen dentro do segmento:
`cor.estado.perigo.texto`, `fonte.tamanho.titulo-grande`, `componente.totem.alvo-toque`.
Detalhes em [07-arquitetura/convencoes-de-nomes.md](../07-arquitetura/convencoes-de-nomes.md).

## Como consumir

| Plataforma | Claro | Escuro |
|---|---|---|
| CSS (site, admin) | `<html data-tema="claro">` ou `.kib-tema-claro` + `var(--kib-cor-acao-principal)` | padrão (`:root`) |
| timing-ui (HTML) | `<link rel="stylesheet" href="/tokens.css">` + `data-tema="claro"` no `<html>` | padrão |
| WinForms | `Tokens.Claro.CorAcaoPrincipal`, `Tokens.Fonte(13)` | `Tokens.Escuro.*` |
| Compose | `Tokens.Claro.CorAcaoPrincipal` | `Tokens.Escuro.*` |
| Android XML | `@color/kib_claro_cor_acao_principal` | `@color/kib_escuro_*` |

Tamanhos na web saem em `px` (o site converte para `rem` quando precisar escalar). No C#, dimensões são `int` em pixels
lógicos e cores são `Color`.

## Contraste

Cada token de cor que é texto, borda ou ícone declara contra o que precisa contrastar, em
`$extensions.kib.contraste`: `[{ "sobre": "cor.superficie.padrao", "min": 4.5 }]`. O build confere nos **dois temas**
(transparência é composta sobre o fundo) e **falha** se algum par reprovar; `"nivel": "aviso"` registra uma decisão
pendente sem falhar.

## Comandos

```bash
npm run tokens
```
Gera todas as saídas.

```bash
npm run tokens:check
```
Confere que as saídas versionadas estão em dia (roda no CI).

```bash
npm run lint:design
```
Reprova cor/fonte nova escrita fora dos tokens ([07-arquitetura/proibicao-de-hardcode.md](../07-arquitetura/proibicao-de-hardcode.md)).

Referência completa, com amostras e contraste: [referencia.md](referencia.md). Política de versão: [versionamento.md](versionamento.md).

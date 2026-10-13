# Versionamento dos tokens

A versão dos tokens (SemVer) é a do topo do [changelog](../08-governanca/changelog.md); cada mudança no
`tokens/kib.tokens.json` entra lá. Versão atual: **1.4.0**.

| Mudança | Versão | Exemplo | Exige |
|---|---|---|---|
| Novo token | menor (1.**1**.0) | `cor.estado.info.borda` | revisão de nome |
| Ajuste de valor sem efeito visível relevante | correção (1.0.**1**) | arredondar sombra | autoteste das telas afetadas |
| Ajuste de valor **visível** | menor + aviso | trocar `cor.borda.campo` | aprovação do dono + fotos antes/depois |
| Renomear ou remover | **maior** (**2**.0.0) | `cor.texto.terciario` → `cor.texto.dica` | período de convivência |

## Depreciação

1. Marque o token com `"$deprecated": "use {novo.nome}"` — o gerador mantém a saída e a referência marca como obsoleto.
2. Migre os usos (o `lint:design` e uma busca pelo nome mostram onde estão).
3. Remova na próxima versão maior, quando a busca der zero.

Os `legado.desktop.*` seguem esta regra: somem quando a fase de migração do app correspondente terminar
([07-arquitetura/refatoracao-proposta.md](../07-arquitetura/refatoracao-proposta.md)).

## Garantias automáticas

- `tests/design-tokens/legado-desktop.snapshot.json` — os nomes legados não mudam de valor sem alguém atualizar o
  snapshot de propósito.
- `npm run tokens:check` no CI — ninguém esquece de gerar.
- Contraste no build — nenhum par obrigatório piora.
- Telão congelado — teste garante que `tv.html`/`tb50.html` não importam `tokens.css`.

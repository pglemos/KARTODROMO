# Snapshot de produção — 23/10/2026 (RESOLVIDO)

RESOLVIDO: o código legível estava no branch `orbits/app-integrado` e foi mesclado no `main`
em 23/10 (commit de merge incluindo clientes.ts, perfil.ts e ranking.ts). O bundle recompilhado
a partir do `main` ficou funcionalmente igual a este snapshot. Mantido como evidência histórica.

O Worker publicado (`kartodromo-cadastro`, por trás de `reservas.kartodromodebetim.com.br` e
`cadastro.kartodromodebetim.com.br`) estava **à frente do `main`**: tem o template novo de e-mail
(escuro, com logo/gif do kart, vantagens, categorias, cota de 2.500/mês) e módulos que não estavam
no repositório (`src/mobile/clientes.ts`, `src/mobile/perfil.ts` — foto do piloto — e
`src/mobile/ranking.ts`).

`index.js` aqui é o bundle decompilado extraído da API do Cloudflare em 23/10/2026 (código
minificado, sem segredos — todos os valores sensíveis continuam em bindings/secret). Use-o como
referência para reconstruir o código legível; **não publique nada deste arquivo direto**.

## Nunca fazer até o código destas mudanças estar de volta no repositório

- `npx wrangler deploy -c workers/pre-cadastro/wrangler.jsonc` com o `src` atual do `main`
  → apagaria o template novo do e-mail e os módulos de perfil/ranking/foto de produção.
- Trocar o `main` em `/tmp/cf-cadastro-index.js` de lugar sem conferir este README.

O `main` do KARTODROMO precisa receber de volta o código legível destas movidas assim que a
sessão (ChatGPT/Claude) que publicou esta versão reenviar os arquivos-fonte.

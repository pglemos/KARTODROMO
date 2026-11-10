# Worker kartodromo-cadastro: link do grupo com pagamento (10/11/2026)

Problema: o deploy de 08/11 (wrangler, a partir do fonte) tirou do worker no ar as rotas `/api/grupo`, `/api/grupo/pagamento`,
`PUT /api/sync/grupos` e a cobrança Asaas do link do grupo. A página não tinha etapa de pagamento.

O worker no ar tem código que NÃO está em `workers/pre-cadastro/src` (identificar cliente, `/api/sync/grupos/pagos`, etc.).
Nunca rode `wrangler deploy` do fonte por cima: baixe o bundle, remende e suba.

Como foi feito: bundle baixado -> `extrair.mjs` (tira o multipart) -> `../cadastro-20261105/worker-grupo.mjs`
(com a `pagina-grupo.html` desta pasta, gerada por `pagina-pagamento.mjs` a partir de `pagina-base.html` = página que estava no ar)
-> `../cadastro-20261105/subir.mjs index2.js`.
O `patch.mjs` antigo (campos obrigatórios dos pilotos extras) NÃO foi aplicado: o reservar.html no ar não envia endereço dos extras.

Cobrança só nos grupos `individual` (cada um paga a sua vaga). `unico` e `sinal`: o responsável paga pelo painel.

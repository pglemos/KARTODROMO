> **Histórico (12/11/2026):** tudo isto já está em `workers/pre-cadastro` e o worker no ar é igual ao fonte. Não use estes scripts para publicar.

﻿# Worker kartodromo-cadastro no ar (05/11/2026)

O código no ar NÃO é gerado de `workers/pre-cadastro`: é o bundle que estava publicado (outra sessão), baixado pela API
e remendado. `index2.js` é exatamente o que está no ar. Para publicar de novo: `npx wrangler whoami` (renova o token)
e `node subir.mjs index2.js` nesta pasta (keep_assets + keep_bindings).

- patch.mjs: pilotos extras da reserva online com todos os campos obrigatórios.
- pagina-grupo.mjs / pagina-grupo.html: pré-cadastro com todos os campos obrigatórios, faixa do grupo (?r=) e pagamento.
- worker-grupo.mjs: rotas /api/grupo, /api/grupo/pagamento, /api/sync/grupos e cobrança Asaas no fim do cadastro.
- teste.mjs: reserva com piloto extra incompleto tem de voltar 400.

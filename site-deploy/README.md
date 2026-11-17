# site-deploy — site institucional publicado (kartodromo-site-2026)

Cópia exata do pacote que estava no ar na Cloudflare em 17/11/2026: `worker.js` e o módulo da política de cancelamento vêm do bundle baixado pela API; `dist/` foi recuperado do site no ar (rotas, referências e os `/media/*` vistos no analytics), com o HTML no formato original (o Worker troca o script antigo pelo pacote da política na hora de servir).

Roda no kart-edge da VPS (`services/edge`). Publicar: `sh services/edge/publicar.sh`.
O site vai ser refeito do zero; não remende este pacote além do necessário.

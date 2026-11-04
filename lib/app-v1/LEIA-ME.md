# Backend do app operacional (`/api/app/v1`)

Copiado em 2026-11-04 de `C:\repos\KARTODROMO\lib\app-v1` no servidor orbits, onde estava sem versionamento.
Carregado por `services/timing-server.ts` (`criarModuloApp`); só liga com `APP_V1_TOKEN_SECRET`.

Rotas que o app (`kartodromo-operacional` 1.1.0) chama e este módulo ainda NÃO implementa:
- `/lessons` e `/lessons/:id/accept` (Aulas e recibos)
- `/maintenance/orders` (Ordens de serviço)
- `/equalization/compare` (Comparar 5 melhores tempos)

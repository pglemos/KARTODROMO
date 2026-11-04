# Backend do app operacional (`/api/app/v1`)

Copiado em 2026-11-04 de `C:\repos\KARTODROMO\lib\app-v1` no servidor orbits, onde estava sem versionamento.
Carregado por `services/timing-server.ts` (`criarModuloApp`); só liga com `APP_V1_TOKEN_SECRET`.

Rotas que o app (`kartodromo-operacional` 1.1.0) chama e este módulo ainda NÃO implementa:
- `/lessons` e `/lessons/:id/accept` (Aulas e recibos)
- `/maintenance/orders` (Ordens de serviço)
- `/equalization/compare` (Comparar 5 melhores tempos)

## Atualização 2026-11-04
Implementadas aqui (ainda NÃO publicadas no servidor): `/lessons`, `/lessons/create`, `/lessons/:id/accept`,
`/maintenance/orders`, `/maintenance/orders/create`, `/maintenance/orders/:id/status`
(`aulas-manutencao.ts`, tabelas `aulas_recibos` e `ordens_servico` em `store.ts`, capacidades em `auth.ts`).
`/equalization/compare` implementado em `comparacao.ts` (usa `/api/ranking-karts?kart=`: a melhor volta de cada bateria nos últimos 15 dias). Ainda não publicado.
Para publicar: copiar `aulas-manutencao.ts`, `comparacao.ts`, `auth.ts`, `rotas.ts`, `store.ts` para `lib/app-v1` no orbits e reiniciar o timing-server.

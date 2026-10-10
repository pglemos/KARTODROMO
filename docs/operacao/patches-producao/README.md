# Mudanças feitas direto na produção (09–10/10/2026) — incorporar no código-fonte antes de publicar

O código-fonte dos Workers `kartodromo-site-2026` e `kartodromo-reservas-2026` não está neste repositório (o Codex
publicou pacotes compilados). Em 09/10 o dono pediu duas mudanças urgentes, aplicadas **nos pacotes já publicados**.
**Quem publicar esses Workers de novo a partir do código-fonte precisa trazer estas mudanças junto — senão elas somem
do ar.** Depois de incorporar, apague este aviso do `AGENTS.md`.

## 1. Política de cancelamento e reembolso (site + reserva)

- Texto oficial (7 seções), versão `2026-10-09`: `src/config/politica-cancelamento.ts` (`POLITICA_SECOES`, `POLITICA_VERSAO`,
  `POLITICA_ACEITE`) e o componente `src/components/site-ui/PoliticaCancelamento.tsx`.
- **Site (`kartodromo-site-2026`)**: /reservas mostra a política completa depois do FAQ. Aplicado com um wrapper do
  Worker (`site-2026-worker-wrapper.js`) que serve `/ui-assets/index-politica-20261009.js` (pacote alterado por
  `site-politica2.mjs`) e troca o `<script src>` de `index-B2k-39J7.js` com HTMLRewriter.
- **Reserva (`kartodromo-reservas-2026`)**: antes de pagar a pessoa **vê a política e marca "Li e aceito"** (obrigatório);
  o pedido leva `politica: { versao, aceitaEm }`. O Worker `kartodromo-cadastro` (`workers/pre-cadastro`, este repo)
  recusa pedido sem aceite e serve o texto em `GET /api/reservas/politica`.

## 2. Uma vaga por pessoa (reserva com mais de 1 piloto)

- Na etapa 3 da reserva: seção **"Quem vai pilotar"** com a caixa "Eu também vou pilotar nesta reserva" e, para cada
  vaga a mais, nome completo, CPF e data de nascimento (idade mínima 14, CPF válido e sem repetir — nem o do comprador).
- Campos novos no pedido: `compradorPilota` (bool), `acompanhantes: [{ nome, cpf, nascimento }]`, `pilotos: string[]`.
  Validação no servidor: `workers/pre-cadastro/src/validar.ts`; gravação: `lib/ops/reserva-online.ts` (cada vaga no
  nome de uma pessoa, `inscreverN(..., { clientes })`).
- Aplicado no pacote da reserva por `patch-pilotos.mjs` (gera `booking-assets/index-pilotos-20261009.js`; os JS
  antigos ficam publicados para HTML em cache).

## 3. Transmissão ao vivo saiu do Next (10/10)

`kartodromodebetim.com.br/api/transmissao/*` agora é atendido pelo Worker **`kartodromo-transmissao`**
(`workers/transmissao`, rota mais específica que a do site). Não criar rota que capture esse caminho antes dele.
Motivo: pelo Next, ~7% dos envios do ORBITS davam HTTP 500 (`exceededResources`).

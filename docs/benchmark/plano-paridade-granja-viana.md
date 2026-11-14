# Plano: paridade com a Reserva Online do Granja Viana

Base: auditorias de 10/11 ([público](granja-viana-reservas-2026-11-10.md), [logado](granja-viana-auditoria-logado-2026-11-10.md)).
Status: ✅ no ar · 🔶 parcial · ⬜ falta.

## Front da reserva reconstruído (11/11)
Fonte em `apps/reservas` (Vite + React). `npx vite build --config apps/reservas/vite.config.ts` gera em `reservas-deploy/dist`, e `cd reservas-deploy && npx wrangler deploy` publica. Para voltar ao bundle antigo, troque o `index.html` pelo que aponta para `index-campos-20261110.js` (os arquivos continuam em `dist`).

## Bloqueio técnico (resolvido)
O site `reservas.kartodromodebetim.com.br` só existe como **bundle compilado** em `reservas-deploy/dist/booking-assets/index-campos-20261110.js`. Esse bundle é React minificado, com 286 KB.
- O código-fonte **não está** no repositório nem em `~/PROJETOS`.
- Qualquer item marcado [R] abaixo depende de **reconstruir o front da reserva com código-fonte** no repo (ex.: `apps/reservas`, Vite + React, com o mesmo visual).
- A outra saída é remendar o minificado, o que é frágil e já causou regressões (05/11).
- O backend (`workers/pre-cadastro` + remendos em `docs/operacao/patches-producao`) e o SRVKART (`lib/ops`) têm fonte e podem evoluir já.

## Fluxos e funcionalidades do KGV × Betim

| # | Funcionalidade KGV | Betim | Onde | Status |
|---|---|---|---|---|
| 1 | Painel do organizador (KPIs, status por vaga, copiar/WhatsApp) | painel `/painel` | cadastro + SRVKART | ✅ |
| 2 | Pagamento pelo link não cobra amigo pelo grupo | correção 10/11 | cadastro | ✅ |
| 3 | Convite por vaga com expiração na largada | painel diz "vale até a largada"; vagas sem pagamento soltam 24 h antes | SRVKART + cadastro | ✅ |
| 4 | "Irei participar": organizador ocupa uma vaga | só pela recepção | painel + SRVKART | ⬜ |
| 5 | Remover/trocar participante pelo organizador | "liberar vaga" no painel + e-mail de remoção | painel + SRVKART | ✅ |
| 6 | Pagamento individual por participante | modo `individual` | — | ✅ |
| 7 | Termo de responsabilidade aceito online, versionado | aceite no cadastro + e-mail de comprovante | cadastro + SRVKART | ✅ |
| 8 | PDF do termo com dados do cliente | impressão na recepção (`lib/ops/termo.ts`) | SRVKART | 🔶 |
| 9 | Pagamento bloqueado até todos aceitarem o termo (bateria aberta com grupo) | — | reserva [R] + cadastro | ⬜ (decisão de negócio: pode travar venda) |
| 10 | Aviso operacional editável (faixa no topo) | — | reserva [R] + cadastro + admin | ✅ |
| 11 | Vagas restantes por horário | — | reserva [R] + API | ✅ |
| 12 | Selo bateria aberta/fechada | — | reserva [R] | ⬜ |
| 13 | Ocultar horários indisponíveis | — | reserva [R] | ✅ |
| 14 | Compartilhar link da data (`?data=`) | — | reserva [R] | ✅ |
| 15 | Limite de vagas por CPF por horário | CPF único por piloto | API | 🔶 |
| 16 | Voucher / cupom no checkout | campo de cupom no checkout | reserva + API | ✅ |
| 17 | Desconto por quantidade (KGV: 40% na taxa a partir de 10) | — | API + reserva [R] | ⬜ (definir regra de preço) |
| 18 | Garantia de Reagendamento (add-on pago) | — | API + reserva [R] | ⬜ (definir preço/regra) |
| 19 | Cartão com parcelas + motivo de recusa | Asaas checkout | API | 🔶 |
| 20 | PIX com QR, validade e reaproveitamento da cobrança | ✅ | — | ✅ |
| 21 | Minhas reservas: ver, pagar pendente, cancelar | CPF + código; cancelar pela recepção (WhatsApp) | reserva + API | 🔶 |
| 22 | Política de cancelamento escalonada calculada | texto genérico + `politica-cancelamento` | API | 🔶 (definir prazos) |
| 23 | Minhas corridas / histórico por piloto | aba Minhas corridas | site + API | ✅ |
| 24 | Check-in mobile (GPS, janela de horário) | botão no celular, termo impresso na recepção | site + SRVKART | ✅ |
| 25 | Cadastro: estrangeiro / passaporte | cadastro aceita RG/passaporte | reserva [R] | 🔶 |
| 26 | Campos travados após cadastro (nome, CPF, e-mail) | — | cadastro | ⬜ |
| 27 | Banner de cookies LGPD | não se aplica: sites não usam cookies de rastreio | — | ✅ |
| 28 | Versão em inglês | site de reservas (PT/EN); cadastro e painel só PT | reserva | 🔶 |
| 29 | Bateria fechada empresarial, sem cobrança imediata (faturamento) | recepção | SRVKART + admin | ⬜ |
| 30 | Mensagens de erro específicas (timeout, sessão, servidor) | 🔶 | reserva [R] | ✅ |

## E-mails (13/11)
Paridade com os e-mails do KGV (caixa pglemos31): agendamento/falta pagar, pagamento recebido, reserva confirmada, cancelamento automático, horário indisponível, pago sem vaga, confirmação de participação, termo assinado, remoção de participação, recuperação de senha. Fonte: `workers/pre-cadastro/src/emails-reserva.ts` e `lembretes.ts` (tipo `removido`, enviado pelo SRVKART).

## Ordem proposta
1. **Reconstruir o front da reserva com fonte no repo** (pré-requisito de 9–14, 16–18, 21, 25, 27, 28, 30), com a mesma API e o mesmo visual. Deploy pelo `kartodromo-reservas-2026`.
2. **Termo digital** (7, 8, 26) no cadastro + SRVKART.
3. **Painel v2** (3, 4, 5): ações do organizador, que gravam no SRVKART via fila no R2.
4. **Agenda** (10–15) no front novo.
5. **Checkout** (16–19, 22).
6. **Minhas reservas por link mágico** (21).
7. Check-in mobile, histórico, inglês, empresa (23, 24, 28, 29).

## Decisões de negócio pendentes (dono)
- Bloquear o pagamento até todos aceitarem o termo? O KGV bloqueia, o que segura a vaga sem pagar. Recomendação: **não bloquear**, só mostrar "X/Y aceitaram".
- Regras de desconto por quantidade e de garantia de reagendamento (valores).
- Prazos da política escalonada (KGV: 7/2 dias para aberta; 15/7 dias para fechada).
- O termo vale online, ou continua precisando de assinatura física?

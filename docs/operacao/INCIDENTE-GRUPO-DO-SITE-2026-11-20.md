# Incidente: "cada um paga o seu" pago sem grupo (17 a 20/11/2026)

## Sintoma
Reserva BPQXHS (João Victor Lima Pinto, 10 pilotos, dom 22/11 09:50): pagamento da vaga do organizador entrou, mas
os amigos não tinham link para pagar, o e-mail "Reserva confirmada" não saiu e a Agenda não oferecia gerenciar o grupo.

## Causa
1. `lib/ops/grupos.ts` › `grupoDaReservaOnline`: o INSERT em `kart.reserva_grupo_piloto` gravava o literal `0` na
   coluna `menor`. No SQL Server a coluna era `bit`; desde a virada para Postgres (17/11 00:13) ela é `boolean`, e
   literal inteiro em coluna boolean é erro (parâmetro `@m` passa; literal não). Log: `coluna "menor" é do tipo
   boolean mas expressão é do tipo integer`.
2. Ninguém tentava de novo: o site só devolve ao SRVKART pedidos `novo`/`pago`, e o pedido já estava `confirmado`.
3. O e-mail "Reserva confirmada" do "cada um paga o seu" espera o grupo existir (`emails-reserva.ts`), por isso
   também não saiu.

## Correção (KARTODROMO `ddad8f9`, publicada em 20/11 ~16:50)
- Literal `false` no INSERT; teste `tests/ops/grupo-do-site-postgres.test.ts` (reprova sem o conserto).
- Site mantém na fila o "cada um paga o seu" confirmado sem grupo; SRVKART chama `confirmarPagamento` de novo, que
  recria o grupo e devolve os links (teste em `tests/reserva-online.test.ts`).
- Script `scripts/ops/reenviar-grupo-do-pedido.ts <CODIGO>` para recuperar pedidos antigos.

## Pedidos recuperados
| Reserva | Pilotos | Bateria | Grupo | E-mail "confirmada" |
|---|---|---|---|---|
| BPQXHS | 10 | dom 22/11 09:50 | GC323B8C | 20/11 16:51 |
| VZNDCC | 10 | sáb 29/11 09:50 | GD2089D5 | 20/11 16:53 |
| 3UVCTN | 2 | sex 21/11 09:50 | G22D8A8E | 20/11 16:55 — a vaga do amigo saiu pela regra das 24 h (dono autorizou); o organizador recebe o aviso de vaga solta e o amigo pode reservar de novo |

## Como conferir se há outro
Consulta em `reserva_online` com status `pago`, primeira inscrição com "cada um paga o seu" e sem `reserva_grupo` de
origem `site` com a marca da reserva — em 20/11 só havia estas três.

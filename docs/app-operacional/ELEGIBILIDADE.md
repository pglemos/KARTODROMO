# Elegibilidade por evidência

## O que os campos significam
| Evento | Efeito | Evidência |
|---|---|---|
| "Aprovar pré-reserva (sem pagamento)" | `Aprovada=1`; `Pago=1` só quando o total é zero | `lib/ops/office.ts:1554-1566` |
| Pagamento no caixa | `Pago=1`, `Aprovada=1`, `Status='confirmada'` | `office.ts:594` |
| Termo | `TermoImpressoEm`, independente dos outros; mudar produto pode zerar | `office.ts:202-203`, `:1481`, `:1493` |
| Lista "pendentes" | `Aprovada=1 AND Pago=0` existe como situação oficial | `office.ts:1057` |

**Conclusão: `aprovada=1` não implica pagamento nem termo.** A hipótese de equivalência do PRD é falsa.

## Por que "às vezes" aparece quem não foi aprovado
Há dois caminhos para a mesma bateria, com filtros diferentes:
1. Sincronização automática a cada 60 s (`timing-server.ts:2017`): só `pago !== false`, sem olhar `aprovada`.
2. `POST /api/agenda/:id/preparar` (`:3304`): **nenhum filtro**.

Quem criar primeiro decide a lista, porque `preparar` devolve a existente. Essa corrida é a explicação compatível com o código; ela **não foi reproduzida em bateria real**.

A sincronização também age depois do sorteio, enquanto a bateria está em `preparando`:
- acrescenta quem pagou depois, sem kart (`:2047-2052`), o que dispara `ListaMudouError`;
- **remove sozinha** quem saiu da agenda (`:1979-1984`). Isso contraria PRD 7.5 ("nunca excluir silenciosamente"), mas é comportamento da cronometragem e não será alterado; o app avisa ao detectar a saída.

## Predicado proposto
```text
sem agendaId                                 -> SEM_VINCULO (regras atuais, com etiqueta)
consulta falhou ou campo ausente             -> INDETERMINADA (bloqueia)
Status = 'cancelada'                         -> INELEGIVEL
Aprovada = 1 e Pago = 1                      -> ELEGIVEL
caso contrário                               -> INELEGIVEL, com motivo
```
**Decisões do dono no G0:** pendente com `Aprovada=1, Pago=0` pode correr? Termo é obrigatório? O grid atual não traz o termo; a rota nova precisaria lê-lo.

## Medição não feita
Contagem real das combinações: **NÃO VERIFICADO**. A rota da porta `7070` não devolveu dados sem chave, e não usei credenciais do servidor sem autorização expressa.

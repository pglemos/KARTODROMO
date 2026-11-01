# Elegibilidade por evidência

## O que os campos significam
| Evento | Efeito | Evidência |
|---|---|---|
| "Aprovar pré-reserva (sem pagamento)" | `Aprovada=1`; `Pago=1` só quando o total é zero | `lib/ops/office.ts:1554-1566` |
| Pagamento no caixa | `Pago=1`, `Aprovada=1`, `Status='confirmada'` | `office.ts:594` |
| Termo | `TermoImpressoEm`, independente dos outros; mudar produto pode zerar | `office.ts:202-203`, `:1481`, `:1493` |
| Lista "pendentes" | `Aprovada=1 AND Pago=0`, com total maior que 0 e fora de Endurance | `office.ts:1057` |
| Estorno | Também pode gerar `Aprovada=1, Pago=0` | `office.ts:648` |

**Conclusão: `aprovada=1` não implica pagamento nem termo.** A hipótese de equivalência do PRD é falsa.

## Por que "às vezes" aparece quem não foi aprovado
A lista depende de quem criou ou puxou a bateria. As entradas têm filtros diferentes:
| Entrada | Filtro | Evidência |
|---|---|---|
| Sincronização a cada 60 s | Só `pago !== false` | `timing-server.ts:2017` |
| `POST /api/agenda/:id/preparar` (1.6) | Nenhum | `timing-server.ts:3304` |
| "Puxar agenda" e similares no Windows | Nenhum | `Dialogos.cs:77`, `FormCrono.Catalogo.cs:291`, `FormCrono.cs:1424` (versão de desenvolvimento; a instalada não foi conferida) |
| Prova nova herdando da irmã | Copia a lista da irmã | `herdarCompetidores`, `timing-server.ts:565` |

O caminho sem filtro é a causa compatível com o código; **não foi reproduzido em bateria real**. Nos caminhos de `office.ts`, `Pago=1` sempre grava `Aprovada=1` (`:461`, `:594`, `:1557`), então a sincronização sozinha não deveria trazer não aprovado.

**Consequência:** filtrar só em `preparar` não resolve. O app aplica a elegibilidade **na hora de listar e de gravar o sorteio**, para qualquer lista com `agendaId`, sem importar como ela nasceu e sem mudar o Windows. Inscrito fora do critério aparece bloqueado, com motivo.

A sincronização também age enquanto a bateria está em `preparando`:
- acrescenta quem pagou depois, ao fim da lista e sem kart (`:2047-2052`). Isso **não** gera `ListaMudouError`: os índices não mudam, e o sorteio em andamento deixaria o novo piloto sem kart sem avisar. O adaptador compara a lista completa;
- **remove sozinha** quem saiu da agenda (`:1979-1984`). Remoção ou reordenação gera 409, ou 400 se o removido for o último. Contraria PRD 7.5, mas é comportamento da cronometragem e não será alterado; o app avisa ao detectar a saída.

## Predicado proposto
```text
sem agendaId                                 -> SEM_VINCULO (regras atuais, com etiqueta)
consulta falhou ou campo ausente             -> INDETERMINADA (bloqueia)
fora do grid (cancelada, o grid já exclui)    -> avisa que saiu da agenda
Aprovada = 1 e Pago = 1                      -> ELEGIVEL
caso contrário                               -> INELEGIVEL, com motivo
```
**Decisões do dono no G0:** pendente com `Aprovada=1, Pago=0` pode correr? Termo é obrigatório? Endurance e total zero sem `Pago=1` não são pendência financeira: o predicado precisa de exceção para eles, a confirmar. O grid atual não traz o termo; a rota nova precisaria lê-lo.

## Medição não feita
Contagem real das combinações: **NÃO VERIFICADO**. A rota da porta `7070` não devolveu dados sem chave, e não usei credenciais do servidor sem autorização expressa.

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

## Predicado aprovado pelo dono (31/10/2026)
```text
sem agendaId                               -> SEM_VINCULO (regras atuais, com etiqueta)
consulta falhou ou campo ausente           -> INDETERMINADA (bloqueia)
fora do grid (cancelada ou movida)         -> avisa que saiu da agenda
Aprovada=0                                 -> INELEGIVEL: não aprovado
termo ausente                              -> INELEGIVEL: sem termo
Pago=0, fora de Endurance, total > 0       -> INELEGIVEL: não pago
demais                                     -> ELEGIVEL
```
Termo é obrigatório. Endurance e valor zero são exceção **só ao pagamento**, não ao termo nem à aprovação. O grid atual não traz termo, total nem Endurance: a rota nova lê esses dados.

## Medição na produção (31/10/2026, só contagem, inscrições não canceladas criadas nos últimos 30 dias)
| Situação | Qtde |
|---|:--:|
| Total | 2.556 |
| Aprovada e paga, com termo | 2.318 |
| Aprovada e paga, **sem termo** | 236 (totem 150, site 80, recepção 6) |
| Não aprovada e não paga | 2 |
| Aprovada e não paga | 0 |

Limites: é o estado de agora, não o da hora do sorteio, então quem foi aprovado depois conta como aprovado e **isto não mede o bug**. O campo é `TermoImpressoEm`; não verifiquei se o site ou totem registram aceite de termo em outro lugar.

**Risco:** com a regra atual, cerca de **9,2%** dessas inscrições seriam bloqueadas no sorteio até a recepção marcar o termo.

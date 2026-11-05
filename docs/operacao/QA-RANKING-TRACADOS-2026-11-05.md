# Ranking: traçado histórico não confirmado — 05/11/2026

## Evidência e decisão

O proprietário informou que os tempos de 49.774, 50.925, 50.979, 51.006 e 51.130 exibidos em Traçado 1 / Super Kart não foram feitos nesse desenho. Na consulta de origem:

- 50.925 / 50.979 / 51.006 / 51.130 vieram de lt-506023, ULTRAS 2, 19/05/2026.
- 49.774 veio de lt-536130, Clube da Insônia, 31/05/2026.
- Tanto Racing.Id_RacingTrack quanto Booking.Id_RacingTrack gravaram 1 nessas baterias. O espelho contém 1.466 baterias com esse padrão. Não há outra identificação de desenho nas observações consultadas.
- O proprietário não lembra se foi traçado 9 ou 5. Nenhum tempo foi transferido para esses traçados sem confirmação.

## Correção

lib/ops/tracado-legado.ts separa o rótulo exato Traçado 1 (inclusive Normal / Super Kart) quando vem de registros lt-/lr- ou ranking legado LapTime. O rótulo passa a Traçado não confirmado na projeção; o original é preservado em tracadoOriginal. Esses registros não entram no ranking por traçado.

O histórico de corridas, as voltas e os tempos são preservados. Não houve alteração no SQL de origem, exclusão de pilotos ou reclassificação por velocidade. A cronometragem atual, o histórico CalXPro e traçados explícitos como Invertido e Chicane não são atingidos por essa regra. Traçados diferentes da carreira contam apenas desenhos confirmados.

## Publicação

Fonte de produção lida diretamente de C:\kartodromo-servidor\lib\ops\pilotos.ts (diferente da versão do repositório). Aplicado patch mínimo e adicionado tracado-legado.ts. As mesmas alterações foram incorporadas ao fonte local.

Backup de código e índices em C:\kartodromo-servidor\.runtime\backup-ranking-20261105. Antes do reinício, validado horário de madrugada, runningId vazio e zero impressões pendentes. Saúde do serviço confirmada após reinício.

Ranking e fichas foram republicados pelo publicador existente; 43.216 fichas atualizadas. Não houve deploy de Worker nem nova versão do aplicativo.

## Validação

- 24 testes direcionados aprovados, TypeScript e lint dos arquivos alterados aprovados.
- 38 consultas públicas: nove combinações de período/categoria e 12 traçados; filtro de traçado/categoria, ordenação, posições consecutivas, identidade de pilotos e limites do período verificados.
- Outros 18 grupos de traçado/categoria do ranking geral idênticos ao snapshot D1 anterior à correção.
- Traçado 1 / Super Kart / Geral passou a começar em 61.004 (Lucas Prates, 15/12/2024). O 49.774 contestado não aparece mais nesse ranking.
- Fichas dos cinco pilotos da imagem conferidas: os tempos contestados não aparecem associados a traçado confirmado.

## Limite conhecido

O desenho real dessas baterias do LapTime continua sem confirmação. Restaurar sua participação no ranking exige documentação ou confirmação confiável por bateria/data; não usar o tempo da volta para escolher entre 5 e 9.

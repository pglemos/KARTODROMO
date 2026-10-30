# Sincronização do ranking do app

O app consulta `/api/mobile/v1/ranking`. O Worker combina o ranking histórico com os registros completos `karts:AAAA-MM-DD`, aplica dia/categoria/traçado e só então escolhe a melhor volta por piloto e limita a resposta a 100 posições. `dias` contém todos os dias disponíveis, inclusive os que não aparecem no top 100.

- Indoor: kart 0–99. Super Kart: kart 100–199. A numeração prevalece sobre o texto da categoria.
- A categoria não faz parte do nome do traçado. Sentido invertido e chicane continuam distintos.
- Somente baterias encerradas, sem chuva/equalização e sem piloto desclassificado entram na publicação diária; não são resultados provisórios da bateria em andamento.

O publicador canônico é `scripts/ops/publicar-karts-app.mjs`. Executar no diretório do servidor de operações:

```powershell
node scripts/ops/publicar-karts-app.mjs --watch
```

Ele lê `.env.local` e `.runtime/pilotos-cronometragem.json`, consulta a cronometragem por HTTP e publica apenas os dias cujo hash mudou. Revalida todas as baterias encerradas ao iniciar e periodicamente (60 segundos após a última revisão completa), em lotes de três leituras concorrentes. Nos ciclos intermediários revisita as três últimas baterias e as novas. O ciclo espera 15 segundos após terminar o anterior. Não acessa o decoder nem reinicia serviços.

Não usar apenas `finishedAt` para invalidar o cache: editar o traçado de uma bateria encerrada não muda esse horário. Em 28/10 essa falha mantinha a bateria `2026-10-23-6662b237` no Traçado 1 embora a fonte já informasse Traçado 11 Normal, e o treino `2026-10-18-3625fc11` no Traçado 1 embora fosse Traçado 11 Invertido Chicane.

Ativado em 28/10/2026 no SRVKART pela tarefa `Kartodromo Ranking App Sync`, como SYSTEM, com início no boot e reinício em caso de queda. A cópia executada está em `C:\kartodromo-servidor\scripts\ops\sincronizar-ranking-app.mjs`. Atualizar essa cópia ao alterar o publicador; não reiniciar o servidor de operações nem a cronometragem para isso.

O aplicativo fonte passa a consultar a API a cada 15 segundos enquanto o ranking está aberto e ativo. Essa parte exige nova compilação nativa; a correção da API atende também o aplicativo já instalado após nova consulta.

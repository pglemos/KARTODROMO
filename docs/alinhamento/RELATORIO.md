# Relatório do alinhamento (31/10/2026)

Branch `alinhamento/base-app`, a partir do snapshot da produção mais `origin/main`. Só local, nada publicado.

## Evidência
- Vitest: 807 de 808. Falha `lint-hardcode` por cor literal em `Caixa.cs`, que veio da produção. Mantida; precisa atualizar a baseline ou trocar a cor em outro momento.
- Baseline do App Operacional: 10 de 10. `tsc` sem erros.
- Revisão independente: `timing-server` e `lib/timing` iguais à produção em comportamento; `desktop/src` idêntico após corrigir `Baterias.cs` e `ValidacaoCliente.cs`, que o merge havia trocado.
- Varredura de segredos: nada real pelos padrões usados. Ela não detecta nomes em texto livre.

## Não verificado
- C# não compilado nem testado: este Mac não tem o SDK de Windows Desktop.
- SRVKART não inspecionado.
- Worker publicado na Cloudflare não comparado.

## Falhas conhecidas que continuam
Em `origin/main`, `Baterias.cs` e `ValidacaoCliente.cs` têm problemas que a base não herda: formato de data com segundos e Instagram opcional. Quem publicar `origin/main` no Windows os recebe.

## Para o dono
1. Validação da reserva do site: qual é a correta (ver `MATRIZ.md`)?
2. Autorizar leitura no SRVKART e na Cloudflare.
3. Autorizar a Task 5: enviar as branches ao GitHub, sem mexer em `main`.

## Leituras autorizadas (31/10/2026)
- **SRVKART:** servidor `C:\kartodromo-servidor`, sem Git. Comparados 9 arquivos com `origin/main`, ignorando CR: 7 iguais; diferem `lib/ops/endurance-regras.ts` (21/10) e `lib/ops/painel.ts` (14/10). Antes de publicar `lib/ops`, conferir esses dois. O `ops-server.ts` do SRVKART é o do GitHub, então as citações de `lib/ops` devem usar esta base.
- **Cloudflare:** `kartodromo-cadastro` na versão `2bf8873e` (31/10, 14:24 UTC), feita por upload. O código publicado não foi baixado; **não sei qual validação da reserva está no ar**.
- **GitHub:** `pglemos/KARTODROMO` é **público**. Envio suspenso: o plano exige repositório privado.

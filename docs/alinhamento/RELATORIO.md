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

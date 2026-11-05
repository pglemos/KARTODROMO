# Progress — Worker M1

Last visited: 2026-10-26T19:47:30Z

## Status
Implementação da Milestone M1 (R1 — Itens 1 a 6) 100% concluída:
1. `lib/ops/termo.ts` modificado com `@page{size:80mm auto;margin:0}` e remoção de `min-height:297mm`.
2. `tests/ops/termo.test.ts` atualizado e passando (6/6).
3. `services/ops-server.ts` atualizado com persistência SQL em `dbo.FilaImpressao`, lock atômico `UPDLOCK, READPAST`, reentrega 90s, contingência após 3h e proteção contra Head-of-Line blocking.
4. `desktop/src/Kartodromo.Comum/Relatorio.cs` atualizado com método `ImpressoraExiste`, validação prévia de existência de impressora em `ImprimirSilencioso`, timeout de 10s e bloco `finally`.
5. `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` atualizado para eliminar impressão cega sem impressora válida e orientar retirada na Recepção na `TelaSucesso`.
6. `scripts/apps/limpar-spooler-totem.ps1` criado com purga segura via CIM `CancelAllJobs` e `Remove-PrintJob` sem interrupção do Spooler.
7. Suíte `npx vitest run tests/ops/` executada com sucesso total: 16 arquivos, 210 testes aprovados.
8. Checagem `npx tsc --noEmit` confirmada sem nenhum erro novo.

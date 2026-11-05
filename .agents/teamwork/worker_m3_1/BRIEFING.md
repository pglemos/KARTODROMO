# BRIEFING — 2026-10-26T22:57:00Z

## Mission
Implementar Milestone M3: Desktop Comum & Periféricos (Polling inteligente de impressão, timeout WebView2, tratamento 401 não-bloqueante, corte de bobina TM-T20X, monitoramento de spooler, correção de cursor jumping em máscaras, validações de cliente, redução de timeout HTTP e eliminação de vazamento de regiões GDI).

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m3_1
- Original parent: 5717774c-5184-48e4-9f3d-92886d69aed2
- Milestone: M3 (Desktop Comum & Periféricos)

## 🔒 Key Constraints
- Responder sempre em pt-BR.
- Apps são Windows nativos (`desktop/`), sem web/Chrome no desktop.
- Não mexer no telão (`FormTV` / `--tv`).
- Integridade: sem hardcode de resultados, sem dummy/facade implementations.
- Posse de escrita exclusiva:
  - `desktop/src/Kartodromo.Comum/Relatorio.cs`
  - `desktop/src/Kartodromo.Comum/Ui.cs`
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`
  - `desktop/src/Kartodromo.Comum/Api.cs`
  - `desktop/src/Kartodromo.Comum/Design.cs`
  - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`
  - Testes em `tests/` relacionados ao desktop e periféricos
- Comunicação via `send_message` ao parent (`5717774c-5184-48e4-9f3d-92886d69aed2`).

## Current Parent
- Conversation ID: 5717774c-5184-48e4-9f3d-92886d69aed2
- Updated: 2026-10-26T22:57:00Z

## Task Summary
- **What to build**: Todos os 10 itens da Milestone M3 (Itens 4, 5, 6, 7, 8&9, 23, 26, 27, 28, 33) implementados com fidelidade técnica.
- **Success criteria**:
  - `AgenteImpressao.cs`: Polling inteligente (não inicia se `!existe`, log explícito, `Situacao`), tratamento 401 não-bloqueante (sem `Msg.Info`, pausa de 30s).
  - `Relatorio.cs`: Timeout de 15s no WebView2 silencioso com `TimeoutException`, corte dinâmico de bobina 80mm TM-T20X sem A4 fixo, métodos nativos `VerificarSpooler` e `LimparFilaSpooler` (`PRINTER_CONTROL_PURGE`).
  - `Ui.cs`: `CalcularCursorMascara` e `Mascara` corrigindo cursor jumping em posições intermediárias e fim.
  - `ValidacaoCliente.cs`: Instagram opcional (retorna `null` se vazio) e peso harmonizado (10 kg a 250 kg).
  - `Api.cs`: Timeout padrão do `HttpClient` reduzido de 30s para 10s e propriedade `Timeout`.
  - `Design.cs`: Descarte determinístico de `Region` GDI (`antiga?.Dispose()`) em `Recortar` e `AjustarContorno`.
  - Testes: Suíte dedicada `tests/desktop-m3-perifericos.test.ts` com 24 testes passando 100%.

## Key Decisions Made
- Adicionadas rotinas Win32 nativas P/Invoke em `winspool.drv` (`OpenPrinter`, `GetPrinter`, `SetPrinter`) para monitoramento detalhado e saneamento (`PRINTER_CONTROL_PURGE = 3`) sem dependências pesadas de WMI.
- Exposta a função `Ui.CalcularCursorMascara` para cálculo estático e testabilidade direta de posições de cursor em máscaras.
- O timeout do `HttpClient` foi ajustado de 30s para 10s, conferindo resiliência rápida no balcão sem falsos timeouts em rede local.

## Artifact Index
- `.agents/teamwork/worker_m3_1/DISPATCH.md` — Histórico de despacho
- `.agents/teamwork/worker_m3_1/BRIEFING.md` — Memória persistente
- `.agents/teamwork/worker_m3_1/progress.md` — Rastreamento de execução
- `.agents/teamwork/worker_m3_1/handoff.md` — Relatório de entrega
- `tests/desktop-m3-perifericos.test.ts` — Suíte de testes automatizados da M3

## Change Tracker
- **Files modified**:
  - `desktop/src/Kartodromo.Comum/Relatorio.cs`: timeout 15s WebView2, corte de bobina dinâmico 80mm, rotinas nativas de spooler
  - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`: polling inteligente, tratamento 401 sem modal, integração com spooler
  - `desktop/src/Kartodromo.Comum/Ui.cs`: correção de cursor jumping e exposição de `CalcularCursorMascara`
  - `desktop/src/Kartodromo.Comum/Api.cs`: timeout padrão 10s e propriedade `Timeout`
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`: Instagram opcional e peso 10–250kg
  - `desktop/src/Kartodromo.Comum/Design.cs`: descarte de handles GDI Region
  - `tests/desktop-m3-perifericos.test.ts`: 24 testes unitários e de integração para a M3
- **Build status**: PASS (Vitest 5 suítes desktop com 36 testes passando 100%; E2E recepção com 87 testes passando 100%)
- **Pending issues**: Nenhum

## Quality Status
- **Build/test result**: PASS (100% dos testes desktop e periféricos)
- **Lint status**: Zero erros
- **Tests added/modified**: `tests/desktop-m3-perifericos.test.ts` (24 testes novos)

## Loaded Skills
- Nenhuma skill externa carregada.

## 2026-10-27T03:12:06Z
Você é worker_m4_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m4_1

Você DEVE ler obrigatoriamente antes de iniciar qualquer trabalho:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_desktop_survey_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m3_1/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Posse exclusiva de escrita (Write ownership):
- `desktop/src/Kartodromo.Recepcao/Caixa.cs`
- `desktop/src/Kartodromo.Recepcao/TelasCaixa.cs`
- Testes em `tests/` relacionados a Caixa e PDV

Missão:
Implementar a Milestone M4 (Desktop Recepção — Caixa & PDV) cobrindo todos os itens do inventário de recursos para M4:
1. Item 10: Vulnerabilidade no Cálculo de Troco (`Caixa.cs:596-601`):
   - Troco em dinheiro físico só pode existir se houver pagamento em DINHEIRO (`forma == "dinheiro"` ou equivalente), limitado ao excesso pago em dinheiro (`Math.Min(excessoTotal, totalDinheiroPago - subtotalRestante)`).
   - Para pagamentos exclusivos em Cartão (Crédito/Débito) ou Pix, troco DEVE SER SEMPRE ZERO (`troco = 0`). O sistema NÃO pode autorizar nem calcular troco em dinheiro da gaveta para valores passados a mais no cartão/pix.
2. Item 11: Trava de Idempotência e Bloqueio de Duplo Clique no Checkout (`Caixa.cs:640, 729-730`):
   - No clique de "Concluir", desabilitar imediatamente o botão `_btnConcluir.Enabled = false` para impedir cliques concorrentes ou duplicados.
   - Gerar `idempotencyKey` única por tentativa de venda (ex: `Guid.NewGuid().ToString("N")`) e enviar no payload de `POST /api/office/vendas`.
   - Garantir que se o pagamento não for liberado ou se faltar valor a pagar (`t.falta > 0`), o checkout seja bloqueado e não permita concluir venda com valor faltante.
3. Item 12: Validação de Saldo Físico em Sangria (`TelasCaixa.cs:233-238`):
   - Na rotina de Sangria, validar se `valor <= dinheiroEmCaixa`. Se o valor for maior que o dinheiro disponível na gaveta física, bloquear a transação com mensagem de aviso clara (`"Valor de sangria não pode ser superior ao dinheiro disponível em caixa."`) e foco no campo.
4. Item 13: Consistência no Fechamento de Caixa (`TelasCaixa.cs:192-195`):
   - Na rotina de fechamento de terminal, validar que `valor >= 0` e `valor <= dinheiroEmCaixa`. O valor para o próximo turno não pode ser negativo nem superior ao dinheiro que realmente existe na gaveta física.
5. Item 14: Desvinculação Limpa de Vouchers no PDV (`Caixa.cs:695-703`):
   - Permitir remover/desvincular o voucher de um item do carrinho sem precisar excluir o item de corrida da venda, restaurando o valor original e recalculando acréscimos/descontos corretamente.
6. Item 36: Prevenção de Exceção em LinearGradientBrush (`Caixa.cs:233, 252`):
   - Antes de instanciar `new LinearGradientBrush(resumo.ClientRectangle, ...)`, verificar `if (resumo.ClientRectangle.Width <= 0 || resumo.ClientRectangle.Height <= 0) return;`, prevenindo quebras não tratadas no evento Paint durante redimensionamento ou minimização da janela.
7. Verificação:
   - Criar suíte de testes dedicada `tests/desktop-m4-caixa.test.ts` cobrindo todas as novas regras de negócio e validações.
   - Executar os testes automatizados (`npx vitest run tests/desktop-m4-caixa.test.ts`, `npx vitest run tests/desktop-*.test.ts`, `npx vitest run tests/e2e-recepcao/`).
   - Elaborar relatório handoff.md completo e notificar o orquestrador via send_message.

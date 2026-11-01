## 2026-10-26T19:24:26Z
[Message] timestamp=2026-10-26T19:24:26Z sender=5c17e886-4fbe-41e6-80a1-62db6f4ee87a priority=MESSAGE_PRIORITY_HIGH content=Você é test_writer_e2e_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/test_writer_e2e_1
Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_1/PROJECT.md
- docs/operacao/HANDOFF-SISTEMA-PROPRIO.md
- AGENTS.md

Posse exclusiva de escrita (Write ownership):
- `tests/e2e-recepcao/` (todos os testes E2E aqui)
- `TEST_INFRA.md`
- `TEST_READY.md`

Missão:
Construir a suíte de testes ponta a ponta (E2E) opaca e orientada a requisitos para os 36 problemas da Recepção (Itens 1 a 36 descritos no Feature Inventory de PROJECT.md).
Adote a metodologia de 4 Tiers:
- Tier 1: Cobertura de funcionalidades (testes para fila de impressão, caixa/PDV, baterias, clientes/PII, sincronização e estabilidade)
- Tier 2: Casos de borda e limites (troco exato vs troco excessivo em cartão, carrinho zerado, bateria no minuto limite, tolerância de peso, máscara de telefone)
- Tier 3: Combinações entre funcionalidades (voucher + desconto, mover cliente em bateria paga vs não paga, preservação de endereço com múltiplos campos)
- Tier 4: Cenários reais da operação (ciclo completo de turno do operador: abertura de caixa, múltiplas vendas, sangria com validação de saldo, estorno parcial, fechamento com próximo turno; enfileiramento e consumo concorrente de termos)

Documente a arquitetura dos testes em `TEST_INFRA.md` e quando a suíte estiver pronta e rodando com sucesso via `npx vitest run tests/e2e-recepcao/`, publique `TEST_READY.md`.
Salve seu relatório completo de entrega em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/test_writer_e2e_1/handoff.md

Ao concluir, envie mensagem via send_message ao orquestrador (5c17e886-4fbe-41e6-80a1-62db6f4ee87a).

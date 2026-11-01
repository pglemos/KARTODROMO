## 2026-10-27T03:30:28Z

Você é o Challenger 2 (teamwork_preview_challenger) para o Gate da Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_totem_m3_2/

Arquivos obrigatórios de leitura:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md (Itens 12 a 19)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_totem_m3_1/handoff.md

Sua missão adversarial:
1. Testar adversariamente os aspectos de integridade de dados e SQL dos Itens 15, 16, 18 e 19:
   - Preservação estrita de Numero e Complemento sob updates parciais (garantir que nunca fiquem NULL).
   - Injeções SQL em parâmetros de baterias e identificação do totem.
   - Cálculo de cursor em máscaras (CalcularCursorMascara) sob cenários complexos (remoção de caracteres no meio, colagem, substituição).
2. Executar testes e verificar integridade (`npx vitest run tests/ops/`).
3. Emitir veredito formal explícito: APPROVE ou REQUEST_CHANGES.
4. Escrever relatório completo em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_totem_m3_2/handoff.md e notificar via send_message.

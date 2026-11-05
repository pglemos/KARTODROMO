## 2026-10-27T03:30:28Z
Você é o Reviewer 2 (teamwork_preview_reviewer) para o Gate da Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_totem_m3_2/

Arquivos obrigatórios de leitura:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md (Itens 12 a 19)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_totem_m3_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/AGENTS.md

Sua missão de revisão:
1. Examinar com rigor o código modificado em:
   - services/ops-server.ts
   - lib/ops/db.ts
   - lib/ops/cadastro-obrigatorio.ts
   - tests/ops/m3-totem-validacao.test.ts
2. Verificar conformidade com:
   - Item 12: semInstagram persistindo NULL no banco sem quebrar updates parciais.
   - Item 13: aceitação de telefone internacional E.164.
   - Item 14: faixa de peso 10 a 250 kg.
   - Item 15: preservação integral de Numero e Complemento em dbo.Cliente.
   - Item 17: resposta HTTP 409 estruturada com `{ error: "documento_cadastrado", message, id, token }`.
   - Item 19: parametrização SQL estrita de baterias via @bat_N e @grp_N.
3. Executar os testes automatizados: `npx vitest run tests/ops/` e `npx tsc --noEmit`.
4. Emitir veredito formal explícito: APPROVE ou REQUEST_CHANGES.
5. Escrever relatório completo em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_totem_m3_2/handoff.md e notificar via send_message.

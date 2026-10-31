## 2026-10-27T03:30:28Z
Você é o Reviewer 1 (teamwork_preview_reviewer) para o Gate da Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_totem_m3_1/

Arquivos obrigatórios de leitura:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md (Itens 12 a 19)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_totem_m3_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/AGENTS.md (regras do dono: não mexer no FormTV, totem sem teclado virtual na tela, responder em pt-BR).

Sua missão de revisão:
1. Examinar com rigor o código modificado em:
   - desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
   - desktop/src/Kartodromo.Comum/Fmt.cs
   - desktop/src/Kartodromo.Comum/ValidacaoCliente.cs
2. Verificar se os Itens 12 (Instagram opcional / semInstagram), 13 (Telefone Internacional E.164), 14 (Peso 10-250 kg), 16 (Edição assistida de nome e documento), 17 (Tratamento 409 sem limpar tela) e 18 (Cursor em Mascarar via CalcularCursorMascara) foram implementados corretamente, sem regressões e com robustez.
3. Executar os testes automatizados: `npx vitest run tests/ops/` e `npx tsc --noEmit`.
4. Emitir veredito formal explícito: APPROVE ou REQUEST_CHANGES.
5. Escrever relatório completo em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_totem_m3_1/handoff.md e notificar via send_message.

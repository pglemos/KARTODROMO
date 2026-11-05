## 2026-10-27T03:12:28Z
Você é o Worker de Implementação (teamwork_preview_worker) para a Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_totem_m3_1/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Arquivos de especificação obrigatórios para leitura:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md (Itens 12 a 19)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_2/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_m3_3/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/AGENTS.md (regras do dono: não mexer no FormTV, totem sem teclado virtual na tela, responder em pt-BR).

Arquivos sob sua posse exclusiva de escrita:
- desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
- desktop/src/Kartodromo.Comum/Fmt.cs
- desktop/src/Kartodromo.Comum/ValidacaoCliente.cs
- services/ops-server.ts
- lib/ops/db.ts
- lib/ops/cadastro-obrigatorio.ts
- tests/ops/m3-totem-validacao.test.ts

Tarefas de Implementação Cirúrgica dos 8 Itens:
1. Item 12 (Instagram Opcional):
   - Em FormTotem.cs: remover obrigatoriedade artificial de Instagram em TelaCadastro e TelaCadastroMenor. Permitir campo vazio ou opção 'Não possuo Instagram' sem bloquear avanço. Validar apenas formato se preenchido via ValidacaoCliente.ErroInstagram.
   - Em ops-server.ts / db.ts: aceitar `semInstagram: true` ou campo ausente/vazio. Se `semInstagram: true`, em update parcial atualizar coluna Instagram para NULL no banco.
2. Item 13 (Telefone Internacional / Turistas):
   - Em Fmt.cs: MascaraFone não deve truncar ou quebrar números internacionais iniciando com '+' ou selecionados com Passaporte (suportar padrão E.164 até 15 dígitos).
   - Em ValidacaoCliente.cs / FormTotem.cs: aceitar números internacionais válidos.
   - Em ops-server.ts: flexibilizar validação de telefone para aceitar padrão internacional E.164 (7–15 dígitos) sem barrar turistas com passaporte.
3. Item 14 (Harmonização de Faixas de Peso):
   - Em FormTotem.cs: substituir validação inline de 20–250 kg por ValidacaoCliente.ErroPeso (aceitando 10 a 250 kg de forma harmonizada).
   - Em cadastro-obrigatorio.ts: garantir aceitação de 10 a 250 kg.
4. Item 15 (Preservação de Número e Complemento):
   - Garantir que nenhum update pelo totem no backend zere Numero ou Complemento.
5. Item 16 (Edição Assistida de Cadastro):
   - Em FormTotem.cs: permitir edição de nome e ajuste seguro de documento de cliente existente, enviando os dados atualizados para a API.
6. Item 17 (Tratamento Elegante de HTTP 409):
   - Em ops-server.ts: ao detectar documento duplicado em /api/totem/cadastro, responder HTTP 409 com `{ error: "documento_cadastrado", message, id: dup.id, token: sign('cli:' + dup.id) }`.
   - Em FormTotem.cs: capturar o 409 sem descartar os campos preenchidos na tela, orientar o usuário e focar o campo de documento com opção de resgatar o cadastro existente.
7. Item 18 (Correção do Cursor em Mascarar):
   - Em FormTotem.cs: substituir `t.SelectionStart = novo.Length` em Mascarar pela chamada a `Ui.Campos.CalcularCursorMascara` de Ui.cs para preservar a posição correta do cursor.
8. Item 19 (Parametrização SQL de Baterias):
   - Confirmar parametrização com `@bat_N` e `@grp_N` na rota de baterias.

Testes e Validação:
- Criar a suíte `tests/ops/m3-totem-validacao.test.ts` cobrindo todos os cenários da M3.
- Executar `npx vitest run tests/ops/` e `npx tsc --noEmit`.
- Redigir relatório completo em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_totem_m3_1/handoff.md` e notificar via send_message.

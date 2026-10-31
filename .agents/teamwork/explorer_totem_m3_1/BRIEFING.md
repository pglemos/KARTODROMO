# BRIEFING — 2026-10-27T03:09:00Z

## Mission
Exploração técnica detalhada da Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19) no Desktop WinForms C# do Totem e Kartodromo.Comum.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_1/
- Original parent: ede11c99-3091-44f8-9d3a-86b33770efcd
- Milestone: M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Respostas e documentação em pt-BR
- Sem teclado virtual na tela no Totem (regra de AGENTS.md)
- Não alterar código-fonte do projeto (desktop/...)
- Escrever apenas no diretório /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_1/

## Current Parent
- Conversation ID: ede11c99-3091-44f8-9d3a-86b33770efcd
- Updated: 2026-10-27T03:00:00Z

## Investigation State
- **Explored paths**:
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (TelaCadastro, TelaNovoMenor, Mascarar, layout)
  - `desktop/src/Kartodromo.Autoatendimento/Controles.cs` (Marcador, CampoTexto, Estilo)
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (ErroInstagram, ErroPeso, ErroEmail)
  - `desktop/src/Kartodromo.Comum/Ui.cs` (Campos.CalcularCursorMascara, Campos.Mascara)
  - `desktop/src/Kartodromo.Comum/Fmt.cs` (MascaraFone, Digitos, MascaraCpf)
  - `services/ops-server.ts` (POST /api/totem/cadastro, GET /api/totem/baterias, 409 handling)
  - `lib/ops/cadastro-obrigatorio.ts` e `lib/ops/instagram.ts`
- **Key findings**:
  - Item 12: FormTotem torna Instagram obrigatório nas linhas 473 e 741, embora ValidacaoCliente e backend aceitem opcional. Falta opção "Não possuo Instagram" no Totem.
  - Item 13: Fmt.MascaraFone trunca em 11 dígitos e força DDD brasileiro, destruindo telefones internacionais (+...). ValidacaoCliente precisa de ErroTelefone. FormTotem exige >=10 dígitos.
  - Item 14: FormTotem linha 539 valida `kg < 20`, divergindo de ValidacaoCliente (10–250 kg) e backend.
  - Item 16: Cliente existente tem `fDoc` e `fNome` desabilitados (linha 480) e dados["nome"]/["documento"] são descartados nas linhas 525-534.
  - Item 17: HTTP 409 é exibido em alerta genérico e botão Voltar reinicia todo o estado; falta focar no documento e permitir recuperação/manutenção dos campos.
  - Item 18: FormTotem linha 351 força `t.SelectionStart = novo.Length`, fazendo o cursor pular para o fim. Campos.CalcularCursorMascara já existe em Ui.cs e deve ser aproveitado.
- **Unexplored areas**: Nenhuma no escopo do Totem M3.

## Key Decisions Made
- Estruturar o relatório handoff.md detalhando linha por linha as modificações recomendadas para o Worker.

## Artifact Index
- DISPATCH.md — Registro da mensagem do orquestrador
- BRIEFING.md — Memória de trabalho
- progress.md — Liveness heartbeat
- handoff.md — Relatório de handoff para o Worker M3

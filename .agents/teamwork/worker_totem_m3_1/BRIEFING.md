# BRIEFING — 2026-10-27T03:28:30Z

## Mission
Implementação cirúrgica e de alta integridade da Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19) no backend (Node/TS) e desktop C# (.NET/WinForms), com suíte de testes completa e sem regressões.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_totem_m3_1
- Original parent: ede11c99-3091-44f8-9d3a-86b33770efcd
- Milestone: M3 (Itens 12 a 19)

## 🔒 Key Constraints
- Proibido cheat/mock/falso positivo ou bypass de lógica real.
- Responder sempre em pt-BR.
- Apps desktop são Windows nativos (`desktop/`), nunca app web/Chrome.
- Totem sem teclado na tela.
- Não mexer no telão (`FormTV` / `--tv`).
- Testes em produção só com dados "TESTE CODEX", desfeitos depois.
- Cronometragem no simulador :4150, nunca no :4050 real.
- Nunca colocar senha em arquivo versionado, commit ou log.
- Não clonar nem fazer proxy do MyLapTime/Sisecom.
- Arquivos sob posse exclusiva de escrita:
  * desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
  * desktop/src/Kartodromo.Comum/Fmt.cs
  * desktop/src/Kartodromo.Comum/ValidacaoCliente.cs
  * services/ops-server.ts
  * lib/ops/db.ts
  * lib/ops/cadastro-obrigatorio.ts
  * tests/ops/m3-totem-validacao.test.ts

## Current Parent
- Conversation ID: ede11c99-3091-44f8-9d3a-86b33770efcd
- Updated: 2026-10-27T03:28:30Z

## Task Summary
- **What to build**: Implementação dos itens 12 a 19 (Instagram opcional, Telefone internacional E.164, Harmonização de peso 10-250kg, Preservação de número e complemento no DB, Edição assistida de cadastro existente, Tratamento elegante de HTTP 409 em cadastro duplicado, Correção de cursor de máscara com Ui.Campos.CalcularCursorMascara, Parametrização SQL de baterias).
- **Success criteria**: Testes unitários/integração Vitest passando (391/391 testes em tests/ops/), tsc sem erros, lógica genuína em C# e TS, handoff.md 5 seções completo.
- **Interface contracts**: PROJECT_TOTEM.md, ORIGINAL_REQUEST.md
- **Code layout**: desktop/src/ e services/ / lib/ops/

## Key Decisions Made
- Item 12: Instagram opcional no desktop com checkbox 'Não possuo Instagram' e suporte a semInstagram: true no backend; em update parcial, limpa Instagram no banco para NULL.
- Item 13: MascaraFone em Fmt.cs não trunca telefones internacionais com prefixo '+'; ErroTelefone aceita padrão E.164 (7-15 dígitos) e nacional BR (10-13 dígitos).
- Item 14: ErroPeso harmonizado em 10 a 250 kg no desktop e servidor, removendo barreira de kg < 20 para adultos.
- Item 15: Update parcial preserva Numero e Complemento no banco sem sobrescrever com NULL.
- Item 16: Edição de nome habilitada e link para retificação de documento para clientes existentes.
- Item 17: Retorno 409 estruturado com `{ error: "documento_cadastrado", message, id, token }`; totem preserva dados na tela, foca documento e oferece resgate do cadastro existente.
- Item 18: Correção do salto do cursor em Mascarar utilizando `Campos.CalcularCursorMascara`.
- Item 19: Parametrização confirmada e testada com `@bat_N` e `@grp_N` na rota de baterias.

## Artifact Index
- DISPATCH.md — Diretrizes e despacho do orquestrador
- BRIEFING.md — Memória de trabalho persistente
- progress.md — Heartbeat de execução
- handoff.md — Relatório de handoff

## Change Tracker
- **Files modified**:
  * desktop/src/Kartodromo.Comum/Fmt.cs — MascaraFone suporta E.164 até 15 dígitos com '+'
  * desktop/src/Kartodromo.Comum/ValidacaoCliente.cs — ErroTelefone unificado para nacional e internacional
  * desktop/src/Kartodromo.Autoatendimento/FormTotem.cs — Itens 12, 13, 14, 16, 17, 18
  * lib/ops/cadastro-obrigatorio.ts — Suporte a semInstagram e faixa 10-250 kg
  * lib/ops/db.ts — Suporte a semInstagram em ClienteInput e clienteColumns (seta NULL)
  * services/ops-server.ts — Rota /api/totem/cadastro com semInstagram, erroTelefone e 409 estruturado
  * tests/ops/m3-totem-validacao.test.ts — Suíte de testes automatizados com 36 asserções cobrindo todos os itens
- **Build status**: PASS (vitest 391/391, tsc 0 erros, totem-congelado pass)
- **Pending issues**: nenhum

## Quality Status
- **Build/test result**: 391/391 testes passando em tests/ops/
- **Lint status**: 0 novos erros de design tokens; sem hardcode novo
- **Tests added/modified**: tests/ops/m3-totem-validacao.test.ts (+36 testes)

## Loaded Skills
- Nenhuma carregada explicitamente.

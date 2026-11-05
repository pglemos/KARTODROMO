# BRIEFING — 2026-10-27T03:09:40Z

## Mission
Desafio adversarial empírico da Milestone M3 (Cursor Jumping e Validações de Cadastro), testando `CalcularCursorMascara`, `ErroPeso`, `ErroInstagram` com oráculos, geradores e testes de estresse, emitindo veredito APPROVE ou REQUEST_CHANGES.

## 🔒 My Identity
- Archetype: Empirical Challenger
- Roles: critic, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m3_2
- Original parent: 5717774c-5184-48e4-9f3d-92886d69aed2
- Milestone: M3 (Cursor Jumping e Validações de Cadastro)
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only e adversarial verification: testar empiricamente com código executável.
- Responder sempre em pt-BR.
- Apps são programas Windows nativos C# / .NET em `desktop/`.
- Não colocar testes/código em `.agents/teamwork/`.
- Executar testes diretamente e atestar resultados.

## Current Parent
- Conversation ID: 5717774c-5184-48e4-9f3d-92886d69aed2
- Updated: 2026-10-27T03:09:40Z

## Review Scope
- **Files reviewed**:
  - `desktop/src/Kartodromo.Comum/Ui.cs` (`CalcularCursorMascara`, `Campos.Mascara`)
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (`ErroPeso`, `ErroInstagram`, `NormalizarInstagram`)
  - `desktop/src/Kartodromo.Comum/Fmt.cs` (`MascaraCpf`, `MascaraFone`, `MascaraCep`)
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (análise de mascaramento no totem)
  - `lib/ops/cadastro-obrigatorio.ts` (`erroPesoCliente`, `erroCadastroObrigatorio`)
  - `lib/ops/instagram.ts` (`normalizarInstagram`, `erroInstagramCliente`)
- **Interface contracts**: PROJECT.md, ORIGINAL_REQUEST.md
- **Review criteria**: Robustez de `CalcularCursorMascara` contra cursor jumping para 0; exatidão das bordas de peso (9, 10, 250, 251 kg); flexibilização de Instagram (opcionalidade, @, sem @, URLs, sanitização).

## Key Decisions Made
- Criada suíte adversarial dedicada em `tests/desktop-m3-adversarial-challenger.test.ts` com 35 testes automatizados (fuzzing, oráculos, simulações de digitação sequencial, início, meio e fim).
- Constatada a robustez total do algoritmo `CalcularCursorMascara`: em nenhuma circunstância de digitação o cursor é resetado para o índice 0 quando há dígitos presentes.
- Constatada paridade de 100% entre C# (`ValidacaoCliente.cs`) e TypeScript (`cadastro-obrigatorio.ts`, `instagram.ts`) para todas as 30 entradas adversariais de peso e instagram.
- Identificado apontamento/caveat sobre `FormTotem.cs:351` possuir implementação local legada de `Mascarar` (`t.SelectionStart = novo.Length`), recomendando unificação em milestone de Totem.
- Veredito emitido: **APPROVE**.

## Artifact Index
- `DISPATCH.md` — Despacho do orquestrador
- `BRIEFING.md` — Memória de trabalho
- `progress.md` — Heartbeat de execução
- `tests/desktop-m3-adversarial-challenger.test.ts` — Suíte de testes adversariais (35 testes)
- `handoff.md` — Relatório final de handoff do challenger com veredito APPROVE

## Attack Surface
- **Hypotheses tested**:
  - H1: Digitação de CPF, Fone ou CEP no início (índice 0) reseta o cursor para 0. -> REFUTADA (o cursor avança para após o caractere inserido).
  - H2: Digitação no meio onde máscara insere pontuação (. - ()) perde a posição ou joga o cursor para 0. -> REFUTADA (o cursor preserva a quantidade de caracteres alfanuméricos e ajusta o deslocamento).
  - H3: Backspace ou delete consecutivos corrompem o índice do cursor. -> REFUTADA (fuzzing com 300 operações aleatórias manteve 100% dos invariantes `0 <= SelectionStart <= text.length`).
  - H4: Valores limítrofes de peso 9, 9.999, 250.001, 251 aceitam valores fora de [10, 250]. -> REFUTADA (estritamente rejeitados tanto em C# quanto em TS).
  - H5: Valores de peso 10 e 250 exatos com vírgula ou ponto são rejeitados. -> REFUTADA (ambos aceitos com `null`).
  - H6: Instagram obrigatório ou rejeita perfis sem arroba / URLs. -> REFUTADA (vazio/espaços retornam null; perfis sem @ e URLs são aceitos e normalizados).
- **Vulnerabilities found**:
  - Nenhuma vulnerabilidade em `Ui.cs` ou `ValidacaoCliente.cs`.
  - Nota de observação: `FormTotem.cs:351` (`Kartodromo.Autoatendimento`) possui método local `Mascarar` que ainda seta `t.SelectionStart = novo.Length`.
- **Untested angles**:
  - Renderização real de janela WinForms em display físico (impossível em ambiente macOS sem dotnet).

## Loaded Skills
- specialist (critic): Adversarial challenge, empirical test generation, stress harnesses.

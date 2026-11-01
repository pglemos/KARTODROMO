# DISPATCH — Challenger M1_2 (Layout Dinâmico TM-T20 & Formatação)
Você é o Challenger 2 da Milestone M1 (R1: Impressão e Gestão de Termos - Itens 1 a 6).
Seu diretório de trabalho: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m1_2
Seu orquestrador: 42a5e4fc-3e76-480a-9095-8d141e42fba1

Entradas obrigatórias:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1/handoff.md

Escopo do Desafio:
- Verificar adversariamente a geração do HTML do termo em `lib/ops/termo.ts`.
- Validar se 297mm fixos foi 100% removido, se o CSS @page garante corte dinâmico sem páginas em branco na TM-T20.
- Executar testes de termo: `npx vitest run tests/ops/termo.test.ts`.
- Emitir veredito claro (APPROVE ou CHALLENGE_FAILED) com evidências empíricas em `handoff.md` e enviar mensagem ao orquestrador.


## 2026-10-26T21:59:00Z
Você é o Challenger 2 da Milestone M1 (R1: Impressão e Gestão de Termos - Itens 1 a 6).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m1_2.
Leia seu DISPATCH em: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m1_2/DISPATCH.md
Consulte:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1/handoff.md

Execute testes adversariais sobre o layout dinâmico de termo (TM-T20 80mm auto):
npx vitest run tests/ops/termo.test.ts
Verifique se a altura fixa de 297mm foi totalmente eliminada e se casos extremos de nomes/grupos não geram desperdício nem quebras de página.
Escreva seu relatório com veredito empírico (APPROVE ou CHALLENGE_FAILED) em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m1_2/handoff.md e envie uma mensagem ao orquestrador (parent).

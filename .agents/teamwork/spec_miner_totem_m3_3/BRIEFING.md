# BRIEFING — 2026-10-27T03:10:00Z

## Mission
Minerar e documentar a especificação completa, contratos de API, regras de validação e UX de Kiosk para a Milestone M3 (Itens 12 a 19: Validação de Dados e Cadastro no Totem).

## 🔒 My Identity
- Archetype: teamwork_preview_spec_miner
- Roles: Specification Miner
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_m3_3/
- Original parent: ede11c99-3091-44f8-9d3a-86b33770efcd
- Milestone: M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19)

## 🔒 Key Constraints
- Read-only: NÃO modificar arquivos de código-fonte
- Responder sempre em pt-BR
- Totem sem teclado na tela (teclado físico USB presente, foco contínuo)
- Apps são programas Windows nativos (desktop/), nunca app web/Chrome
- Testes em produção só com dados "TESTE CODEX", desfeitos depois
- Respeitar regras do dono em AGENTS.md

## Current Parent
- Conversation ID: ede11c99-3091-44f8-9d3a-86b33770efcd
- Updated: 2026-10-27T03:10:00Z

## Task Summary
- **What to build**: Especificação técnica detalhada para os Itens 12 a 19 (Milestone M3)
- **Success criteria**: Hand-off completo contendo tabela de features descobertas, edge cases, contratos de API (/api/totem/cadastro, /api/totem/identificar) para sucesso/409/parcial, regras de validação (peso, telefone BR/intl, instagram) e comportamento Kiosk UX.
- **Interface contracts**: PROJECT_TOTEM.md, ORIGINAL_REQUEST.md, schemas e rotas existentes do backend/totem
- **Code layout**: desktop/ (Windows Forms C#), backend/ (Node.js/TypeScript Express/Fastify/etc.)

## Key Decisions Made
- Validação de peso unificada em [10, 250] kg tanto para adultos quanto menores no desktop e backend.
- Instagram opcional com normalização rigorosa se preenchido e aceitação de vazio/semInstagram.
- Telefone flexibilizado para DDI/passaporte (mínimo de 7 dígitos para internacional; sem máscara brasileira truncada).
- Preservação estrita de colunas Numero e Complemento no update de endereço.
- Edição assistida de nome/documento e tratamento elegante de HTTP 409 preservando dados digitados.
- Cursor em Mascarar corrigido utilizando `Ui.CalcularCursorMascara`.
- Parametrização SQL completa de baterias com `@bat_i` e `@grp_i`.

## Artifact Index
- DISPATCH.md — Registro do despacho
- BRIEFING.md — Memória de trabalho
- progress.md — Liveness heartbeat
- handoff.md — Relatório de especificação minerada

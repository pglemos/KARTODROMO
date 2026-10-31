# BRIEFING — 2026-10-26T22:25:00Z

## Mission
Implementação com rigor dos Itens 7 a 11 da Milestone M2 (Segurança, Privacidade, LGPD, Mascaramento PII, Tokens de Sessão HMAC, Bloqueio Teclas Kiosk e Consentimento Art. 14).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2
- Original parent: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Milestone: M2 (R2: Segurança, Privacidade e LGPD - Itens 7 a 11)

## 🔒 Key Constraints
- Responder sempre em pt-BR.
- Aplicativos operacionais são programas Windows nativos em desktop/ (C# WinForms .NET 8).
- Totem sem teclado virtual na tela por padrão; foco para teclado USB físico.
- Não mexer no telão (FormTV / --tv).
- Não quebrar regras operacionais do kartódromo.
- Proteger PII rigorosamente na tela pública (CPF, e-mail, telefone, endereço, nascimento, dependentes).
- Eliminar acoplamento frágil com IP de socket (identificadoNoTotem, 192.168.20.161/.69), gerando token seguro de sessão assinado HMAC.
- Low-Level Keyboard Hook (WH_KEYBOARD_LL = 13) para bloquear WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4, Alt+Espaço, Tecla Apps; preservar digitação normal, ABNT2/AltGr e Ctrl+Shift+Alt+S da equipe.
- Consentimento explícito de menores (LGPD Art. 14) com migration 0012, validação de idade (6 a 17 anos para menor com responsável, >= 18 para titular) e checkbox no FormTotem.cs.
- Validação estrita: npx vitest run, npx tsc --noEmit, e testes automatizados em tests/ops/totem-seguranca.test.ts.
- Integridade total: sem mocks fajutos, dados reais/lógica genuína.

## Current Parent
- Conversation ID: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Updated: 2026-10-26T22:25:00Z

## Task Summary
- **What to build**: Implementação dos itens 7 a 11: Mascaramento PII e dados de menor em ops-server.ts; Token de sessão HMAC e cabeçalhos X-Totem-Session / X-Totem-Id em ops-server.ts e Api.cs; Bloqueio de teclas Kiosk em BloqueioTeclasKiosk.cs e Program.cs/FormTotem.cs; Migration 0012_lgpd_menor.sql e validação Art. 14 no backend e FormTotem.cs; Testes em tests/ops/totem-seguranca.test.ts.
- **Success criteria**: Vitest 100% passando, tsc --noEmit sem erros, C# WinForms compilando/estruturado perfeitamente conforme regras do projeto.
- **Interface contracts**: PROJECT_TOTEM.md § Interface Contracts
- **Code layout**: PROJECT_TOTEM.md § Code Layout

## Key Decisions Made
- [Início dos trabalhos]

## Artifact Index
- DISPATCH.md — Assignment instructions
- progress.md — Liveness heartbeat and step tracking
- handoff.md — Final handoff report

## Change Tracker
- **Files modified**: none
- **Build status**: pending
- **Pending issues**: none

## Quality Status
- **Build/test result**: pending
- **Lint status**: pending
- **Tests added/modified**: pending

## Loaded Skills
- none

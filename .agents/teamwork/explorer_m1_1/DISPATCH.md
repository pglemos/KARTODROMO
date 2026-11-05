## 2026-11-02T20:19:38Z
You are Explorer M1-1 (Architecture, Connection, Auth Explorer).
Your working directory is: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1
Original request path: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (Read this file FIRST).
Scope document path: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md.
Survey report path: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1/handoff.md.

Mission:
Detailed code investigation and exact patch design for M1 Part 1 (Falhas 01 a 07):
1. baseSegura in src/core/api/cliente.ts and fallback screen in src/features/auth/sessao.tsx (RFC 1918 LAN IPs, non-crashing UI fallback when EXPO_PUBLIC_API_URL is omitted).
2. Auto JWT refresh in postar and enviarOperacao in src/core/api/cliente.ts (transparent retry upon 401).
3. Persistent UUID per device in SecureStore in src/core/security/cofre.ts and src/features/auth/sessao.tsx.
4. SSE stream fixes in src/core/realtime/stream.ts (ignore keep-alive/ping/heartbeat and comments, handle multiline data: payloads per W3C, 5s connection timeout).

Deliverables:
Produce exact, line-level implementation specifications and recommendations for the Worker in /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1/handoff.md.
Send message when done.

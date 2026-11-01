# DISPATCH — Explorer M2_1 (Backend PII, Tokens e Sessão Segura - Itens 7, 8 e 9)
Você é o Explorer 1 da Milestone M2 (R2: Segurança, Privacidade e LGPD).
Seu diretório de trabalho: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1
Seu orquestrador: 42a5e4fc-3e76-480a-9095-8d141e42fba1

Entradas obrigatórias:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/services/ops-server.ts

Missão de Exploração:
1. Inspecionar `services/ops-server.ts` nas rotas `/api/totem/identificar`, `/api/totem/cadastro`, `/api/totem/inscrever`.
2. Identificar exatamente como os dados de clientes e dependentes (especialmente menores) são retornados hoje na identificação (PII exposta sem máscara).
3. Analisar onde existe amarração por IP de socket (`req.socket.remoteAddress`, `identificadoNoTotem`, IPs hardcoded como 192.168.20.161/.69).
4. Desenhar uma estratégia detalhada para:
   - Mascarar CPF (ex: `***.456.789-**`), e-mail (ex: `p***o@g***.com`), telefone (ex: `(31) 9****-1234`) e endereço em `/api/totem/identificar`.
   - Gerar e validar token de sessão de totem (`X-Totem-Session`, token assinado ou UUID com tempo de expiração) eliminando o acoplamento frágil com IP de socket.
   - Proteger dados de menores retornados na identificação.
5. Elaborar recomendações concretas de implementação, com linhas de código afetadas e plano de testes.
Escreva seu relatório em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md` e envie mensagem ao orquestrador.

## 2026-10-26T22:10:37Z
Você é o Explorer 1 da Milestone M2 (R2: Segurança, Privacidade e LGPD - Itens 7, 8 e 9).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1.
Leia seu DISPATCH em: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/DISPATCH.md
Consulte:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/services/ops-server.ts

Investigue detalhadamente o mascaramento de PII em /api/totem/identificar, a eliminação de acoplamento com IP de socket (identificadoNoTotem / 192.168.20.161) e a introdução de token seguro de sessão/totem.
Escreva seu relatório técnico em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md e envie mensagem ao orquestrador (parent).

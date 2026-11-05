# DISPATCH — Explorer M2_3 (Consentimento de Menores LGPD e Contratos de Dados - Itens 8 e 11)
Você é o Explorer 3 da Milestone M2 (R2: Segurança, Privacidade e LGPD).
Seu diretório de trabalho: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3
Seu orquestrador: 42a5e4fc-3e76-480a-9095-8d141e42fba1

Entradas obrigatórias:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
- /Users/pedroguilherme/PROJETOS/KARTODROMO/services/ops-server.ts

Missão de Exploração:
1. Analisar o fluxo atual de cadastro e inclusão de participantes menores de 18 anos no Totem e no Backend Ops.
2. Inspecionar o cumprimento do Artigo 14 da LGPD (Lei nº 13.709/2018): consentimento específico e em destaque dado por pelo menos um dos pais ou pelo responsável legal.
3. Projetar:
   - Apresentação do termo de consentimento de menores no Totem Desktop WinForms (`FormTotem.cs`): texto em destaque, checkbox explícito de aceite, registro de quem é o responsável autorizador (`dependenteDe` / `responsavelId`).
   - Contrato de payload no endpoint `/api/totem/cadastro`: campo `consentimentoMenor: boolean`, `responsavelCpf?: string`.
   - Persistência e auditoria no banco de dados (`dbo.Cliente`, `dbo.TermoAceite` ou campos equivalentes `LgpdMenorAceitoEm`, `LgpdMenorResponsavelId`).
   - Bloqueio estrito no backend caso tentativa de cadastrar menor sem o aceite do responsável legal.
4. Elaborar recomendações concretas de código, contratos de interface e plano de testes.
Escreva seu relatório em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3/handoff.md` e envie mensagem ao orquestrador.

## 2026-10-26T22:10:38Z
Você é o Explorer 3 da Milestone M2 (R2: Segurança, Privacidade e LGPD - Itens 8 e 11).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3.
Leia seu DISPATCH em: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3/DISPATCH.md
Consulte:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
- /Users/pedroguilherme/PROJETOS/KARTODROMO/services/ops-server.ts

Investigue o fluxo de consentimento explícito para tratamento de dados de menores de idade (LGPD Art. 14) tanto no formulário WinForms quanto nos contratos de API e banco de dados.
Escreva seu relatório técnico em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3/handoff.md e envie mensagem ao orquestrador (parent).

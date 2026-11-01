## 2026-10-26T22:23:09Z
Você é challenger_m2_2.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m2_2

Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_gen2/handoff.md

Missão:
Desafio adversarial e teste de estresse da Milestone M2 (PII, Injeção SQL e Formato de Termos).
1. Testar empiricamente:
   - Injeção SQL: tentar passar payloads maliciosos, strings vazias, números negativos ou caracteres especiais nos filtros de baterias do totem e checar parametrização.
   - PII: tentar extrair CPF completo, e-mail completo, dados de dependentes menores via `POST /api/totem/identificar` e verificar se o mascaramento é estrito e consistente.
   - Bobina térmica: verificar se o HTML gerado em `/termo` e `lib/ops/termo.ts` não possui mais 297mm fixos e obedece `80mm auto` sem causar quebras indesejadas.
   - Validação de peso e Instagram: testar limites 9kg, 10kg, 250kg, 251kg, Instagram vazio vs preenchido.
2. Escrever e rodar testes adversariais independentes.
3. Emitir veredito explícito no seu handoff.md: APPROVE ou REQUEST_CHANGES.
4. Notificar o orquestrador via send_message com seu veredito.

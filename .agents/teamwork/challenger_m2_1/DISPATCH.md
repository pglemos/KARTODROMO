## 2026-10-26T22:23:08Z
Você é challenger_m2_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m2_1

Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_gen2/handoff.md

Missão:
Desafio adversarial e teste de estresse da Milestone M2 (Fila de Impressão e Concorrência).
1. Testar empiricamente cenários de borda e estresse:
   - Fila de impressão: múltiplos consumidores concorrentes na CTE atômica UPDLOCK + READPAST, reentrega após 90s, status 'falhou', contingência após 3h sem expurgo.
   - Baterias vencidas: tentativa de reserva no exato segundo inicial e com segundos a menos, garantir que é bloqueada.
   - Estorno parcial de venda com múltiplos vouchers: garantir que apenas o voucher do item estornado é marcado como estornado.
2. Escrever e rodar testes adversariais independentes ou scripts de validação para comprovar a robustez.
3. Emitir veredito explícito no seu handoff.md: APPROVE ou REQUEST_CHANGES.
4. Notificar o orquestrador via send_message com seu veredito.

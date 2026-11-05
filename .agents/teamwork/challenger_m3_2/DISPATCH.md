## 2026-10-27T03:02:02Z
Você é challenger_m3_2.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m3_2

Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m3_1/handoff.md

Missão:
Desafio adversarial da Milestone M3 (Cursor Jumping e Validações de Cadastro).
1. Testar empiricamente:
   - Algoritmo de cursor jumping (`CalcularCursorMascara`): simular digitação no início, meio e fim de CPFs, telefones com DDD e CEPs, garantindo que o cursor nunca é jogado para o índice 0.
   - Validação de peso em `ValidacaoCliente.ErroPeso`: testar bordas 9, 10, 250, 251 kg e formatos não numéricos.
   - Flexibilização de Instagram em `ValidacaoCliente.ErroInstagram`: testar vazio, espaços, nulo, @valido, sem arroba, URLs.
2. Escrever e rodar testes adversariais empíricos.
3. Emitir veredito explícito no seu handoff.md: APPROVE ou REQUEST_CHANGES.
4. Notificar o orquestrador via send_message com seu veredito.

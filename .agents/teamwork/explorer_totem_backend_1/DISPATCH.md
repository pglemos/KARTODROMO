# DISPATCH — Explorer Totem Backend 1

## Tarefa
Realizar levantamento detalhado de código, pontos de injeção, falhas e impactos no backend Node.js/TypeScript e banco de dados SQL Server para os 39 itens do totem de autoatendimento.

## Arquivos e Módulos Centrais
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md` (seção de 2026-10-26T19:04:37Z)
- `services/ops-server.ts`
- Módulos em `lib/ops/` (ex.: `cadastro-obrigatorio.ts`, fila de impressão, rotas do totem, baterias, clientes)
- Estruturas de banco de dados SQL (`dbo.Cliente`, `dbo.FilaImpressao`, `dbo.Bateria`, etc.)
- Testes unitários existentes (`npx vitest` / `tests/`)

## Foco de Análise
1. Fila de impressão volátil (`filaImpressao: Impressao[]` em memória) e proposta de persistência em tabela de banco sem perda em restarts do `:4060`.
2. Mascaramento PII na rota `POST /api/totem/identificar` e proteção de dados sensíveis e dependentes.
3. Substituição da amarração por IP de socket (`identificadoNoTotem` / IPs hardcoded) por tokens de sessão assinados ou IDs configuráveis.
4. Harmonização de peso entre servidor e desktop, preservação de `Numero` e `Complemento` em updates de endereço, suporte a documentos internacionais/duplicados.
5. Parametrização SQL e race condition da última vaga na rota de baterias.
6. Pool de conexões e cancelamento de requisições sobrepostas no ViaCep.

## Saída Esperada
Escreva seu relatório em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_backend_1/handoff.md`.
Atualize periodicamente seu `progress.md`.
Ao concluir, envie mensagem para o orquestrador (parent).

## 2026-10-26T19:09:19Z
Você é o Explorer Especialista em Backend & Banco de Dados para o sistema de autoatendimento (totem) do Kartódromo de Betim.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_backend_1
Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).

Consulte também os seguintes arquivos:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_backend_1/DISPATCH.md
- services/ops-server.ts
- Módulos em lib/ops/ (cadastro-obrigatorio.ts, rotas de totem, baterias, fila de impressão, clientes)
- Tabelas e queries SQL (dbo.FilaImpressao, dbo.Cliente, dbo.Bateria, etc.)
- Testes em tests/

Sua missão:
1. Analisar detalhadamente no código existente a implementação atual e as causas-raiz dos problemas no backend:
   - Desacoplamento da fila de impressão da RAM (filaImpressao: Impressao[]) e estratégia de persistência em dbo.FilaImpressao com status de contingência sem expiração silenciosa em 3h.
   - Mascaramento PII na rota POST /api/totem/identificar (proteger e-mail, telefone, CPF, endereço, dependentes).
   - Eliminação da identificação frágil por socket IP e IPs hardcoded (192.168.20.161/.69), substituindo por token assinado ou ID configurável de totem.
   - Harmonização de faixa de peso com FormTotem.cs, preservação de colunas Numero e Complemento em dbo.Cliente, tratamento de 409 e documentos internacionais.
   - Parametrização SQL e proteção contra race condition na reserva da última vaga em baterias.
   - Pool de conexões HTTP e cancelamento de requisições sobrepostas no ViaCep.
2. Identificar exatamente quais arquivos, funções e linhas de código precisarão ser modificadas.
3. Propor a estratégia técnica recomendada para cada item (sem implementar o código diretamente).

Gere seu relatório de análise técnica completo em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_backend_1/handoff.md

Ao concluir, envie uma mensagem para o orquestrador (parent) com a síntese dos achados.

## 2026-10-26T19:21:34Z
**Context**: Survey dos 39 itens do totem de autoatendimento (Backend & DB)
**Content**: Os relatórios do spec miner e do desktop explorer já foram concluídos e entregues com alto detalhamento. Como está o andamento da sua investigação técnica em ops-server.ts, lib/ops e no banco de dados?
**Action**: Favor concluir a redação do seu handoff.md estruturado e reportar a conclusão para consolidarmos o PROJECT_TOTEM.md.

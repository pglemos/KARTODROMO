## 2026-10-26T19:07:54Z
Você é explorer_backend_survey_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_backend_survey_1
Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- AGENTS.md
- docs/operacao/HANDOFF-SISTEMA-PROPRIO.md

Missão:
Investigar o backend e o banco de dados operacional em:
- services/ops-server.ts
- lib/ops/ (office.ts, db.ts, auth.ts, relatorios.ts, termo.ts, etc.)
- migrations/ops/ (migrações 0001..0004 e esquema atual de tabelas)
- Integrações com cronometragem (/api/crono/*, timing-server, chave x-ops-key)

Analise tecnicamente o backend para os requisitos da Recepção e infra compartilhada:
- R1: Fila de impressão em memória (`filaImpressao: Impressao[]` em ops-server.ts). Como desacoplar e persistir no SQL Server (dbo.FilaImpressao), rotinas de contingência, expiração sem perda de termos, geração do termo em altura dinâmica sem desperdício de 297mm de bobina.
- R2: Caixa, PDV e financeiro em lib/ops/office.ts: regras de abertura, fechamento, transações, vendas, estornos, concorrência e integridade transacional no SQL.
- R3: Baterias e reservas: consultas SQL em office.ts e ops-server.ts, bloqueio de baterias com horário de início expirado, validação de vagas, parametrização contra SQL injection.
- R4: Clientes e cadastros: proteção de dados pessoais (PII), busca de clientes, validação de unicidade de CPF/documento, preservação de colunas Numero e Complemento em atualizações.
- R5: Integração com cronometragem e rede: autenticação, performance das consultas de baterias/grid, integridade referencial.
- R6: Estabilidade do servidor: rotas /healthz, pool de conexões mssql, tratamento de exceções sem derrubar o processo Node.js.

Atenção: NÃO modifique código nesta fase. Apenas investigue e aponte trechos específicos com nomes de arquivos, métodos, queries SQL e números de linhas.

Salve seu relatório detalhado em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_backend_survey_1/handoff.md

Ao concluir, envie mensagem via send_message ao orquestrador (5c17e886-4fbe-41e6-80a1-62db6f4ee87a) com o resumo dos achados.

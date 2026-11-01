## 2026-10-26T19:24:26Z
Você é worker_m1_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1_1
Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_1/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_backend_survey_1/handoff.md

Posse exclusiva de escrita (Write ownership):
- `migrations/ops/0011_fila_impressao_indices.sql`
- `tests/ops/migration-0011.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Missão:
Implementar a Milestone M1 (Banco de Dados & Migração 0011):
1. Criar o arquivo `migrations/ops/0011_fila_impressao_indices.sql` com:
   - Tabela `dbo.FilaImpressao` com colunas:
     `Id INT IDENTITY(1,1) PRIMARY KEY`,
     `Url NVARCHAR(500) NOT NULL`,
     `Titulo NVARCHAR(200) NOT NULL`,
     `Origem NVARCHAR(100) NOT NULL`,
     `Status NVARCHAR(20) NOT NULL DEFAULT 'pendente'`,
     `Tentativas INT NOT NULL DEFAULT 0`,
     `CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()`,
     `PegoEm DATETIME2 NULL`,
     `FeitaEm DATETIME2 NULL`,
     `FalhouEm DATETIME2 NULL`,
     `UltimoErro NVARCHAR(MAX) NULL`.
   - Índices para performance: `IX_FilaImpressao_Status_CriadoEm` em `(Status, CriadoEm)` e `IX_FilaImpressao_Status_PegoEm` em `(Status, PegoEm)`.
   - Índice único filtrado `UX_Movimento_TerminalAberto` em `dbo.Movimento (TerminalId) WHERE FechadoEm IS NULL`.
   - Índice ou coluna computada persistida em `dbo.Manutencao` para acelerar buscas por número do Kart sem forçar full table scan.
2. Criar teste automatizado vitest em `tests/ops/migration-0011.test.ts` validando a sintaxe T-SQL, a estrutura da tabela, a compatibilidade com SQL Server e o contrato de interface.
3. Executar o teste com `npx vitest run tests/ops/migration-0011.test.ts` e comprovar 100% de sucesso.
4. Salvar o relatório completo de handoff em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1_1/handoff.md

Ao concluir, envie mensagem via send_message ao orquestrador (5c17e886-4fbe-41e6-80a1-62db6f4ee87a).

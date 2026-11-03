-- Migration 0011: Fila de Impressão Persistida e Índices de Performance / Integridade
--
-- 1. Cria a tabela dbo.FilaImpressao para desacoplar a fila da memória volátil do Node.js
-- 2. Cria índices de performance na fila de impressão (Status, CriadoEm) e (Status, PegoEm)
-- 3. Cria índice único filtrado em dbo.Movimento (TerminalId) WHERE FechadoEm IS NULL para evitar caixas concorrentes abertos no mesmo terminal
-- 4. Adiciona coluna computada persistida KartNumero e índices em dbo.Manutencao para busca de Karts sem full table scan

-- 1. Tabela dbo.FilaImpressao
IF OBJECT_ID('dbo.FilaImpressao', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.FilaImpressao (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Url NVARCHAR(500) NOT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Origem NVARCHAR(100) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_FilaImpressao_Status DEFAULT 'pendente',
    Tentativas INT NOT NULL CONSTRAINT DF_FilaImpressao_Tentativas DEFAULT 0,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_FilaImpressao_CriadoEm DEFAULT SYSDATETIME(),
    PegoEm DATETIME2 NULL,
    FeitaEm DATETIME2 NULL,
    FalhouEm DATETIME2 NULL,
    UltimoErro NVARCHAR(MAX) NULL,
    CONSTRAINT CK_FilaImpressao_Status CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'falhou'))
  );
END;
GO

-- 2. Índices para performance na fila de impressão
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FilaImpressao_Status_CriadoEm' AND object_id = OBJECT_ID('dbo.FilaImpressao'))
BEGIN
  CREATE INDEX IX_FilaImpressao_Status_CriadoEm ON dbo.FilaImpressao (Status, CriadoEm);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FilaImpressao_Status_PegoEm' AND object_id = OBJECT_ID('dbo.FilaImpressao'))
BEGIN
  CREATE INDEX IX_FilaImpressao_Status_PegoEm ON dbo.FilaImpressao (Status, PegoEm);
END;
GO

-- 3. Índice único filtrado em dbo.Movimento para isolamento de terminal aberto
-- Fechar movimentos abertos duplicados legados se existirem, mantendo apenas o mais recente
IF OBJECT_ID('dbo.Movimento', 'U') IS NOT NULL
BEGIN
  ;WITH AbertosDuplicados AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY TerminalId ORDER BY AbertoEm DESC, Id DESC) AS rn
    FROM dbo.Movimento
    WHERE FechadoEm IS NULL
  )
  UPDATE dbo.Movimento
  SET FechadoEm = AbertoEm
  WHERE Id IN (SELECT Id FROM AbertosDuplicados WHERE rn > 1);
END;
GO

IF OBJECT_ID('dbo.Movimento', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Movimento_TerminalAberto' AND object_id = OBJECT_ID('dbo.Movimento'))
BEGIN
  CREATE UNIQUE INDEX UX_Movimento_TerminalAberto ON dbo.Movimento (TerminalId) WHERE FechadoEm IS NULL;
END;
GO

-- 4. Otimização em dbo.Manutencao para acelerar busca por Kart sem full table scan
IF OBJECT_ID('dbo.Manutencao', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Manutencao', 'KartNumero') IS NULL
  BEGIN
    ALTER TABLE dbo.Manutencao ADD KartNumero AS TRY_CAST(LTRIM(RTRIM(Kart)) AS INT) PERSISTED;
  END;
END;
GO

IF OBJECT_ID('dbo.Manutencao', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Manutencao_KartNumero' AND object_id = OBJECT_ID('dbo.Manutencao'))
BEGIN
  CREATE INDEX IX_Manutencao_KartNumero ON dbo.Manutencao (KartNumero)
    INCLUDE (Categoria, ItemId, MinutosUso, UltimaManutencao, Realizada, Data);
END;
GO

IF OBJECT_ID('dbo.Manutencao', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Manutencao_Kart' AND object_id = OBJECT_ID('dbo.Manutencao'))
BEGIN
  CREATE INDEX IX_Manutencao_Kart ON dbo.Manutencao (Kart);
END;
GO

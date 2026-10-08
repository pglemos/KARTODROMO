-- 0010_crono_uso_karts.sql
-- Controle idempotente e transacional de horas de uso de karts enviadas pela cronometragem
-- Impede duplicação de minutos quando a cronometragem reenvia a mesma sessão (timeout/retry).

IF OBJECT_ID('dbo.CronoUsoKarts') IS NULL
CREATE TABLE dbo.CronoUsoKarts (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  SessaoId VARCHAR(60) NOT NULL,
  AgendaId INT NULL,
  Categoria VARCHAR(50) NOT NULL,
  Kart VARCHAR(20) NOT NULL,
  Minutos INT NOT NULL,
  PayloadHash VARCHAR(64) NOT NULL,
  CriadoEm DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT UQ_CronoUsoKarts_Sessao_Kart_Cat UNIQUE (SessaoId, Kart, Categoria)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CronoUsoKarts_SessaoId')
  CREATE INDEX IX_CronoUsoKarts_SessaoId ON dbo.CronoUsoKarts (SessaoId);
GO

-- Roteiro de Rollback (se necessário reverter sem apagar os minutos acumulados em Manutencao):
-- DROP TABLE dbo.CronoUsoKarts;

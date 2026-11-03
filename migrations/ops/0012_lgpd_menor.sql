-- Migration 0012: Consentimento Explícito de Menores (LGPD Art. 14) e Trilha de Auditoria
--
-- 1. Adiciona colunas de auditoria LGPD de dependentes menores em dbo.Cliente
-- 2. Cria tabela dbo.TermoAceite para histórico e prestação de contas de termos de aceite

-- 1. Colunas de auditoria em dbo.Cliente
IF OBJECT_ID('dbo.Cliente', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Cliente', 'LgpdMenorAceitoEm') IS NULL
  BEGIN
    ALTER TABLE dbo.Cliente ADD LgpdMenorAceitoEm DATETIME2 NULL;
  END;

  IF COL_LENGTH('dbo.Cliente', 'LgpdMenorResponsavelId') IS NULL
  BEGIN
    ALTER TABLE dbo.Cliente ADD LgpdMenorResponsavelId INT NULL CONSTRAINT FK_Cliente_LgpdMenorResponsavel REFERENCES dbo.Cliente(Id);
  END;

  IF COL_LENGTH('dbo.Cliente', 'LgpdMenorTermoVersao') IS NULL
  BEGIN
    ALTER TABLE dbo.Cliente ADD LgpdMenorTermoVersao VARCHAR(20) NULL;
  END;
END;
GO

-- 2. Tabela dbo.TermoAceite para trilha de auditoria e conformidade com LGPD
IF OBJECT_ID('dbo.TermoAceite', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TermoAceite (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ClienteId INT NOT NULL CONSTRAINT FK_TermoAceite_Cliente REFERENCES dbo.Cliente(Id),
    TipoTermo VARCHAR(30) NOT NULL, -- 'LGPD_TITULAR' | 'LGPD_MENOR_ART14' | 'RESPONSABILIDADE_PISTA'
    ResponsavelId INT NULL CONSTRAINT FK_TermoAceite_Responsavel REFERENCES dbo.Cliente(Id),
    VersaoTermo VARCHAR(20) NOT NULL CONSTRAINT DF_TermoAceite_Versao DEFAULT '2026.1',
    IpOrigem VARCHAR(45) NULL,
    TotemOrigem VARCHAR(30) NULL,
    AceitoEm DATETIME2 NOT NULL CONSTRAINT DF_TermoAceite_AceitoEm DEFAULT SYSDATETIME(),
    DispositivoInfo NVARCHAR(200) NULL
  );
END;
GO

IF OBJECT_ID('dbo.TermoAceite', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TermoAceite_Cliente' AND object_id = OBJECT_ID('dbo.TermoAceite'))
BEGIN
  CREATE INDEX IX_TermoAceite_Cliente ON dbo.TermoAceite (ClienteId);
END;
GO

IF OBJECT_ID('dbo.TermoAceite', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TermoAceite_Responsavel' AND object_id = OBJECT_ID('dbo.TermoAceite'))
BEGIN
  CREATE INDEX IX_TermoAceite_Responsavel ON dbo.TermoAceite (ResponsavelId);
END;
GO

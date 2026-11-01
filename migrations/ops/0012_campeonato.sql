-- Campeonatos (painel web): a classificação é calculada a partir dos resultados oficiais da cronometragem (ORBITS).
-- Aqui fica só a regra de pontos e quais eventos/baterias da cronometragem formam cada etapa.

IF OBJECT_ID('dbo.Campeonato') IS NULL
CREATE TABLE dbo.Campeonato (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  Nome           NVARCHAR(120) NOT NULL,
  Temporada      NVARCHAR(60)  NULL,
  Regra          VARCHAR(12)   NOT NULL DEFAULT 'categoria',      -- categoria | geral (posição usada para pontuar)
  Pontos         VARCHAR(400)  NOT NULL DEFAULT '50,45,42,40,38', -- depois do último, -1 por posição até 1 ponto
  BonusPole      INT           NOT NULL DEFAULT 1,
  BonusMelhorVolta INT         NOT NULL DEFAULT 1,
  PenalidadePontos INT         NOT NULL DEFAULT 10,               -- preta e branca (PEN na crono): pontos a menos
  Descartes      INT           NOT NULL DEFAULT 2,
  Ativo          BIT           NOT NULL DEFAULT 1,
  CriadoEm       DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.CampeonatoEtapa') IS NULL
CREATE TABLE dbo.CampeonatoEtapa (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  CampeonatoId   INT           NOT NULL REFERENCES dbo.Campeonato(Id),
  Ordem          INT           NOT NULL,
  Nome           NVARCHAR(120) NOT NULL,
  Data           DATE          NULL,
  SessoesCorrida VARCHAR(800)  NULL,   -- ids das sessões de corrida da cronometragem, separados por vírgula
  SessoesPole    VARCHAR(800)  NULL,   -- ids das tomadas de tempo (pole), na mesma ordem das corridas
  Publicada      BIT           NOT NULL DEFAULT 0,
  CriadoEm       DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CampeonatoEtapa_Campeonato')
  CREATE INDEX IX_CampeonatoEtapa_Campeonato ON dbo.CampeonatoEtapa(CampeonatoId);
GO

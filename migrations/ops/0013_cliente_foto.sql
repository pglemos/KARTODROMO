-- Foto do piloto (página Pilotos do painel web). A foto (até 512 px) e a miniatura (96 px) chegam já reduzidas
-- pelo navegador, em JPEG; ficam fora da dbo.Cliente para não pesar nas buscas da Recepção e do totem.
IF OBJECT_ID('dbo.ClienteFoto') IS NULL
CREATE TABLE dbo.ClienteFoto (
  ClienteId     INT            NOT NULL PRIMARY KEY REFERENCES dbo.Cliente(Id),
  Foto          VARBINARY(MAX) NOT NULL,
  Miniatura     VARBINARY(MAX) NOT NULL,
  Tipo          VARCHAR(30)    NOT NULL DEFAULT 'image/jpeg',
  AtualizadoPor INT            NULL,
  AtualizadoEm  DATETIME2      NOT NULL DEFAULT SYSDATETIME()
);
GO

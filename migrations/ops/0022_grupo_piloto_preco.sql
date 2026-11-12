-- Preço próprio da vaga no grupo (12/11/2026): quem paga pelo link do grupo e é estreante paga o preço de primeira vez
-- da bateria (ex.: Happy Hour R$ 89,90 em vez de R$ 99,90). NULL = preço do grupo.
IF COL_LENGTH('dbo.ReservaGrupoPiloto', 'PrecoCentavos') IS NULL
  ALTER TABLE dbo.ReservaGrupoPiloto ADD PrecoCentavos INT NULL;
GO

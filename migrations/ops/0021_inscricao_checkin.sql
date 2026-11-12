-- Check-in pelo celular (reservas.kartodromodebetim.com.br, Minhas reservas): o piloto confirma que chegou (GPS a até 1 km,
-- de 2 h antes até 15 min depois da largada, reserva paga). A recepção vê "chegou" e o termo dele já entra na fila de impressão.
IF COL_LENGTH('dbo.Inscricao', 'CheckinEm') IS NULL ALTER TABLE dbo.Inscricao ADD CheckinEm DATETIME2(0) NULL;
IF COL_LENGTH('dbo.Inscricao', 'CheckinOrigem') IS NULL ALTER TABLE dbo.Inscricao ADD CheckinOrigem VARCHAR(12) NULL;
GO

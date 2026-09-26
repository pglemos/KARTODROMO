-- Campos do Registro de cliente aprovado no design (Tipo sanguíneo, IBGE da cidade, País). Idempotente.
IF COL_LENGTH('dbo.Cliente', 'TipoSanguineo') IS NULL ALTER TABLE dbo.Cliente ADD TipoSanguineo nvarchar(3) NULL;
IF COL_LENGTH('dbo.Cliente', 'Ibge') IS NULL ALTER TABLE dbo.Cliente ADD Ibge nvarchar(10) NULL;
IF COL_LENGTH('dbo.Cliente', 'Pais') IS NULL ALTER TABLE dbo.Cliente ADD Pais nvarchar(60) NULL;

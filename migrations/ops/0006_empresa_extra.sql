-- Registro de empresa do design: IBGE, país, site, horário de funcionamento e logomarca.
IF COL_LENGTH('dbo.Empresa', 'Ibge') IS NULL ALTER TABLE dbo.Empresa ADD Ibge varchar(10) NULL;
IF COL_LENGTH('dbo.Empresa', 'Pais') IS NULL ALTER TABLE dbo.Empresa ADD Pais nvarchar(60) NULL;
IF COL_LENGTH('dbo.Empresa', 'Site') IS NULL ALTER TABLE dbo.Empresa ADD Site nvarchar(200) NULL;
IF COL_LENGTH('dbo.Empresa', 'Horarios') IS NULL ALTER TABLE dbo.Empresa ADD Horarios nvarchar(400) NULL;
IF COL_LENGTH('dbo.Empresa', 'LogoNome') IS NULL ALTER TABLE dbo.Empresa ADD LogoNome nvarchar(200) NULL;
IF COL_LENGTH('dbo.Empresa', 'Logo') IS NULL ALTER TABLE dbo.Empresa ADD Logo varbinary(max) NULL;

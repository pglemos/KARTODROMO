-- Cadastros antigos/importados são completados presencialmente. Não inventar perfis.
IF COL_LENGTH('dbo.Cliente', 'Instagram') IS NULL
  ALTER TABLE dbo.Cliente ADD Instagram nvarchar(31) NULL;

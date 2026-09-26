-- Último acesso do usuário do Office (coluna "Último acesso" do Registro de usuário).
IF COL_LENGTH('dbo.Usuario', 'UltimoAcesso') IS NULL
  ALTER TABLE dbo.Usuario ADD UltimoAcesso datetime2(0) NULL;

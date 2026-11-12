-- Promoção do aniversariante (reserva em grupo) e baterias de campeonato.
--  - ReservaGrupo.Aniversario: o responsável é o aniversariante; com pelo menos 10 convidados ativos a vaga dele
--    sai por PrecoAniversarianteCentavos (padrão R$ 90,00), os convidados pagam o preço do grupo.
--  - Bateria.Campeonato: a bateria é de um campeonato; aparece no totem, no site e na Recepção pelo nome do
--    campeonato (Bateria.Nome), sempre aberta para o piloto se inscrever.
-- O servidor da operação também garante estas colunas ao subir (lib/ops/eventos-schema.ts).

IF COL_LENGTH('dbo.ReservaGrupo', 'Aniversario') IS NULL
  ALTER TABLE dbo.ReservaGrupo ADD Aniversario BIT NOT NULL CONSTRAINT DF_ReservaGrupo_Aniversario DEFAULT 0;
IF COL_LENGTH('dbo.ReservaGrupo', 'PrecoAniversarianteCentavos') IS NULL
  ALTER TABLE dbo.ReservaGrupo ADD PrecoAniversarianteCentavos INT NULL;
IF COL_LENGTH('dbo.Bateria', 'Campeonato') IS NULL
  ALTER TABLE dbo.Bateria ADD Campeonato BIT NOT NULL CONSTRAINT DF_Bateria_Campeonato DEFAULT 0;
GO

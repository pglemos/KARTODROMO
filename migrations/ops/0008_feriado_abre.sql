-- Feriado que o kartódromo ABRE com o "Horário de Feriado" (padrão "Indoor - Feriado", 14:40–21:40).
-- Abre = 0: dia fechado (Natal, recesso). Abre = 1: os padrões normais pulam o dia e "Criar reservas" com
-- "Só nos feriados que abrem" gera o horário de feriado nele.
IF COL_LENGTH('dbo.Feriado', 'Abre') IS NULL
  ALTER TABLE dbo.Feriado ADD Abre BIT NOT NULL CONSTRAINT DF_Feriado_Abre DEFAULT 0;

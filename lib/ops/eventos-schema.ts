/**
 * Colunas da promoção do aniversariante e das baterias de campeonato (migrations/ops/0020_aniversario_campeonato.sql).
 * Garantidas uma vez por processo, para o servidor não depender de alguém rodar a migration à mão.
 */
import { query } from './db';

/** Regra do site: aniversariante + pelo menos 10 convidados pagantes → a corrida dele sai por R$ 90,00. */
export const ANIVERSARIO_MIN_CONVIDADOS = 10;
export const ANIVERSARIO_PRECO_PADRAO = 9000;

let pronto: Promise<void> | null = null;

export function garantirColunasEventos(): Promise<void> {
  if (!pronto) {
    pronto = query(`
      IF COL_LENGTH('dbo.ReservaGrupo', 'Aniversario') IS NULL
        ALTER TABLE dbo.ReservaGrupo ADD Aniversario BIT NOT NULL CONSTRAINT DF_ReservaGrupo_Aniversario DEFAULT 0;
      IF COL_LENGTH('dbo.ReservaGrupo', 'PrecoAniversarianteCentavos') IS NULL
        ALTER TABLE dbo.ReservaGrupo ADD PrecoAniversarianteCentavos INT NULL;
      IF COL_LENGTH('dbo.Bateria', 'Campeonato') IS NULL
        ALTER TABLE dbo.Bateria ADD Campeonato BIT NOT NULL CONSTRAINT DF_Bateria_Campeonato DEFAULT 0;`)
      .then(() => undefined)
      .catch((e) => { pronto = null; throw e; });
  }
  return pronto;
}

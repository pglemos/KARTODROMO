import sql from 'mssql';

const CONFIG = {
  server: '192.168.20.254',
  options: { instanceName: 'LAPTIME', encrypt: false, trustServerCertificate: true },
  database: 'LapTime',
  user: 'LapTimeSql',
  password: 'XrO8mjlPnrpotc8y',
  connectionTimeout: 5000,
};

async function main() {
  const c = await sql.connect(CONFIG);

  const q = async (label, query) => {
    try {
      const r = await c.request().query(query);
      console.log(`=== ${label} (${r.recordset.length}) ===`);
      r.recordset.slice(0, 60).forEach((x) => console.log(JSON.stringify(x)));
      console.log();
      return r.recordset;
    } catch (e) {
      console.log(`${label} ERROR:`, e.message);
      console.log();
      return [];
    }
  };

  // Colunas restantes de RacingCompetitor (offset 40+)
  await q('Colunas RacingCompetitor restantes', `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RacingCompetitor' ORDER BY ORDINAL_POSITION OFFSET 40 ROWS`);

  // TransponderCompetitor
  await q('Colunas TransponderCompetitor', `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TransponderCompetitor' ORDER BY ORDINAL_POSITION`);

  // TransponderRenumber
  await q('Colunas TransponderRenumber', `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TransponderRenumber' ORDER BY ORDINAL_POSITION`);

  // Ranking / RankingType
  await q('Tabelas Ranking', `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Rank%' OR TABLE_NAME LIKE '%Point%' ORDER BY TABLE_NAME`);

  // RacingStatus (nomes)
  await q('RacingStatus distinct', `SELECT DISTINCT RacingStatus FROM RacingCompetitor WHERE RacingStatus IS NOT NULL`);

  // RacingState distinct com nomes recentes
  await q('Racing estados recentes', `SELECT TOP 20 Id_Racing, RacingState, Name, StartDateTime, Id_RacingGroup FROM Racing ORDER BY Id_Racing DESC`);

  // Passings da corrida 627099 (CORRIDA hoje)
  await q('Passing da 627099 (ultimas 20)', `SELECT TOP 20 Id_Passing, Id_RacingCompetitor, Transponder, Lap, LapTime, TimeOfDay, Id_RacingFlag, DeletedLap, InvalidLap, Pos FROM Passing WHERE Id_Racing = 627099 ORDER BY Id_Passing DESC`);

  // RacingCompetitor da 627099
  await q('RacingCompetitor da 627099', `SELECT Id_RacingCompetitor, Number, Transponder, Competitor, ShortName, Pos, Lap, BestLapTime, TotalTime, DiffLeader, RacingStatus, Id_Category FROM RacingCompetitor WHERE Id_Racing = 627099 ORDER BY Pos`);

  await c.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
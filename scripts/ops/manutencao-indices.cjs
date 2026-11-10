// Manutenção semanal/periódica de índices e estatísticas no banco KartodromoOps.
// Desfragmenta tabelas (>30% REBUILD, 10-30% REORGANIZE) e atualiza estatísticas com FULLSCAN.
const fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(path.join(raiz, '.env.local'), 'utf8').split(/\r?\n/)) { 
  const m = l.match(/^(\w+)=(.*)$/); 
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); 
}
const sql = require(path.join(raiz, 'node_modules', 'mssql'));
const e = process.env;
const log = (t) => { 
  const s = `[${new Date().toISOString()}] ${t}\n`; 
  process.stdout.write(s); 
};

(async () => {
  const banco = e.OPS_SQL_DATABASE || 'KartodromoOps';
  log(`Conectando em ${e.OPS_SQL_SERVER || 'localhost'} / ${banco}...`);
  const pool = await sql.connect({
    server: (e.OPS_SQL_SERVER || 'localhost').split('\\')[0],
    database: banco,
    user: e.OPS_SQL_USER,
    password: e.OPS_SQL_PASSWORD,
    requestTimeout: 600000,
    connectionTimeout: 20000,
    options: { instanceName: e.OPS_SQL_INSTANCE || 'SQLEXPRESS', encrypt: false, trustServerCertificate: true },
  });

  const queryFrag = `
    SET NOCOUNT ON;
    SELECT 
        OBJECT_NAME(ips.object_id) AS TableName,
        i.name AS IndexName,
        ips.avg_fragmentation_in_percent AS FragPct,
        ips.page_count AS PageCount
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    WHERE ips.page_count > 50 AND i.name IS NOT NULL
    ORDER BY ips.avg_fragmentation_in_percent DESC;
  `;

  const rows = (await pool.request().query(queryFrag)).recordset;
  log(`Encontrados ${rows.length} índices monitorados (>50 páginas).`);

  for (const r of rows) {
    const { TableName, IndexName, FragPct } = r;
    if (FragPct >= 30) {
      log(`REBUILD: [${TableName}].[${IndexName}] (Fragmentação: ${FragPct.toFixed(1)}%)`);
      await pool.request().batch(`
        SET QUOTED_IDENTIFIER ON;
        SET ANSI_NULLS ON;
        ALTER INDEX [${IndexName}] ON [dbo].[${TableName}] REBUILD;
      `);
    } else if (FragPct >= 10) {
      log(`REORGANIZE: [${TableName}].[${IndexName}] (Fragmentação: ${FragPct.toFixed(1)}%)`);
      await pool.request().batch(`
        SET QUOTED_IDENTIFIER ON;
        SET ANSI_NULLS ON;
        ALTER INDEX [${IndexName}] ON [dbo].[${TableName}] REORGANIZE;
      `);
    }
  }

  log(`Atualizando estatísticas com FULLSCAN em tabelas críticas...`);
  const tabelasCriticas = ['Cliente', 'Inscricao', 'Bateria', 'Venda', 'VendaItem'];
  for (const tab of tabelasCriticas) {
    log(`UPDATE STATISTICS [dbo].[${tab}] WITH FULLSCAN`);
    await pool.request().batch(`UPDATE STATISTICS [dbo].[${tab}] WITH FULLSCAN`);
  }

  await pool.close();
  log(`Manutenção de índices e estatísticas concluída com sucesso!`);
})().catch((err) => {
  log(`FALHA na manutenção: ${err.message}`);
  process.exit(1);
});

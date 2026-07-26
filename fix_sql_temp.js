const sql = require('mssql');
const config = {
  server: '.\\SQLEXPRESS',
  database: 'master',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
    encrypt: false
  },
  connectionTimeout: 10000
};

async function main() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected!');
    
    // Enable all logins
    await pool.request().query("ALTER LOGIN [SRVKART\\Administrador] ENABLE");
    console.log('Enabled SRVKART\\Administrador');
    
    await pool.request().query("ALTER LOGIN [sa] ENABLE; ALTER LOGIN [sa] WITH PASSWORD = 'KartBetim2026!'");
    console.log('Enabled sa with new password');
    
    await pool.request().query("IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'LapTimeSql') CREATE LOGIN [LapTimeSql] WITH PASSWORD = 'XrO8mjlPnrpotc8y', DEFAULT_DATABASE = [master]; ELSE ALTER LOGIN [LapTimeSql] ENABLE");
    console.log('Created/Enabled LapTimeSql');
    
    const result = await pool.request().query("SELECT name, is_disabled, type_desc FROM sys.server_principals WHERE type IN ('S','U') ORDER BY type_desc, name");
    console.log(JSON.stringify(result.recordset, null, 2));
    
    pool.close();
    process.exit(0);
  } catch(err) {
    console.error('ERROR: ' + err.message);
    process.exit(1);
  }
}

main();

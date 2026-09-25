/**
 * Cria o banco operacional KartodromoOps no SRVKART e importa os dados herdados do LapTime.
 *
 *   npx tsx scripts/ops/setup-db.ts            -> cria banco/login/tabelas (idempotente)
 *   npx tsx scripts/ops/setup-db.ts --import   -> + importa clientes e grade de baterias futuras
 *
 * Usa o login sysadmin da instancia (CALXPRO_SQL_*) so pra criar o banco e o login dedicado
 * OPS_SQL_USER (db_owner apenas no KartodromoOps). A senha do login novo vai pro .env.local.
 */
import sql from 'mssql';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadLocalEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ||= value;
  }
}
loadLocalEnv();

const server = process.env.OPS_SQL_SERVER || '192.168.20.13';
const instanceName = process.env.OPS_SQL_INSTANCE || 'SQLEXPRESS';
const DB = 'KartodromoOps';
const OPS_USER = 'KartOpsSql';

const admin = {
  server,
  user: process.env.CALXPRO_SQL_USER || 'CALXPRO',
  password: process.env.CALXPRO_SQL_PASSWORD || '',
  options: { instanceName, encrypt: false, trustServerCertificate: true },
  requestTimeout: 600_000,
};

const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '') || null;
const clean = (v: unknown, max: number) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const validDate = (v: unknown) => (v instanceof Date && v.getUTCFullYear() > 1900 && v.getUTCFullYear() < 2100 ? v : null);

async function main() {
  const doImport = process.argv.includes('--import');
  const master = await new sql.ConnectionPool({ ...admin, database: 'master' }).connect();

  await master.request().query(`IF DB_ID('${DB}') IS NULL CREATE DATABASE [${DB}]`);

  let password = process.env.OPS_SQL_PASSWORD;
  const loginExists = (await master.request().query(`SELECT 1 x FROM sys.server_principals WHERE name='${OPS_USER}'`)).recordset.length > 0;
  if (!loginExists) {
    password = 'Ops' + randomBytes(12).toString('base64url') + '9!';
    await master.request().query(`CREATE LOGIN [${OPS_USER}] WITH PASSWORD='${password}', CHECK_POLICY=OFF, DEFAULT_DATABASE=[${DB}]`);
    appendFileSync(
      join(process.cwd(), '.env.local'),
      `\n# Banco operacional proprio (scripts/ops/setup-db.ts, ${new Date().toISOString().slice(0, 10)})\nOPS_SQL_SERVER=${server}\nOPS_SQL_INSTANCE=${instanceName}\nOPS_SQL_DATABASE=${DB}\nOPS_SQL_USER=${OPS_USER}\nOPS_SQL_PASSWORD=${password}\n`,
    );
    console.log(`login ${OPS_USER} criado; credencial gravada no .env.local`);
  }
  await master.close();

  const db = await new sql.ConnectionPool({ ...admin, database: DB }).connect();
  await db.request().query(`IF USER_ID('${OPS_USER}') IS NULL CREATE USER [${OPS_USER}] FOR LOGIN [${OPS_USER}]; ALTER ROLE db_owner ADD MEMBER [${OPS_USER}];`);

  const migration = readFileSync(join(process.cwd(), 'migrations', 'ops', '0001_inicial.sql'), 'utf8');
  for (const batch of migration.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)) {
    await db.request().batch(batch);
  }
  console.log('tabelas ok');

  if (doImport) {
    await importClientes(db);
    await importBaterias(db);
  }
  await db.close();
}

async function importClientes(db: sql.ConnectionPool) {
  const count = (await db.request().query('SELECT COUNT(*) n FROM dbo.Cliente')).recordset[0].n as number;
  if (count > 0) {
    console.log(`Cliente ja tem ${count} linhas, importacao pulada`);
    return;
  }
  const src = await db
    .request()
    .query(`SELECT Id_Customer, Name, TypeDoc, Doc, Email, Phone, Birthday, Gender, Weight, Zipcode, Address, Number, Complement,
                   Neighborhood, City, State, Id_Parent, LGPD, Created, Locked
            FROM LapTimeMirror.dbo.Customer`);
  const table = new sql.Table('dbo.Cliente');
  table.create = false;
  table.columns.add('Nome', sql.NVarChar(200), { nullable: false });
  table.columns.add('TipoDocumento', sql.VarChar(20), { nullable: false });
  table.columns.add('Documento', sql.NVarChar(60), { nullable: true });
  table.columns.add('DocumentoNum', sql.VarChar(30), { nullable: true });
  table.columns.add('Email', sql.NVarChar(200), { nullable: true });
  table.columns.add('Telefone', sql.NVarChar(40), { nullable: true });
  table.columns.add('TelefoneNum', sql.VarChar(20), { nullable: true });
  table.columns.add('Nascimento', sql.Date, { nullable: true });
  table.columns.add('Sexo', sql.Char(1), { nullable: true });
  table.columns.add('Peso', sql.Decimal(5, 1), { nullable: true });
  table.columns.add('Cep', sql.VarChar(12), { nullable: true });
  table.columns.add('Endereco', sql.NVarChar(200), { nullable: true });
  table.columns.add('Numero', sql.NVarChar(20), { nullable: true });
  table.columns.add('Complemento', sql.NVarChar(100), { nullable: true });
  table.columns.add('Bairro', sql.NVarChar(100), { nullable: true });
  table.columns.add('Cidade', sql.NVarChar(100), { nullable: true });
  table.columns.add('Estado', sql.VarChar(4), { nullable: true });
  table.columns.add('LgpdAceiteEm', sql.DateTime2, { nullable: true });
  table.columns.add('Bloqueado', sql.Bit, { nullable: false });
  table.columns.add('Origem', sql.VarChar(20), { nullable: false });
  table.columns.add('LegadoId', sql.Int, { nullable: true });
  table.columns.add('CriadoEm', sql.DateTime2, { nullable: false });

  const typeDoc = (t: unknown) => ({ 1: 'CPF', 2: 'RG', 3: 'PASSAPORTE' } as Record<string, string>)[String(t)] ?? 'CPF';
  for (const r of src.recordset) {
    const weight = Number(r.Weight);
    table.rows.add(
      clean(r.Name, 200) ?? 'Sem nome',
      typeDoc(r.TypeDoc),
      clean(r.Doc, 60),
      digits(r.Doc)?.slice(0, 30) ?? null,
      clean(r.Email, 200)?.toLowerCase() ?? null,
      clean(r.Phone, 40),
      digits(r.Phone)?.slice(-20) ?? null,
      validDate(r.Birthday),
      r.Gender === 1 ? 'M' : r.Gender === 2 ? 'F' : null,
      weight > 0 && weight < 999 ? weight : null,
      clean(r.Zipcode, 12),
      clean(r.Address, 200),
      clean(r.Number, 20),
      clean(r.Complement, 100),
      clean(r.Neighborhood, 100),
      clean(r.City, 100),
      clean(r.State, 4),
      r.LGPD ? validDate(r.Created) ?? new Date() : null,
      Boolean(r.Locked),
      'laptime',
      r.Id_Customer,
      validDate(r.Created) ?? new Date(),
    );
  }
  await db.request().bulk(table);
  console.log(`clientes LapTime importados: ${src.recordset.length}`);

  // responsavel (menor de idade) -> Id novo
  await db.request().query(`UPDATE c SET ResponsavelId = p.Id
    FROM dbo.Cliente c JOIN LapTimeMirror.dbo.Customer lc ON lc.Id_Customer = c.LegadoId
    JOIN dbo.Cliente p ON p.LegadoId = lc.Id_Parent WHERE lc.Id_Parent IS NOT NULL AND lc.Id_Parent > 0`);

  // clientes que so existiam no CalXPro (ja deduplicados por CPF/telefone no ClienteUnificado)
  const extra = await db.request().query(`SELECT Nome, Email, Telefone, Documento, Cidade, Estado, CriadoEm
    FROM LapTimeMirror.dbo.ClienteUnificado WHERE OrigemSistema <> 'LapTime'`).catch(() => ({ recordset: [] as Record<string, unknown>[] }));
  if (extra.recordset.length) {
    const t2 = new sql.Table('dbo.Cliente');
    t2.create = false;
    for (const [name, type] of [
      ['Nome', sql.NVarChar(200)], ['Documento', sql.NVarChar(60)], ['DocumentoNum', sql.VarChar(30)], ['Email', sql.NVarChar(200)],
      ['Telefone', sql.NVarChar(40)], ['TelefoneNum', sql.VarChar(20)], ['Cidade', sql.NVarChar(100)], ['Estado', sql.VarChar(4)],
      ['Origem', sql.VarChar(20)], ['CriadoEm', sql.DateTime2],
    ] as const) t2.columns.add(name, type, { nullable: name !== 'Nome' && name !== 'Origem' && name !== 'CriadoEm' });
    for (const r of extra.recordset) {
      t2.rows.add(clean(r.Nome, 200) ?? 'Sem nome', clean(r.Documento, 60), digits(r.Documento)?.slice(0, 30) ?? null, clean(r.Email, 200)?.toLowerCase() ?? null,
        clean(r.Telefone, 40), digits(r.Telefone)?.slice(-20) ?? null, clean(r.Cidade, 100), clean(r.Estado, 4), 'calxpro', validDate(r.CriadoEm) ?? new Date());
    }
    await db.request().bulk(t2);
    console.log(`clientes so do CalXPro importados: ${extra.recordset.length}`);
  }
}

async function importBaterias(db: sql.ConnectionPool) {
  const res = await db.request().query(`
    INSERT INTO dbo.Bateria (Inicio, Nome, TipoKart, Vagas, Status, AutoAtendimento, LegadoId)
    SELECT b.ExpectedDateTime, b.Name, CASE WHEN p.Id_Category = 2 THEN 'super' ELSE 'light' END, b.MaxVacancies, 'aberta', 1, b.Id_Booking
    FROM LapTimeMirror.dbo.Booking b
    LEFT JOIN LapTimeMirror.dbo.Product p ON p.Id_Product = b.Id_Product
    WHERE b.ExpectedDateTime >= CAST(GETDATE() AS date)
      AND NOT EXISTS (SELECT 1 FROM dbo.Bateria x WHERE x.LegadoId = b.Id_Booking)`);
  console.log(`baterias futuras importadas: ${res.rowsAffected[0]}`);
}

main().catch((err) => {
  console.error('FALHA', err);
  process.exit(1);
});

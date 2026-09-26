/**
 * Completa o cadastro de clientes do KartodromoOps com o CalXPro (sistema anterior ao LapTime,
 * banco CALXPRO no SRVKART) e importa os contatos (CONTATO + EMAIL) de cada cliente.
 *
 *   npx tsx scripts/ops/enriquecer-calxpro.ts
 *
 * - liga cada Cliente ao ID_CLIENTE do CalXPro (coluna CalxproId) por CPF, e-mail ou nome+celular
 * - so preenche campo VAZIO no cadastro novo (nunca sobrescreve o que ja existe)
 * - CONTATO vira dbo.ClienteContato (nome, celular, telefone, e-mail) do cliente dono
 * Idempotente.
 */
import sql from 'mssql';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadLocalEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
loadLocalEnv();

const dig = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const nm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();
const clean = (v: unknown, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const UF: Record<number, string> = { 1: 'AC', 2: 'AL', 3: 'AP', 4: 'AM', 5: 'BA', 6: 'CE', 7: 'DF', 8: 'ES', 9: 'GO', 10: 'MA', 11: 'MT', 12: 'MS', 13: 'MG', 14: 'PA', 15: 'PB', 16: 'PR', 17: 'PE', 18: 'PI', 19: 'RJ', 20: 'RN', 21: 'RS', 22: 'RO', 23: 'RR', 24: 'SC', 25: 'SP', 26: 'SE', 27: 'TO' };

async function main() {
  const base = {
    server: process.env.OPS_SQL_SERVER || '192.168.20.13',
    user: process.env.CALXPRO_SQL_USER || 'CALXPRO',
    password: process.env.CALXPRO_SQL_PASSWORD || '',
    options: { instanceName: process.env.OPS_SQL_INSTANCE || 'SQLEXPRESS', encrypt: false, trustServerCertificate: true },
    requestTimeout: 1_200_000,
  };
  const ops = await new sql.ConnectionPool({ ...base, database: 'KartodromoOps' }).connect();
  const cx = await new sql.ConnectionPool({ ...base, database: 'CALXPRO' }).connect();

  await ops.request().batch(`
    IF COL_LENGTH('dbo.Cliente', 'CalxproId') IS NULL ALTER TABLE dbo.Cliente ADD CalxproId INT NULL;
    IF OBJECT_ID('dbo.ClienteContato') IS NULL
      CREATE TABLE dbo.ClienteContato (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ClienteId INT NOT NULL REFERENCES dbo.Cliente(Id),
        Nome NVARCHAR(150) NULL, Celular NVARCHAR(40) NULL, Telefone NVARCHAR(40) NULL, Email NVARCHAR(200) NULL,
        Origem VARCHAR(20) NOT NULL DEFAULT 'calxpro', LegadoId INT NULL, CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );`);
  await ops.request().batch(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_Calxpro') CREATE INDEX IX_Cliente_Calxpro ON dbo.Cliente(CalxproId);`);

  const o = (await ops.request().query('SELECT Id, DocumentoNum d, Email e, TelefoneNum t, Nome n, CalxproId cx FROM dbo.Cliente')).recordset as { Id: number; d: string; e: string; t: string; n: string; cx: number | null }[];
  const byCpf = new Map<string, number>(), byEmail = new Map<string, number>(), byNomeTel = new Map<string, number>();
  for (const r of o) {
    if (r.d && r.d.length >= 11 && !byCpf.has(r.d.slice(-11))) byCpf.set(r.d.slice(-11), r.Id);
    if (r.e && !byEmail.has(r.e.toLowerCase())) byEmail.set(r.e.toLowerCase(), r.Id);
    if (r.t && r.t.length >= 8) byNomeTel.set(nm(r.n) + '|' + r.t.slice(-8), r.Id);
  }

  const c = (await cx.request().query(`SELECT ID_CLIENTE, ST_NOME, ST_SOBRENOME, ST_CPF, ST_EMAIL, ST_CELULAR, ST_TELEFONE, DT_NASC, ST_ENDERECO, ST_NUMERO,
      ST_COMPLEMENTO, ST_BAIRRO, ST_CEP, ST_CIDADE, ID_UF, NM_PESOKG, SEXO FROM dbo.CLIENTE`)).recordset;
  const tab = new sql.Table('#cx');
  tab.create = true;
  for (const [n, t] of [['OpsId', sql.Int], ['CalxproId', sql.Int], ['Email', sql.NVarChar(200)], ['Telefone', sql.NVarChar(40)], ['TelefoneNum', sql.VarChar(20)], ['Nascimento', sql.Date],
    ['Endereco', sql.NVarChar(200)], ['Numero', sql.NVarChar(20)], ['Complemento', sql.NVarChar(100)], ['Bairro', sql.NVarChar(100)], ['Cep', sql.VarChar(12)],
    ['Cidade', sql.NVarChar(100)], ['Estado', sql.VarChar(4)], ['Peso', sql.Decimal(5, 1)], ['Sexo', sql.Char(1)]] as const) tab.columns.add(n, t, { nullable: true });
  let ligados = 0;
  for (const r of c) {
    const cpf = dig(r.ST_CPF), email = String(r.ST_EMAIL ?? '').trim().toLowerCase(), cel = dig(r.ST_CELULAR || r.ST_TELEFONE);
    const id = (cpf.length >= 11 && byCpf.get(cpf.slice(-11))) || (email && byEmail.get(email)) || (cel.length >= 8 && byNomeTel.get(nm(`${r.ST_NOME} ${r.ST_SOBRENOME ?? ''}`) + '|' + cel.slice(-8)));
    if (!id) continue;
    ligados++;
    const nasc = r.DT_NASC instanceof Date && r.DT_NASC.getUTCFullYear() > 1900 && r.DT_NASC < new Date() ? r.DT_NASC : null;
    const peso = Number(r.NM_PESOKG);
    tab.rows.add(id, r.ID_CLIENTE, clean(email, 200), clean(r.ST_CELULAR || r.ST_TELEFONE, 40), cel.slice(-20) || null, nasc, clean(r.ST_ENDERECO, 200), clean(r.ST_NUMERO, 20),
      clean(r.ST_COMPLEMENTO, 100), clean(r.ST_BAIRRO, 100), clean(r.ST_CEP, 12), clean(r.ST_CIDADE, 100), UF[Number(r.ID_UF)] ?? null,
      peso > 0 && peso < 400 ? peso : null, r.SEXO === 'M' || r.SEXO === 'F' ? r.SEXO : null);
  }
  const t = new sql.Transaction(ops);
  await t.begin();
  const rq = () => new sql.Request(t);
  await rq().bulk(tab);
  const up = await rq().query(`
    UPDATE c SET
      CalxproId = COALESCE(c.CalxproId, x.CalxproId),
      Email = COALESCE(NULLIF(c.Email, ''), x.Email),
      Telefone = COALESCE(NULLIF(c.Telefone, ''), x.Telefone),
      TelefoneNum = COALESCE(NULLIF(c.TelefoneNum, ''), x.TelefoneNum),
      Nascimento = COALESCE(c.Nascimento, x.Nascimento),
      Endereco = COALESCE(NULLIF(c.Endereco, ''), x.Endereco), Numero = COALESCE(NULLIF(c.Numero, ''), x.Numero),
      Complemento = COALESCE(NULLIF(c.Complemento, ''), x.Complemento), Bairro = COALESCE(NULLIF(c.Bairro, ''), x.Bairro),
      Cep = COALESCE(NULLIF(c.Cep, ''), x.Cep), Cidade = COALESCE(NULLIF(c.Cidade, ''), x.Cidade), Estado = COALESCE(NULLIF(c.Estado, ''), x.Estado),
      Peso = COALESCE(c.Peso, x.Peso), Sexo = COALESCE(c.Sexo, x.Sexo)
    FROM dbo.Cliente c JOIN (SELECT *, ROW_NUMBER() OVER (PARTITION BY OpsId ORDER BY CalxproId DESC) rn FROM #cx) x ON x.OpsId = c.Id AND x.rn = 1`);
  await t.commit();
  console.log(`clientes CalXPro ligados: ${ligados} de ${c.length}; cadastros atualizados: ${up.rowsAffected[0]}`);

  // contatos do CalXPro (ST_TABELA = 'CLIENTE', ID_CODTABELA = ID_CLIENTE) + e-mail
  const ja = (await ops.request().query(`SELECT COUNT(*) n FROM dbo.ClienteContato WHERE Origem = 'calxpro'`)).recordset[0].n as number;
  if (ja === 0) {
    const map = new Map((await ops.request().query('SELECT Id, CalxproId FROM dbo.Cliente WHERE CalxproId IS NOT NULL')).recordset.map((r) => [r.CalxproId as number, r.Id as number]));
    const ct = (await cx.request().query(`SELECT ct.ID_CONTATO, ct.ID_CODTABELA, ct.ST_NOME, ct.ST_CELULAR, ct.ST_TELEFONE, e.ST_EMAIL
      FROM dbo.CONTATO ct OUTER APPLY (SELECT TOP 1 ST_EMAIL FROM dbo.EMAIL em WHERE em.ID_CONTATO = ct.ID_CONTATO ORDER BY em.ID_EMAIL DESC) e WHERE ct.ST_TABELA = 'CLIENTE'`)).recordset;
    const tc = new sql.Table('dbo.ClienteContato');
    tc.create = false;
    for (const [n, ty] of [['ClienteId', sql.Int], ['Nome', sql.NVarChar(150)], ['Celular', sql.NVarChar(40)], ['Telefone', sql.NVarChar(40)], ['Email', sql.NVarChar(200)], ['Origem', sql.VarChar(20)], ['LegadoId', sql.Int]] as const)
      tc.columns.add(n, ty, { nullable: n !== 'ClienteId' && n !== 'Origem' });
    let semDono = 0;
    for (const r of ct) {
      const cli = map.get(Number(r.ID_CODTABELA));
      if (!cli) { semDono++; continue; }
      tc.rows.add(cli, clean(r.ST_NOME, 150), clean(r.ST_CELULAR, 40), clean(r.ST_TELEFONE, 40), clean(String(r.ST_EMAIL ?? '').toLowerCase(), 200), 'calxpro', r.ID_CONTATO);
    }
    if (tc.rows.length) await ops.request().bulk(tc);
    console.log(`contatos importados: ${tc.rows.length}; sem cliente correspondente: ${semDono}`);
    // cliente sem telefone/e-mail ganha o do contato
    const fill = await ops.request().query(`UPDATE c SET
        Telefone = COALESCE(NULLIF(c.Telefone, ''), k.Celular, k.Telefone),
        TelefoneNum = COALESCE(NULLIF(c.TelefoneNum, ''), RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(k.Celular, k.Telefone), '(', ''), ')', ''), '-', ''), ' ', ''), '.', ''), 20)),
        Email = COALESCE(NULLIF(c.Email, ''), k.Email)
      FROM dbo.Cliente c CROSS APPLY (SELECT TOP 1 * FROM dbo.ClienteContato cc WHERE cc.ClienteId = c.Id ORDER BY cc.LegadoId DESC) k
      WHERE (NULLIF(c.Telefone, '') IS NULL AND COALESCE(k.Celular, k.Telefone) IS NOT NULL) OR (NULLIF(c.Email, '') IS NULL AND k.Email IS NOT NULL)`);
    console.log(`cadastros completados com telefone/e-mail do contato: ${fill.rowsAffected[0]}`);
  }
  const tot = (await ops.request().query(`SELECT COUNT(*) total, SUM(CASE WHEN NULLIF(Telefone,'') IS NULL THEN 1 ELSE 0 END) semFone, SUM(CASE WHEN NULLIF(Email,'') IS NULL THEN 1 ELSE 0 END) semEmail,
    SUM(CASE WHEN Nascimento IS NULL THEN 1 ELSE 0 END) semNasc, SUM(CASE WHEN CalxproId IS NOT NULL THEN 1 ELSE 0 END) comCalxpro FROM dbo.Cliente`)).recordset[0];
  console.log('situacao final:', tot);
  await ops.close();
  await cx.close();
}

main().catch((e) => { console.error('FALHA', e); process.exit(1); });

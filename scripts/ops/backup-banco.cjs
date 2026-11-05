// Backup diário do banco da operação (tarefa "Kartodromo Backup Banco"): .bak em F:\bkp\KartodromoOps (14 dias) e cópia
// comprimida e criptografada (AES-256-GCM) no R2, fora do prédio. Restaurar: scripts/ops/restaurar-backup-nuvem.cjs
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { pipeline } = require('stream/promises');
const raiz = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(path.join(raiz, '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); }
const sql = require(path.join(raiz, 'node_modules', 'mssql'));
const e = process.env, PASTA = 'F:\\bkp\\KartodromoOps', DIAS = 14;
const log = (t) => { const s = `[${new Date().toISOString()}] ${t}\n`; fs.appendFileSync(path.join(PASTA, 'backup.log'), s); process.stdout.write(s); };
async function enviar(arq) {
  const n = JSON.parse(fs.readFileSync(path.join(PASTA, '.nuvem.json'), 'utf8').replace(/^\uFEFF/, ''));
  const iv = crypto.randomBytes(12), cifra = crypto.createCipheriv('aes-256-gcm', Buffer.from(n.chave, 'hex'), iv);
  const enc = arq + '.enc', saida = fs.createWriteStream(enc);
  saida.write(iv);
  await pipeline(fs.createReadStream(arq), zlib.createGzip(), cifra, saida);
  fs.appendFileSync(enc, cifra.getAuthTag());
  const corpo = fs.readFileSync(enc);
  try {
    const r = await fetch(`${n.url}/${path.basename(enc)}`, { method: 'PUT', headers: { authorization: `Bearer ${n.token}` }, body: corpo, signal: AbortSignal.timeout(600000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    log(`nuvem ok ${path.basename(enc)} ${Math.round(corpo.length / 1048576)} MB`);
  } finally { fs.unlinkSync(enc); }
}
(async () => {
  const banco = e.OPS_SQL_DATABASE;
  const p = await sql.connect({ server: (e.OPS_SQL_SERVER || 'localhost').split('\\')[0], database: banco, user: e.OPS_SQL_USER, password: e.OPS_SQL_PASSWORD, requestTimeout: 900000, connectionTimeout: 20000, options: { instanceName: e.OPS_SQL_INSTANCE, encrypt: false, trustServerCertificate: true } });
  const arq = path.join(PASTA, `${banco}-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.bak`);
  await p.request().batch(`BACKUP DATABASE [${banco}] TO DISK = N'${arq}' WITH INIT, CHECKSUM`);
  await p.close();
  if (fs.statSync(arq).size < 1048576) throw new Error('arquivo de backup pequeno demais');
  log(`ok ${path.basename(arq)} ${Math.round(fs.statSync(arq).size / 1048576)} MB (CHECKSUM)`);
  const limite = Date.now() - DIAS * 86400000;
  for (const f of fs.readdirSync(PASTA).filter((x) => x.endsWith('.bak')).map((x) => path.join(PASTA, x))) if (fs.statSync(f).mtimeMs < limite) fs.unlinkSync(f);
  await enviar(arq);
})().catch((x) => { log('FALHOU ' + x.message); process.exit(1); });
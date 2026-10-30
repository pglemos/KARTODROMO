// Baixa e decifra um backup da nuvem: node restaurar-backup-nuvem.cjs <config.json> <nome.enc> <saida.bak>
const fs = require('fs'), zlib = require('zlib'), crypto = require('crypto');
const [cfg, nome, saida] = process.argv.slice(2);
(async () => {
  const n = JSON.parse(fs.readFileSync(cfg, 'utf8').replace(/^\uFEFF/, ''));
  const r = await fetch(`${n.url}/${nome}`, { headers: { authorization: `Bearer ${n.token}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(n.chave, 'hex'), b.subarray(0, 12));
  d.setAuthTag(b.subarray(b.length - 16));
  fs.writeFileSync(saida, zlib.gunzipSync(Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()])));
  console.log('ok', saida, fs.statSync(saida).size);
})().catch((x) => { console.error('FALHOU', x.message); process.exit(1); });
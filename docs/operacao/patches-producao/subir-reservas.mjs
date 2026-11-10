import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const pWin = process.env.APPDATA ? join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml') : '';
const pMac = join(homedir(), 'Library/Preferences/.wrangler/config/default.toml');
const cfgPath = existsSync(pWin) ? pWin : existsSync(pMac) ? pMac : null;
if (!cfgPath) throw new Error('default.toml não encontrado');
const cfg = readFileSync(cfgPath, 'utf8');
const tok = cfg.match(/oauth_token = "([^"]+)"/)[1];
const acc = 'e476c4322903cf98849d505ea26f726f';

const workerPath = process.argv[2] || '/Users/pedroguilherme/.gemini/antigravity/brain/606bd343-5233-4d13-8594-492165f960d9/scratch/reservas-worker-novo.js';
const workerCode = readFileSync(workerPath, 'utf8');

const metadata = {
  main_module: 'worker.js',
  compatibility_date: '2026-10-01',
  compatibility_flags: [],
  keep_assets: true,
  bindings: [
    {
      name: 'ASSETS',
      type: 'assets',
      run_worker_first: true,
    },
    {
      name: 'LEGACY',
      type: 'service',
      service: 'kartodromo-cadastro',
      environment: 'production',
    },
  ],
  observability: { enabled: true },
};

const fd = new FormData();
fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
fd.append('worker.js', new Blob([workerCode], { type: 'application/javascript+module' }), 'worker.js');

const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/workers/scripts/kartodromo-reservas-2026`, {
  method: 'PUT',
  headers: { Authorization: 'Bearer ' + tok },
  body: fd,
});

const j = await r.json();
console.log('Deploy kartodromo-reservas-2026:', r.status, j.success, JSON.stringify(j.errors), j.result?.id, (j.result?.bindings ?? []).length);
if (!j.success) {
  console.error('Erros no deploy:', j.errors);
  process.exit(1);
}

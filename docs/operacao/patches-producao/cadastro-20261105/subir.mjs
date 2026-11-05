import { readFileSync } from 'node:fs';
const cfg = readFileSync(process.env.APPDATA + '/xdg.config/.wrangler/config/default.toml', 'utf8');
const tok = cfg.match(/oauth_token = "([^"]+)"/)[1];
const acc = 'e476c4322903cf98849d505ea26f726f';
const metadata = {
  main_module: 'index.js',
  compatibility_date: '2026-07-01',
  compatibility_flags: ['nodejs_compat'],
  keep_assets: true,
  keep_bindings: ['durable_object_namespace', 'secret_text', 'plain_text', 'send_email', 'd1', 'r2_bucket', 'assets'],
  observability: { enabled: true },
};
const fd = new FormData();
fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
fd.append('index.js', new Blob([readFileSync(process.argv[2] || 'index.js')], { type: 'application/javascript+module' }), 'index.js');
const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/workers/scripts/kartodromo-cadastro`, { method: 'PUT', headers: { Authorization: 'Bearer ' + tok }, body: fd });
const j = await r.json();
console.log(r.status, j.success, JSON.stringify(j.errors), j.result?.id, (j.result?.bindings ?? []).length);

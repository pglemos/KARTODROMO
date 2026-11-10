// baixa o worker kartodromo-cadastro que está no ar (multipart) para script.raw
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
const tok = readFileSync(homedir() + '/Library/Preferences/.wrangler/config/default.toml', 'utf8').match(/oauth_token = "([^"]+)"/)[1];
const url = 'https://api.cloudflare.com/client/v4/accounts/e476c4322903cf98849d505ea26f726f/workers/scripts/kartodromo-cadastro';
const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
const b = Buffer.from(await r.arrayBuffer());
writeFileSync('script.raw', b);
console.log(r.status, b.length);

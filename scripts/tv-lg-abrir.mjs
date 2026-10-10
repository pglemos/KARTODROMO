// Abre um endereço no navegador de uma TV LG (webOS) pela rede.
//
//   node scripts/tv-lg-abrir.mjs --tv 192.168.20.7 --url http://192.168.20.249:4050/tv [--segura] [--novo]
//   --novo: pede ACEITAR de novo (ex.: quando o manifesto ganhou permissão nova)
//
// Na 1ª vez a TV mostra "permitir controle?" e alguém precisa apertar Aceitar no controle remoto (90 s). A chave de
// pareamento que a TV devolve fica em C:\KARTODROMO\segredos\lg-tv\<ip>.json (fora do repositório, que é público);
// das próximas vezes não pergunta mais. Protocolo: SSAP do webOS (WebSocket na porta 3000).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import WebSocket from 'ws';
import { manifesto } from './tv-lg-manifesto.mjs';

const args = process.argv.slice(2);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const tv = valor('--tv');
const url = valor('--url');
const pasta = valor('--chaves') || 'C:\\KARTODROMO\\segredos\\lg-tv';
if (!tv || !url) { console.error('uso: --tv <ip> --url <endereço>'); process.exit(2); }

const arquivoChave = join(pasta, `${tv}.json`);
const chaveSalva = !args.includes('--novo') && existsSync(arquivoChave) ? JSON.parse(readFileSync(arquivoChave, 'utf8'))['client-key'] : undefined;


// webOS novo (ex.: NanoCell 2021+) só aceita a porta segura 3001, com certificado próprio da TV (autoassinado):
// a verificação do certificado é desligada SÓ nesta conexão com a TV da rede local
const segura = args.includes('--segura');
const ws = segura ? new WebSocket(`wss://${tv}:3001`, { rejectUnauthorized: false }) : new WebSocket(`ws://${tv}:3000`);
let id = 0;
const pendentes = new Map();
const enviar = (msg) => new Promise((ok) => { const i = `kib_${++id}`; pendentes.set(i, ok); ws.send(JSON.stringify({ id: i, ...msg })); });
const desistir = setTimeout(() => { console.log(`${tv}: sem resposta em 100 s (ninguém aceitou na TV?)`); process.exit(1); }, 100_000);

ws.on('error', (e) => { console.log(`${tv}: não consegui conectar (${segura ? 'porta 3001 segura' : 'porta 3000; tente --segura'}): ${e.message}`); process.exit(1); });
ws.on('message', (dados) => {
  const m = JSON.parse(String(dados));
  if (m.type === 'response' && m.payload?.pairingType === 'PROMPT') { console.log(`${tv}: aguardando alguém apertar ACEITAR na TV...`); return; }
  const ok = pendentes.get(m.id);
  if (ok) { pendentes.delete(m.id); ok(m); }
});
ws.on('open', async () => {
  const reg = await enviar({ type: 'register', payload: { forcePairing: false, pairingType: 'PROMPT', 'client-key': chaveSalva, manifest: manifesto } });
  if (reg.type !== 'registered') { console.log(`${tv}: a TV recusou o controle (${reg.error || reg.type})`); process.exit(1); }
  if (reg.payload?.['client-key'] && reg.payload['client-key'] !== chaveSalva) {
    mkdirSync(pasta, { recursive: true });
    writeFileSync(arquivoChave, JSON.stringify({ 'client-key': reg.payload['client-key'], pareadoEm: new Date().toISOString() }, null, 2));
    console.log(`${tv}: pareado (permissão guardada fora do repositório)`);
  }
  const r = await enviar({ type: 'request', uri: 'ssap://system.launcher/open', payload: { target: url } });
  console.log(r.payload?.returnValue ? `${tv}: abriu ${url}` : `${tv}: não abriu (${r.payload?.errorText || r.error || 'erro'})`);
  clearTimeout(desistir);
  ws.close();
  process.exit(r.payload?.returnValue ? 0 : 1);
});

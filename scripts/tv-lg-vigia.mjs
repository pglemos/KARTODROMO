// Vigia das TVs LG (webOS): mantém o placar /tv aberto em todas as TVs LG da rede.
//
//   node scripts/tv-lg-vigia.mjs [--url http://192.168.20.249:4050/tv] [--intervalo 60] [--uma-vez]
//
// A cada ciclo procura as TVs LG pela rede (SSDP) e, em cada TV ligada que não está com o placar conectado no :4050:
//   - TV acabou de ligar (não respondia no ciclo anterior) → abre o placar;
//   - TV ligada na tela inicial ou no navegador (placar fechado/travado) → abre o placar;
//   - TV em outro app (TV aberta, YouTube, HDMI…) → deixa como está: alguém escolheu aquilo.
// TV ainda não pareada mostra "permitir controle?" no máximo a cada 10 min até alguém aceitar no controle remoto.
// Chaves de pareamento em C:\KARTODROMO\segredos\lg-tv\<ip>.json (as mesmas do tv-lg-abrir.mjs, fora do Git).
import { execFileSync } from 'node:child_process';
import dgram from 'node:dgram';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const args = process.argv.slice(2);
const valor = (n, padrao) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : padrao; };
const URL_PLACAR = valor('--url', 'http://192.168.20.249:4050/tv');
const INTERVALO = Number(valor('--intervalo', '60')) * 1000;
const PASTA = valor('--chaves', 'C:\\KARTODROMO\\segredos\\lg-tv');
const PORTA_PLACAR = new URL(URL_PLACAR).port || '80';
const NO_PLACAR = new Set(['com.webos.app.home', 'com.webos.app.homeconnect', 'com.webos.app.browser', 'com.webos.app.discovery', '']);

const log = (m) => console.log(`${new Date().toLocaleString('pt-BR')} ${m}`);
const chaveDe = (ip) => { const f = join(PASTA, `${ip}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8'))['client-key'] : undefined; };

const manifesto = {
  manifestVersion: 1, appVersion: '1.0',
  signed: { appId: 'br.com.kartodromodebetim.placar', created: '20261008', localizedAppNames: { '': 'Placar Kartódromo' }, localizedVendorNames: { '': 'Kartódromo Internacional de Betim' }, permissions: ['LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'READ_RUNNING_APPS', 'READ_INSTALLED_APPS'], serial: 'kib-placar-1', vendorId: 'br.com.kartodromodebetim' },
  permissions: ['LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'READ_RUNNING_APPS', 'READ_INSTALLED_APPS'],
  signatures: [{ signatureVersion: 1, signature: 'kib' }],
};

// TVs LG que responderam ao SSDP (webOS anuncia "WebOS" ou "LGE WebOS TV" no SERVER)
function procurarTvs() {
  const ip = Object.values(networkInterfaces()).flat().find((a) => a?.family === 'IPv4' && !a.internal)?.address;
  return new Promise((ok) => {
    const achadas = new Set();
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    s.on('message', (m, r) => { if (/webos/i.test(String(m))) achadas.add(r.address); });
    s.on('error', () => ok(achadas));
    s.bind(0, ip, () => {
      if (ip) s.setMulticastInterface(ip);
      for (const st of ['urn:lge-com:service:webos-second-screen:1', 'urn:dial-multiscreen-org:service:dial:1', 'upnp:rootdevice'])
        s.send(`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${st}\r\n\r\n`, 1900, '239.255.255.250');
    });
    setTimeout(() => { s.close(); ok(achadas); }, 3500);
  });
}

// IPs com conexão aberta no placar (a página /tv mantém o fluxo de eventos aberto)
function conectadosNoPlacar() {
  try {
    const saida = execFileSync('netstat', ['-an', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
    return new Set(saida.split(/\r?\n/).filter((l) => l.includes('ESTABLISHED') && l.includes(`:${PORTA_PLACAR} `))
      .map((l) => l.trim().split(/\s+/)[2]?.split(':')[0]).filter(Boolean));
  } catch { return new Set(); }
}

// Conversa SSAP com a TV: porta segura 3001 (webOS novo) e, se falhar, 3000
function conectar(ip, permitirPedido) {
  const tentar = (segura) => new Promise((ok, falha) => {
    const ws = segura ? new WebSocket(`wss://${ip}:3001`, { rejectUnauthorized: false, handshakeTimeout: 4000 }) : new WebSocket(`ws://${ip}:3000`, { handshakeTimeout: 4000 });
    ws.once('error', falha);
    ws.once('open', () => ok(ws));
  });
  return tentar(true).catch(() => tentar(false)).then((ws) => new Promise((ok, falha) => {
    let id = 0;
    const pendentes = new Map();
    const pedir = (msg) => new Promise((r) => { const i = `kib_${++id}`; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, ...msg })); });
    const tempo = setTimeout(() => { ws.terminate(); falha(new Error('ninguém aceitou na TV')); }, permitirPedido ? 95_000 : 8_000);
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.payload?.pairingType === 'PROMPT') { if (!permitirPedido) { ws.terminate(); } else log(`${ip}: pedindo permissão na tela da TV (apertar ACEITAR)`); return; }
      const r = pendentes.get(m.id); if (r) { pendentes.delete(m.id); r(m); }
    });
    ws.on('close', () => { clearTimeout(tempo); falha(new Error('conexão fechada')); });
    const chave = chaveDe(ip);
    pedir({ type: 'register', payload: { forcePairing: false, pairingType: 'PROMPT', 'client-key': chave, manifest: manifesto } }).then((reg) => {
      clearTimeout(tempo);
      if (reg.type !== 'registered') { ws.terminate(); return falha(new Error(reg.error || 'recusou')); }
      if (reg.payload?.['client-key'] && reg.payload['client-key'] !== chave) {
        mkdirSync(PASTA, { recursive: true });
        writeFileSync(join(PASTA, `${ip}.json`), JSON.stringify({ 'client-key': reg.payload['client-key'], pareadoEm: new Date().toISOString() }, null, 2));
        log(`${ip}: pareada`);
      }
      ok({ pedir, fechar: () => ws.close() });
    });
  }));
}

const ligadaAntes = new Map();   // ip → respondeu no ciclo anterior
const ultimoPedido = new Map();  // ip → hora do último "permitir controle?" mostrado

async function cuidar(ip, noPlacar) {
  const acabouDeLigar = !ligadaAntes.get(ip);
  ligadaAntes.set(ip, true);
  if (noPlacar.has(ip)) return;
  const pareada = !!chaveDe(ip);
  if (!pareada && Date.now() - (ultimoPedido.get(ip) ?? 0) < 10 * 60_000) return;
  if (!pareada) ultimoPedido.set(ip, Date.now());
  let tv;
  try { tv = await conectar(ip, !pareada); } catch (e) { log(`${ip}: sem controle (${e.message})`); return; }
  try {
    const frente = (await tv.pedir({ type: 'request', uri: 'ssap://com.webos.applicationManager/getForegroundAppInfo' })).payload?.appId ?? '';
    if (!acabouDeLigar && !NO_PLACAR.has(frente)) return;   // alguém pôs outro app: respeita
    const r = await tv.pedir({ type: 'request', uri: 'ssap://system.launcher/open', payload: { target: URL_PLACAR } });
    log(r.payload?.returnValue ? `${ip}: placar aberto (estava em ${frente || 'nada'}${acabouDeLigar ? ', acabou de ligar' : ''})` : `${ip}: não abriu (${r.payload?.errorText || r.error})`);
  } finally { tv.fechar(); }
}

async function ciclo() {
  const tvs = await procurarTvs();
  for (const ip of ligadaAntes.keys()) if (!tvs.has(ip)) ligadaAntes.set(ip, false);
  const noPlacar = conectadosNoPlacar();
  if (args.includes('--uma-vez')) log(`TVs: ${[...tvs].map((ip) => `${ip}${noPlacar.has(ip) ? ' (no placar)' : ''}`).join(', ') || 'nenhuma'}`);
  await Promise.all([...tvs].map((ip) => cuidar(ip, noPlacar).catch((e) => log(`${ip}: ${e.message}`))));
}

log(`vigia das TVs: placar ${URL_PLACAR}, a cada ${INTERVALO / 1000} s`);
// no 1º ciclo as TVs já ligadas não contam como "acabou de ligar" (não tira ninguém de outro app ao reiniciar o vigia)
for (const ip of await procurarTvs()) ligadaAntes.set(ip, true);
if (args.includes('--uma-vez')) { await ciclo(); process.exit(0); }
for (;;) { await ciclo().catch((e) => log(`erro: ${e.message}`)); await new Promise((r) => setTimeout(r, INTERVALO)); }

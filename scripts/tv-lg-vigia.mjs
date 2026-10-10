// Vigia das TVs LG (webOS): ligou a TV → a primeira coisa na tela é o placar /tv, esteja ela no canal, HDMI ou app.
//
//   node scripts/tv-lg-vigia.mjs [--url http://192.168.20.249:4050/tv] [--uma-vez]
//
// Fica conectado em cada TV (SSAP do webOS) e acompanha se ela está ligada:
//   - TV LIGOU (voltou à rede, ou saiu do modo de espera) → abre o placar em ~3 s e confere; tenta de novo se não abriu;
//   - TV ligada na tela inicial ou no navegador sem o placar (fechado/travado) → abre o placar (checagem a cada 60 s);
//   - TV que alguém trocou para outro app DEPOIS de ligar → respeita até ela ser desligada e ligada de novo.
// TVs novas são achadas pela rede (SSDP) a cada 30 s; TV não pareada pede ACEITAR no máximo a cada 10 min.
// Chaves de pareamento em C:\KARTODROMO\segredos\lg-tv\<ip>.json (as mesmas do tv-lg-abrir.mjs, fora do Git).
import { execFileSync } from 'node:child_process';
import dgram from 'node:dgram';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { manifesto } from './tv-lg-manifesto.mjs';

const args = process.argv.slice(2);
const valor = (n, padrao) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : padrao; };
const URL_PLACAR = valor('--url', 'http://192.168.20.249:4050/tv');
const PASTA = valor('--chaves', 'C:\\KARTODROMO\\segredos\\lg-tv');
const PORTA_PLACAR = new URL(URL_PLACAR).port || '80';
const NO_PLACAR = new Set(['com.webos.app.home', 'com.webos.app.homeconnect', 'com.webos.app.browser', 'com.webos.app.discovery', '']);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const log = (m) => console.log(`${new Date().toLocaleString('pt-BR')} ${m}`);
const chaveDe = (ip) => { const f = join(PASTA, `${ip}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8'))['client-key'] : undefined; };

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

/** Uma TV: conexão SSAP aberta o tempo todo, com o estado de energia e o app na tela. */
class Tv {
  constructor(ip) {
    this.ip = ip;
    this.ws = null;
    this.conectando = false;
    this.vistaFora = false;     // ficou fora da rede depois que o vigia começou (ao voltar = acabou de ligar)
    this.energia = null;        // 'Active' | 'Active Standby' | 'Screen Off' | 'Suspend' | null (TV antiga sem esse dado)
    this.app = '';
    this.abrindoAte = 0;
    this.ultimoPedido = 0;
    this.serie = '';            // a mesma TV pode responder em 2 endereços (cabo + Wi-Fi): agrupa pelo número de série
    this.id = 0;
    this.respostas = new Map();
  }

  get ligada() { return !!this.ws && (this.energia === null || this.energia === 'Active'); }

  pedir(msg, ms = 5000) {
    return new Promise((ok) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return ok({ type: 'error', error: 'desconectada' });
      const i = `kib_${++this.id}`;
      const t = setTimeout(() => { this.respostas.delete(i); ok({ type: 'error', error: 'sem resposta' }); }, ms);
      this.respostas.set(i, (m) => { clearTimeout(t); this.respostas.delete(i); ok(m); });
      this.ws.send(JSON.stringify({ id: i, ...msg }));
    });
  }

  assinar(uri, aoMudar) {
    if (!this.ws) return;
    const i = `kib_s${++this.id}`;
    this.respostas.set(i, (m) => { if (m.type !== 'error') aoMudar(m.payload ?? {}); });
    this.ws.send(JSON.stringify({ id: i, type: 'subscribe', uri }));
  }

  async conectar() {
    if (this.ws || this.conectando) return;
    const pareada = !!chaveDe(this.ip);
    if (!pareada && Date.now() - this.ultimoPedido < 10 * 60_000) return;
    this.conectando = true;
    try {
      const abrir = (segura) => new Promise((ok, falha) => {
        const ws = segura ? new WebSocket(`wss://${this.ip}:3001`, { rejectUnauthorized: false, handshakeTimeout: 2500 }) : new WebSocket(`ws://${this.ip}:3000`, { handshakeTimeout: 2500 });
        ws.once('error', falha);
        ws.once('open', () => { ws.removeListener('error', falha); ok(ws); });
      });
      const ws = await abrir(true).catch(() => abrir(false));
      ws.on('error', () => {});
      ws.on('message', (d) => {
        let m; try { m = JSON.parse(String(d)); } catch { return; }
        if (m.payload?.pairingType === 'PROMPT') { log(`${this.ip}: pedindo permissão na tela da TV (apertar ACEITAR)`); return; }
        this.respostas.get(m.id)?.(m);
      });
      ws.on('close', () => this.caiu());
      this.ws = ws;
      if (!pareada) this.ultimoPedido = Date.now();
      const chave = chaveDe(this.ip);
      const reg = await this.pedir({ type: 'register', payload: { forcePairing: false, pairingType: 'PROMPT', 'client-key': chave, manifest: manifesto } }, 95_000);
      if (reg.type !== 'registered') { log(`${this.ip}: sem controle (${reg.error || reg.type})`); ws.terminate(); return; }
      if (reg.payload?.['client-key'] && reg.payload['client-key'] !== chave) {
        mkdirSync(PASTA, { recursive: true });
        writeFileSync(join(PASTA, `${this.ip}.json`), JSON.stringify({ 'client-key': reg.payload['client-key'], pareadoEm: new Date().toISOString() }, null, 2));
        log(`${this.ip}: pareada`);
      }
      this.serie = (await this.pedir({ type: 'request', uri: 'ssap://system/getSystemInfo' })).payload?.serialNumber ?? '';
      const voltou = this.vistaFora;
      this.vistaFora = false;
      const energia = await this.pedir({ type: 'request', uri: 'ssap://com.webos.service.tvpower/power/getPowerState' });
      this.energia = energia.type === 'error' ? null : energia.payload?.state ?? null;
      this.app = (await this.pedir({ type: 'request', uri: 'ssap://com.webos.applicationManager/getForegroundAppInfo' })).payload?.appId ?? '';
      log(`${this.ip}: conectada (energia ${this.energia ?? 'sem dado'}, na tela ${this.app || 'nada'})`);
      this.assinar('ssap://com.webos.service.tvpower/power/getPowerState', (p) => {
        const antes = this.energia;
        this.energia = p.state ?? this.energia;
        if (antes !== this.energia) log(`${this.ip}: energia ${antes ?? '?'} → ${this.energia}`);
        if (this.energia === 'Active' && antes && antes !== 'Active' && !p.processing) this.abrirPlacar('ligou');
      });
      // TV sem a permissão de energia: em espera ela fica sem app na tela; ao ligar, volta um app (canal, HDMI…)
      this.assinar('ssap://com.webos.applicationManager/getForegroundAppInfo', (p) => {
        if (p.appId === undefined) return;
        const antes = this.app;
        this.app = p.appId;
        if (antes !== this.app) log(`${this.ip}: na tela ${antes || 'nada'} → ${this.app || 'nada'}`);
        if (this.energia === null && !antes && this.app && this.app !== 'com.webos.app.browser') this.abrirPlacar('ligou');
      });
      if (voltou && this.ligada) this.abrirPlacar('ligou');
    } catch {
      this.vistaFora = true;   // não respondeu: desligada (ou fora da rede)
    } finally { this.conectando = false; }
  }

  caiu() {
    if (this.ws) log(`${this.ip}: desconectou (desligada?)`);
    this.ws = null; this.energia = null; this.vistaFora = true;
    for (const r of this.respostas.values()) r({ type: 'error', error: 'desconectada' });
    this.respostas.clear();
  }

  // abre o placar e confere; até 3 tentativas com 20 s para o navegador da TV carregar (reabrir antes disso
  // interrompia o carregamento). Não conseguiu: deixa a TV em paz por 10 min em vez de reabrir sem parar.
  async abrirPlacar(motivo) {
    if (Date.now() < this.abrindoAte || irmaAbrindo(this)) return;
    this.abrindoAte = Date.now() + 120_000;
    let conseguiu = false;
    try {
      await espera(motivo === 'ligou' ? 3000 : 0);
      for (let tentativa = 1; tentativa <= 3 && this.ligada; tentativa++) {
        const r = await this.pedir({ type: 'request', uri: 'ssap://system.launcher/open', payload: { target: URL_PLACAR } }, 10_000);
        for (let s = 0; s < 20 && !conseguiu; s++) { await espera(1000); conseguiu = noPlacarPorAlgumEndereco(this, conectadosNoPlacar()); }
        if (conseguiu) { log(`${this.ip}: placar na tela (${motivo}${tentativa > 1 ? `, tentativa ${tentativa}` : ''})`); return; }
        log(`${this.ip}: placar não carregou em 20 s (${r.payload?.errorText || r.error || `na tela ${this.app || 'nada'}`})${tentativa < 3 ? '; tentando de novo' : ''}`);
      }
      log(`${this.ip}: a TV abre o navegador mas não chega ao placar — alguém precisa olhar a tela dela; tento de novo em 10 min`);
    } finally { this.abrindoAte = Date.now() + (conseguiu ? 15_000 : 10 * 60_000); }
  }

  // checagem de manutenção: ligada, sem o placar e parada na tela inicial/navegador → abre
  async conferir(noPlacar) {
    if (!this.ligada || noPlacarPorAlgumEndereco(this, noPlacar) || Date.now() < this.abrindoAte) return;
    const r = await this.pedir({ type: 'request', uri: 'ssap://com.webos.applicationManager/getForegroundAppInfo' });
    if (r.type === 'error') { this.ws?.terminate(); return; }   // conexão morta sem aviso
    this.app = r.payload?.appId ?? '';
    if (NO_PLACAR.has(this.app)) this.abrirPlacar(`estava em ${this.app || 'nada'}`);
  }
}

const tvs = new Map();
/** A TV (por qualquer um dos endereços dela) está com o placar conectado? */
function noPlacarPorAlgumEndereco(tv, noPlacar) {
  return [...tvs.values()].some((t) => (t === tv || (tv.serie && t.serie === tv.serie)) && noPlacar.has(t.ip));
}
/** Outro endereço da mesma TV já está cuidando dela (abrindo o placar agora)? */
function irmaAbrindo(tv) {
  return [...tvs.values()].some((t) => t !== tv && tv.serie && t.serie === tv.serie && Date.now() < t.abrindoAte);
}
const tv = (ip) => { if (!tvs.has(ip)) tvs.set(ip, new Tv(ip)); return tvs.get(ip); };

if (args.includes('--uma-vez')) {
  const achadas = await procurarTvs();
  const noPlacar = conectadosNoPlacar();
  log(`TVs: ${[...achadas].map((ip) => `${ip}${noPlacar.has(ip) ? ' (no placar)' : ''}${chaveDe(ip) ? '' : ' (não pareada)'}`).join(', ') || 'nenhuma'}`);
  process.exit(0);
}

log(`vigia das TVs: placar ${URL_PLACAR}`);
// TVs já pareadas entram mesmo se estiverem desligadas agora (ao ligar, são vistas em segundos)
if (existsSync(PASTA)) for (const f of readdirSync(PASTA)) if (/^\d+\.\d+\.\d+\.\d+\.json$/.test(f)) tv(f.slice(0, -5));
for (const ip of await procurarTvs()) tv(ip);

let ciclo = 0;
for (;;) {
  try {
    if (ciclo % 10 === 0 && ciclo) for (const ip of await procurarTvs()) tv(ip);        // ~30 s: TVs novas
    await Promise.all([...tvs.values()].map((t) => t.conectar()));                    // 3 s: quem ligou
    if (ciclo % 20 === 0) { const noPlacar = conectadosNoPlacar(); await Promise.all([...tvs.values()].map((t) => t.conferir(noPlacar))); }  // ~60 s
  } catch (e) { log(`erro: ${e.message}`); }
  ciclo++;
  await espera(3000);
}

/**
 * Lado do ORBITS da ponte SMTP (ver services/smtp-ponte/worker.ts): um WebSocket para o Worker vira um stream que o
 * nodemailer usa como conexão TCP; o TLS com a HostGator continua sendo feito aqui (ponta a ponta).
 */
import { Duplex } from 'node:stream';

export const PONTE_SMTP_PADRAO = 'wss://kartodromo-smtp-ponte.kartodromo.workers.dev/smtp';

export function abrirPonte(url: string, timeoutMs = 15_000): Promise<Duplex> {
  return new Promise((ok, falha) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    let aberto = false;
    const pendentes: Buffer[] = [];
    let lendo = false;
    const stream = new Duplex({
      read() { lendo = true; while (lendo && pendentes.length) lendo = this.push(pendentes.shift()!); },
      write(chunk: Buffer, _enc, cb) { try { ws.send(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer); cb(); } catch (e) { cb(e as Error); } },
      final(cb) { try { ws.close(1000); } catch { /* já fechado */ } cb(); },
      destroy(err, cb) { try { ws.close(1000); } catch { /* já fechado */ } cb(err); },
    });
    const timer = setTimeout(() => { if (!aberto) { try { ws.close(); } catch { /* já fechado */ } falha(new Error('ponte SMTP não respondeu')); } }, timeoutMs);
    ws.addEventListener('open', () => { aberto = true; clearTimeout(timer); ok(stream); });
    ws.addEventListener('message', (ev) => {
      const b = Buffer.from(typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data as ArrayBuffer));
      if (lendo) lendo = stream.push(b); else pendentes.push(b);
    });
    ws.addEventListener('close', () => { clearTimeout(timer); if (!aberto) falha(new Error('ponte SMTP recusou a conexão')); else stream.push(null); });
    ws.addEventListener('error', () => { clearTimeout(timer); if (!aberto) falha(new Error('ponte SMTP inacessível')); else stream.destroy(new Error('ponte SMTP caiu')); });
  });
}

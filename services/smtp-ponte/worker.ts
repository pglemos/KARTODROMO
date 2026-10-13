/* eslint-disable @typescript-eslint/ban-ts-comment -- Worker do Cloudflare fora do tsc do projeto */
// @ts-nocheck -- Worker do Cloudflare: os tipos (WebSocketPair, cloudflare:sockets) são do wrangler, fora do tsc do projeto
/**
 * Ponte SMTP do kartódromo (06/10/2026). A saída de e-mail da HostGator (relay cloudfilter.net) descarta tudo que
 * vem do IP do kartódromo (187.108.255.6 está na PBL do Spamhaus e na Barracuda). O servidor da cronometragem abre
 * um WebSocket aqui e este Worker só repassa os bytes para o SMTP da HostGator na porta 465: o TLS é feito ponta a
 * ponta pelo ORBITS (o Worker não vê senha nem conteúdo). Destino fixo (só o SMTP do domínio, 465/587) — não serve de relay para mais nada.
 */
import { connect } from 'cloudflare:sockets';

const HOST = 'mail.kartodromodebetim.com.br';
const PORTAS = new Set([465, 587]);

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/smtp') return new Response('ponte SMTP do Kartódromo Internacional de Betim', { status: 404 });
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('use WebSocket', { status: 426 });

    const par = new WebSocketPair();
    const [cliente, ws] = [par[0], par[1]];
    ws.accept();
    const porta = Number(url.searchParams.get('porta') ?? 465);
    if (!PORTAS.has(porta)) return new Response('porta não permitida', { status: 400 });
    const tcp = connect({ hostname: HOST, port: porta }, { secureTransport: 'off' });
    const escritor = tcp.writable.getWriter();
    const fechar = () => { try { ws.close(1000, 'fim'); } catch { /* já fechado */ } try { tcp.close(); } catch { /* já fechado */ } };

    // em ordem: um Blob precisa ser lido (assíncrono) antes de escrever o pedaço seguinte
    let fila: Promise<void> = Promise.resolve();
    ws.addEventListener('message', (ev) => {
      fila = fila.then(async () => {
        const d = ev.data as unknown;
        const dados = typeof d === 'string' ? new TextEncoder().encode(d)
          : d instanceof ArrayBuffer ? new Uint8Array(d)
          : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength)
          : new Uint8Array(await (d as Blob).arrayBuffer());
        await escritor.write(dados);
      }).catch((e) => { try { ws.close(1011, ('escrita: ' + String(e?.message ?? e)).slice(0, 120)); } catch { /* já fechado */ } });
    });
    ws.addEventListener('close', fechar);
    tcp.opened.then((i) => { if (url.searchParams.has('diag')) ws.send('tcp aberto ' + JSON.stringify(i)); }).catch((e) => { try { ws.close(1011, ('tcp: ' + String(e?.message ?? e)).slice(0, 120)); } catch { /* já fechado */ } });
    ws.addEventListener('error', fechar);

    (async () => {
      const leitor = tcp.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          ws.send(value);
        }
      } catch (e) { try { ws.close(1011, ('leitura: ' + String((e as Error)?.message ?? e)).slice(0, 120)); } catch { /* já fechado */ } }
      fechar();
    })();

    return new Response(null, { status: 101, webSocket: cliente });
  },
};

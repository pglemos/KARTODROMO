/**
 * Recria o grupo de um pedido "cada um paga o seu" já pago e entrega os links ao site (que então manda o e-mail).
 * Uso no SRVKART, na pasta C:\kartodromo-servidor:
 *   node --import ./node_modules/tsx/dist/loader.mjs scripts/ops/reenviar-grupo-do-pedido.ts <CODIGO>
 *
 * Criado para a reserva BPQXHS (20/11/2026): o pagamento passou, o grupo não foi criado (defeito do literal boolean,
 * corrigido em lib/ops/grupos.ts) e o site não reenviava o pedido. Seguro de repetir: grupoDaReservaOnline reaproveita
 * o grupo que já existir para o pedido.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const codigo = String(process.argv[2] ?? '').trim().toUpperCase();
if (!/^[A-Z0-9]{6}$/.test(codigo)) {
  console.error('Informe o código da reserva online (6 letras/números).');
  process.exit(1);
}

const { one } = await import('../../lib/ops/db');
const { confirmarPagamento } = await import('../../lib/ops/reserva-online');

const r = await one<{ pedido: string; status: string; observacao: string | null }>(
  `select ro.pedido_id pedido, ro.status status,
          (select i.observacao from kart.inscricao i where i.id = split_part(ro.inscricao_ids, ',', 1)::int) observacao
     from kart.reserva_online ro where ro.codigo = @c`,
  { c: codigo },
);
if (!r) { console.error(`Reserva ${codigo} não encontrada.`); process.exit(1); }
if (r.status !== 'pago') { console.error(`Reserva ${codigo} está "${r.status}", não "pago".`); process.exit(1); }
if (!String(r.observacao ?? '').includes('cada um paga o seu')) { console.error(`Reserva ${codigo} não é "cada um paga o seu".`); process.exit(1); }

const log = (...a: unknown[]) => console.log(...a);
const resultado = await confirmarPagamento(
  { id: r.pedido, codigo, status: 'confirmado', modo: 'individual', compradorPilota: true } as never,
  log,
);
console.log('resultado:', JSON.stringify(resultado));
if (resultado.acao !== 'confirmado' || !('grupo' in resultado) || !resultado.grupo) {
  console.error('O grupo não foi criado; nada enviado ao site.');
  process.exit(2);
}
const url = (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
const resp = await fetch(`${url}/api/sync/pedido`, {
  method: 'POST',
  headers: { 'x-sync-key': process.env.PRECADASTRO_KEY || '', 'content-type': 'application/json' },
  body: JSON.stringify([resultado]),
  signal: AbortSignal.timeout(20_000),
});
console.log('site:', resp.status, (await resp.text()).slice(0, 200));
process.exit(resp.ok ? 0 : 3);

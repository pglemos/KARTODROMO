/**
 * Teste de fumaça do servidor da operação já no ar (só leitura): chama as rotas GET principais do /api/office
 * com uma sessão de administrador e confere status 200 e corpo JSON. Usado no corte para o Postgres e depois de deploys.
 * Uso (na pasta do servidor): npx tsx scripts/ops/fumaca-ops.ts [http://localhost:4060]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] ||= m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const { emiteToken } = await import('../../lib/ops/auth');
const { one, getPool } = await import('../../lib/ops/db');

const BASE = process.argv[2] || `http://localhost:${process.env.OPS_PORT || 4060}`;
const adm = await one<{ id: number; nome: string }>(`select id, nome from kart.usuario where admin = true and ativo = true order by id limit 1`);
if (!adm) throw new Error('nenhum administrador ativo');
const token = emiteToken({ uid: adm.id, nome: adm.nome, admin: true });
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const rotas = [
  '/agenda?mes=' + hoje.slice(0, 7), '/baterias?data=' + hoje, '/reservas?data=' + hoje, '/caixa', '/clientes?q=silva', '/empresa',
  '/fidelidade/contas', '/grupos?de=' + hoje + '&ate=' + hoje, '/manutencoes', '/minhas-permissoes', '/movimentos', '/parametros',
  '/parceiros', '/parceiros/comissoes', '/permissoes?perfilId=1', '/pilotos?q=silva', '/pilotos/ranking', '/reservas-online',
  '/servicos-online', '/vendas?data=' + hoje, '/vouchers', '/vouchers/uso',
];
let falhas = 0;
const saude = await fetch(`${BASE}/healthz`).then((r) => r.status).catch(() => 0);
console.log(`${saude === 200 ? 'ok ' : 'ERR'} /healthz ${saude}`);
if (saude !== 200) falhas++;
for (const r of rotas) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/api/office${r}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
    const txt = await res.text();
    let tam = '';
    try { const j = JSON.parse(txt); tam = Array.isArray(j) ? `${j.length} itens` : `${Object.keys(j).length} chaves`; } catch { tam = 'não-JSON'; }
    const ok = res.status === 200 && tam !== 'não-JSON';
    if (!ok) falhas++;
    console.log(`${ok ? 'ok ' : 'ERR'} ${r} ${res.status} ${tam} ${Date.now() - t0}ms${ok ? '' : ' ' + txt.slice(0, 200)}`);
  } catch (e) {
    falhas++;
    console.log(`ERR ${r} ${(e as Error).message}`);
  }
}
console.log(falhas ? `FALHAS: ${falhas}` : 'FUMACA OK');
await getPool().end();
process.exit(falhas ? 1 : 0);

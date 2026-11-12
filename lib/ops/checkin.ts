/**
 * Check-in pelo celular (reservas.kartodromodebetim.com.br › Minhas reservas). O site valida GPS, horário e pagamento e
 * guarda o pedido; aqui as vagas da reserva ganham Inscricao.CheckinEm e o termo de cada piloto entra na fila de
 * impressão da Recepção (o mesmo caminho do totem), para estar impresso quando ele chegar ao balcão.
 */
import { query } from './db';

type Log = (...args: unknown[]) => void;
type Checkin = { key: string; pedidoId: string; codigo?: string; em?: string };

const url = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
const chave = () => process.env.PRECADASTRO_KEY || '';

async function site(caminho: string, init: RequestInit = {}) {
  const r = await fetch(url() + caminho, { ...init, headers: { 'x-sync-key': chave(), 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`check-in ${caminho}: HTTP ${r.status}`);
  return r.json() as Promise<{ checkins?: Checkin[] }>;
}

/** Aplica os check-ins pendentes. `imprimirTermo` recebe cada inscrição que ainda não tem termo impresso. */
export async function aplicarCheckins(log: Log, imprimirTermo: (inscricaoId: number) => void) {
  if (!url() || !chave()) return 0;
  const { checkins = [] } = await site('/api/sync/checkins');
  const feitos: { key: string; erro: string | null }[] = [];
  for (const c of checkins) {
    try {
      const [r] = await query<{ ids: string }>(`SELECT InscricaoIds ids FROM dbo.ReservaOnline WHERE PedidoId = @p AND Status = 'pago'`, { p: c.pedidoId });
      if (!r) { feitos.push({ key: c.key, erro: 'reserva não encontrada ou não paga' }); continue; }
      const ids = String(r.ids).split(',').map(Number).filter((n) => n > 0);
      if (!ids.length) { feitos.push({ key: c.key, erro: 'reserva sem vagas' }); continue; }
      const lista = ids.join(',');
      const vagas = await query<{ id: number; termo: string | null }>(
        `UPDATE dbo.Inscricao SET CheckinEm = COALESCE(CheckinEm, SYSDATETIME()), CheckinOrigem = COALESCE(CheckinOrigem, 'celular'), AtualizadoEm = SYSDATETIME()
         OUTPUT inserted.Id id, CONVERT(varchar(19), inserted.TermoImpressoEm, 126) termo
         WHERE Id IN (${lista}) AND Status <> 'cancelada'`,
      );
      for (const v of vagas) if (!v.termo) imprimirTermo(Number(v.id));
      log(`check-in pelo celular: reserva ${c.codigo ?? c.pedidoId} (${vagas.length} vaga(s), ${vagas.filter((v) => !v.termo).length} termo(s) na fila)`);
      feitos.push({ key: c.key, erro: null });
    } catch (e) { log(`check-in ${c.codigo ?? c.pedidoId}: erro ${(e as Error).message}`); }
  }
  if (feitos.length) await site('/api/sync/checkins', { method: 'POST', body: JSON.stringify({ feitos }) });
  return feitos.length;
}

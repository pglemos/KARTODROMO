// Contrato com o worker kartodromo-cadastro (rotas /api/agenda, /api/reservas, /api/reservas/:id, /api/reservas/politica, /api/aviso).

export type Horario = { id: number; inicio: string; nome: string; livres: number; precoCentavos: number; precoPrimeiraVezCentavos?: number };
export type Agenda = { atualizadoEm: string; precoCentavos: number; maxPilotos: number; prazoMin: number; antecedenciaMin: number; horarios: Horario[]; pagamentoOnline: boolean };
export type Politica = { versao: string; titulo: string; aceite: string; secoes: { titulo: string; paragrafos?: string[]; subsecoes?: { titulo: string; paragrafos: string[] }[] }[] };
export type Aviso = { texto: string; tom?: 'info' | 'alerta' } | null;
export type StatusPedido = 'novo' | 'aguardando_pagamento' | 'pago' | 'confirmado' | 'recusado' | 'expirado' | 'pago_sem_vaga' | 'erro_pagamento' | 'nao_encontrada';
export type Pedido = {
  id: string; codigo: string; status: StatusPedido; forma: 'pix' | 'cartao'; quantidade: number; nome: string;
  descricao: string | null; inicio: string | null; valorCentavos: number | null; expiraEm: string | null;
  pix: { payload: string; imagem: string } | null; invoiceUrl: string | null; preparandoPagamento: boolean; erro: string | null;
};
export type MinhaReserva = { id: string; codigo: string; status: StatusPedido; criadoEm: string; quantidade: number; forma: string; inicio: string | null; descricao: string | null; valorCentavos: number | null; checkinEm?: string | null };
export type Corrida = { sessionId: string; eventName: string; eventDate: string; position: number; kart: string; laps: number; bestLapMs: number | null };
export const FINAIS = new Set<StatusPedido>(['confirmado', 'recusado', 'expirado', 'pago_sem_vaga', 'erro_pagamento', 'nao_encontrada']);
export const ID_PEDIDO = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export class ErroApi extends Error {
  constructor(msg: string, public status = 0) { super(msg); }
}

async function chamar<T>(caminho: string, init?: RequestInit, tempoMs = 20000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), tempoMs);
  let r: Response;
  try {
    r = await fetch(caminho, { ...init, signal: ctl.signal, cache: 'no-store' });
  } catch (e) {
    throw new ErroApi((e as Error).name === 'AbortError' ? 'O servidor demorou para responder. Confira a conexão e tente de novo.' : 'Sem conexão com o servidor. Confira a internet e tente de novo.');
  } finally { clearTimeout(t); }
  let corpo: unknown = null;
  try { corpo = await r.json(); } catch { /* resposta sem JSON */ }
  if (!r.ok) {
    const erro = (corpo as { erro?: string } | null)?.erro;
    throw new ErroApi(erro || (r.status >= 500 ? 'O servidor está com instabilidade. Tente de novo em instantes.' : 'Não foi possível concluir agora.'), r.status);
  }
  return corpo as T;
}

export const api = {
  agenda: () => chamar<Agenda>('/api/agenda'),
  politica: () => chamar<Politica>('/api/reservas/politica'),
  aviso: async (): Promise<Aviso> => { try { const a = await chamar<Aviso>('/api/aviso', undefined, 5000); return a && a.texto ? a : null; } catch { return null; } },
  criar: (corpo: unknown) => chamar<{ id: string; codigo: string }>('/api/reservas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }, 30000),
  pedido: (id: string) => chamar<Pedido>(`/api/reservas/${id}`),
  corridas: (cpf: string, codigo: string) => chamar<{ corridas: Corrida[]; aviso?: string }>('/api/reservas/corridas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cpf, codigo }) }),
  checkin: (corpo: { cpf: string; codigo: string; pedidoId: string; lat: number; lng: number; precisao: number }) =>
    chamar<{ ok: boolean; checkinEm: string }>('/api/reservas/checkin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }),
  minhas: (cpf: string, codigo: string) => chamar<{ nome: string; reservas: MinhaReserva[] }>('/api/reservas/minhas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cpf, codigo }) }),
  cupom: (corpo: { codigo: string; bateriaId: number; quantidade: number; documento: string; documentos: string[] }) =>
    chamar<{ requestId: string }>('/api/reservas/cupom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }),
  cupomResultado: (id: string) => chamar<{ status: 'pending' | 'completed'; erro?: string; brutoCentavos?: number; descontoCentavos?: number; totalCentavos?: number }>(`/api/reservas/cupom/${id}`),
};

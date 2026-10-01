/**
 * Reserva online (reservas.kartodromodebetim.com.br) — lado do servidor da operação (SRVKART).
 * Mesmo caminho do pré-cadastro: o site guarda os pedidos na Cloudflare e este servidor busca pelo /api/sync
 * (nada daqui fica exposto na internet).
 *   1. a cada 30 s publica a agenda (baterias abertas, vagas e preço) para o site mostrar;
 *   2. a cada 5 s busca pedidos novos: grava o cliente (como o pré-cadastro), segura as vagas (Inscricao Origem 'site',
 *      status 'reservada') por 15 min e devolve o valor — o site então cobra na Asaas (Pix ou cartão);
 *   3. pedido pago no site: marca as vagas como pagas (Pago=1, 'confirmada');
 *   4. sem pagamento depois do prazo: cancela as vagas e avisa o site (que cancela a cobrança).
 * Env: PRECADASTRO_URL/PRECADASTRO_KEY (os mesmos do pré-cadastro); OPS_ONLINE_PRODUTO (4 = ANTECIPADO),
 * OPS_ONLINE_PRODUTOS_BATERIA (baterias vendidas online: 11,4), OPS_ONLINE_ANTECEDENCIA_MIN, OPS_ONLINE_MAX, OPS_ONLINE_PRAZO_MIN.
 */
import { one, query, tx } from './db';
import { inscreverN } from './office';
import { gravarPreCadastro, preCadastroLigado, type PreCadastro } from './pre-cadastro';

type Log = (...args: unknown[]) => void;

export const configOnline = () => {
  const e = process.env;
  return {
    produtoVenda: Number(e.OPS_ONLINE_PRODUTO || 4),
    produtosBateria: String(e.OPS_ONLINE_PRODUTOS_BATERIA || '11,4').split(',').map(Number).filter((n) => n > 0),
    antecedenciaMin: Number(e.OPS_ONLINE_ANTECEDENCIA_MIN || 120),
    maxPilotos: Number(e.OPS_ONLINE_MAX || 10),
    prazoMin: Number(e.OPS_ONLINE_PRAZO_MIN || 15),
    diasAgenda: Number(e.OPS_ONLINE_DIAS || 90),
  };
};

const url = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
async function chamar(caminho: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const r = await fetch(url() + caminho, {
    ...init,
    headers: { 'x-sync-key': process.env.PRECADASTRO_KEY || '', 'content-type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`reserva online ${caminho}: HTTP ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- agenda

export type HorarioOnline = { id: number; inicio: string; nome: string; livres: number };

/** Baterias à venda no site: abertas, que aparecem no totem, do produto de locação, com antecedência e vaga. */
export async function agendaOnline() {
  const c = configOnline();
  const produto = await one<{ preco: number | null; nome: string }>(`SELECT PrecoCentavos preco, Nome nome FROM dbo.Produto WHERE Id = @id`, { id: c.produtoVenda });
  const linhas = await query<{ id: number; inicio: string; nome: string; vagas: number; ocupadas: number }>(
    `SELECT b.Id id, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Nome nome, b.Vagas vagas,
            (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas
       FROM dbo.Bateria b
      WHERE b.Status = 'aberta' AND b.ReservaFechada = 0 AND b.AutoAtendimento = 1
        AND b.ProdutoId IN (${c.produtosBateria.map((n) => Number(n)).join(',') || '0'})
        AND b.Inicio > DATEADD(minute, @antes, SYSDATETIME()) AND b.Inicio < DATEADD(day, @dias, SYSDATETIME())
      ORDER BY b.Inicio`,
    { antes: c.antecedenciaMin, dias: c.diasAgenda },
  );
  const horarios: HorarioOnline[] = linhas.map((l) => ({ id: l.id, inicio: l.inicio, nome: l.nome, livres: Math.max(0, l.vagas - l.ocupadas) }));
  return {
    atualizadoEm: new Date().toISOString(),
    precoCentavos: produto?.preco ?? 0,
    maxPilotos: c.maxPilotos,
    prazoMin: c.prazoMin,
    antecedenciaMin: c.antecedenciaMin,
    horarios,
  };
}

export async function publicarAgenda() {
  const agenda = await agendaOnline();
  await chamar('/api/sync/agenda', { method: 'PUT', body: JSON.stringify(agenda) });
  return agenda.horarios.length;
}

// ---------------------------------------------------------------- pedidos

export type PedidoSite = {
  id: string;
  codigo: string;
  status: 'novo' | 'pago';
  criadoEm: string;
  bateriaId: number;
  quantidade: number;
  forma: 'pix' | 'cartao';
  pilotos: string[];
  cliente: Omit<PreCadastro, 'key' | 'chave' | 'recebidoEm'> & { chave: string };
  pagamento?: { asaasId: string; billingType: string; pagoEm: string; valorCentavos: number };
};

type Resultado =
  | { id: string; acao: 'reservado'; valorCentavos: number; expiraEm: string; descricao: string; inicio: string }
  | { id: string; acao: 'recusado'; erro: string }
  | { id: string; acao: 'confirmado'; codigo: string }
  | { id: string; acao: 'expirado' }
  | { id: string; acao: 'pago_sem_vaga'; erro: string };

type Linha = { Id: number; Status: string; InscricaoIds: string; ValorCentavos: number; expira: string; BateriaId: number; Quantidade: number; ClienteId: number; Codigo: string };
const LINHA = `SELECT *, CONVERT(varchar(19), ExpiraEm, 126) expira FROM dbo.ReservaOnline`;
/** O banco grava no horário de Brasília (SYSDATETIME); o site recebe com o fuso explícito. */
const brasilia = (local: string) => `-03:00`;

const ids = (s: string) => s.split(',').map(Number).filter((n) => n > 0);

/** Texto curto do pedido (vai na cobrança da Asaas e na tela de confirmação). */
export function descricaoPedido(nomeBateria: string, inicio: string, quantidade: number) {
  const [d, h] = inicio.split('T');
  const [a, m, dia] = d.split('-');
  return `Kartódromo de Betim · ${nomeBateria} · ${dia}/${m}/${a} ${h.slice(0, 5)} · ${quantidade} ${quantidade === 1 ? 'piloto' : 'pilotos'}`;
}

/** Pedido novo: grava o cliente e segura as vagas. Idempotente pelo id do pedido (o site pode mandar de novo). */
export async function reservarPedido(p: PedidoSite, log: Log): Promise<Resultado> {
  const c = configOnline();
  const ja = await one<Linha>(`${LINHA} WHERE PedidoId = @id`, { id: p.id });
  if (ja) {
    if (ja.Status === 'aguardando') {
      const b = await one<{ nome: string; inicio: string }>(`SELECT Nome nome, CONVERT(varchar(16), Inicio, 126) inicio FROM dbo.Bateria WHERE Id = @id`, { id: ja.BateriaId });
      return { id: p.id, acao: 'reservado', valorCentavos: ja.ValorCentavos, expiraEm: brasilia(ja.expira), descricao: descricaoPedido(b?.nome ?? '', b?.inicio ?? 'T', ja.Quantidade), inicio: b?.inicio ?? '' };
    }
    if (ja.Status === 'pago') return { id: p.id, acao: 'confirmado', codigo: ja.Codigo };
    return { id: p.id, acao: 'expirado' };
  }
  const n = Math.trunc(Number(p.quantidade));
  if (!(n >= 1 && n <= c.maxPilotos)) return { id: p.id, acao: 'recusado', erro: `Escolha de 1 a ${c.maxPilotos} pilotos.` };
  const bat = await one<{ nome: string; inicio: string; ok: number }>(
    `SELECT b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio,
            CASE WHEN b.Status = 'aberta' AND b.ReservaFechada = 0 AND b.AutoAtendimento = 1
                  AND b.ProdutoId IN (${c.produtosBateria.map((x) => Number(x)).join(',') || '0'})
                  AND b.Inicio > DATEADD(minute, @antes, SYSDATETIME()) THEN 1 ELSE 0 END ok
       FROM dbo.Bateria b WHERE b.Id = @id`,
    { id: Number(p.bateriaId), antes: c.antecedenciaMin - 10 },
  );
  if (!bat || !bat.ok) return { id: p.id, acao: 'recusado', erro: 'Esse horário não está mais disponível. Escolha outro.' };
  const produto = await one<{ preco: number | null }>(`SELECT PrecoCentavos preco FROM dbo.Produto WHERE Id = @id`, { id: c.produtoVenda });
  const preco = produto?.preco ?? 0;
  if (preco <= 0) return { id: p.id, acao: 'recusado', erro: 'Reserva online indisponível no momento. Fale com a recepção pelo WhatsApp.' };

  const cliente: PreCadastro = { ...p.cliente, key: '', recebidoEm: p.criadoEm, menores: p.cliente.menores ?? [] } as PreCadastro;
  const clienteId = await gravarPreCadastro(cliente, log);
  const obs = `Reserva online ${p.codigo}` + (p.pilotos?.length ? ` · pilotos: ${p.pilotos.join(', ')}`.slice(0, 380) : '');
  let inscricoes: number[];
  try {
    inscricoes = await inscreverN(Number(p.bateriaId), clienteId, n, 'site', null, obs, true, { produtoId: c.produtoVenda });
  } catch (e) {
    return { id: p.id, acao: 'recusado', erro: (e as Error).message };
  }
  const nova = await one<{ expira: string }>(
    `INSERT INTO dbo.ReservaOnline (PedidoId, Codigo, ClienteId, BateriaId, Quantidade, ValorCentavos, Status, Forma, InscricaoIds, Pilotos, ExpiraEm)
     OUTPUT CONVERT(varchar(19), inserted.ExpiraEm, 126) expira
     VALUES (@pedido, @codigo, @cliente, @bateria, @n, @valor, 'aguardando', @forma, @insc, @pilotos, DATEADD(minute, @prazo, SYSDATETIME()))`,
    { pedido: p.id, codigo: p.codigo, cliente: clienteId, bateria: Number(p.bateriaId), n, valor: preco * n, forma: p.forma, insc: inscricoes.join(','), pilotos: (p.pilotos ?? []).join(', ').slice(0, 600) || null, prazo: c.prazoMin },
  );
  const expiraEm = brasilia(nova!.expira);
  log(`reserva online ${p.codigo}: ${n} vaga(s) seguradas na bateria ${p.bateriaId} para o cliente ${clienteId} até ${nova!.expira.slice(11, 16)}`);
  return { id: p.id, acao: 'reservado', valorCentavos: preco * n, expiraEm, descricao: descricaoPedido(bat.nome, bat.inicio, n), inicio: bat.inicio };
}

/** Pagamento confirmado no site: vagas pagas. Se o prazo já tinha vencido, tenta segurar de novo; sem vaga, fica para devolver. */
export async function confirmarPagamento(p: PedidoSite, log: Log): Promise<Resultado> {
  const r = await one<Linha>(`${LINHA} WHERE PedidoId = @id`, { id: p.id });
  if (!r) return { id: p.id, acao: 'pago_sem_vaga', erro: 'Pedido não encontrado no sistema da recepção.' };
  if (r.Status === 'pago') return { id: p.id, acao: 'confirmado', codigo: r.Codigo };
  const forma = p.pagamento?.billingType === 'PIX' ? 'pix' : 'cartao';
  let insc = ids(r.InscricaoIds);
  const ativas = await query<{ Id: number }>(`SELECT Id FROM dbo.Inscricao WHERE Id IN (${insc.join(',') || '0'}) AND Status <> 'cancelada'`);
  if (ativas.length < insc.length) {
    // pagou depois do prazo: as vagas foram liberadas — segura de novo se ainda houver
    try {
      const novas = await inscreverN(r.BateriaId, r.ClienteId, r.Quantidade - ativas.length, 'site', null, `Reserva online ${r.Codigo} (paga após o prazo)`, true, { produtoId: configOnline().produtoVenda });
      insc = [...ativas.map((a) => a.Id), ...novas];
    } catch (e) {
      await query(`UPDATE dbo.ReservaOnline SET Status = 'pago_sem_vaga', AsaasPagamentoId = @asaas, PagoEm = SYSDATETIME(), Forma = @forma WHERE Id = @id`, { id: r.Id, asaas: p.pagamento?.asaasId ?? null, forma });
      log(`reserva online ${r.Codigo}: PAGO SEM VAGA (${(e as Error).message}) — devolver ou reagendar`);
      return { id: p.id, acao: 'pago_sem_vaga', erro: 'Recebemos o pagamento, mas as vagas desse horário acabaram. A recepção vai entrar em contato para trocar o horário ou devolver o valor.' };
    }
  }
  const unit = Math.round(r.ValorCentavos / Math.max(1, r.Quantidade));
  await tx(async (run) => {
    await run(`UPDATE dbo.Inscricao SET Pago = 1, ValorCentavos = @unit, Status = 'confirmada', Aprovada = 1, AtualizadoEm = SYSDATETIME() WHERE Id IN (${insc.join(',')})`, { unit });
    await run(`UPDATE dbo.ReservaOnline SET Status = 'pago', InscricaoIds = @insc, AsaasPagamentoId = @asaas, PagoEm = SYSDATETIME(), Forma = @forma WHERE Id = @id`, { id: r.Id, insc: insc.join(','), asaas: p.pagamento?.asaasId ?? null, forma });
  });
  log(`reserva online ${r.Codigo}: paga (${forma}), ${insc.length} vaga(s) confirmadas`);
  return { id: p.id, acao: 'confirmado', codigo: r.Codigo };
}

/** Prazo vencido sem pagamento (com 2 min de folga para o aviso da Asaas chegar): cancela as vagas. */
export async function expirarVencidos(log: Log) {
  const vencidos = await query<Linha & { PedidoId: string }>(`${LINHA} WHERE Status = 'aguardando' AND ExpiraEm < DATEADD(minute, -2, SYSDATETIME())`);
  const res: Resultado[] = [];
  for (const v of vencidos) {
    await tx(async (run) => {
      await run(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id IN (${ids(v.InscricaoIds).join(',') || '0'}) AND Pago = 0 AND Status <> 'cancelada'`);
      await run(`UPDATE dbo.ReservaOnline SET Status = 'expirado' WHERE Id = @id AND Status = 'aguardando'`, { id: v.Id });
    });
    log(`reserva online ${v.Codigo}: sem pagamento no prazo, vagas liberadas`);
    res.push({ id: v.PedidoId, acao: 'expirado' });
  }
  return res;
}

/** Ciclo de 5 s: pedidos novos, pagos e vencidos. */
export async function sincronizarReservasOnline(log: Log) {
  if (!preCadastroLigado()) return 0;
  const pedidos = (await chamar('/api/sync/pedidos')) as PedidoSite[];
  const resultados: Resultado[] = [];
  for (const p of pedidos) {
    try {
      resultados.push(p.status === 'pago' ? await confirmarPagamento(p, log) : await reservarPedido(p, log));
    } catch (e) {
      log(`reserva online ${p.codigo}: erro ${(e as Error).message}`);
    }
  }
  resultados.push(...(await expirarVencidos(log)));
  if (resultados.length) await chamar('/api/sync/pedido', { method: 'POST', body: JSON.stringify(resultados) });
  return resultados.length;
}

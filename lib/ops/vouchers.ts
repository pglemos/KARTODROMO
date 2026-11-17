/**
 * Regras compartilhadas de vouchers: limite total (UsoMaxTotal), esgotamento automático e
 * lista de pessoas/grupos autorizados (kart.voucher_cliente).
 * Usado pela Recepção (lib/ops/office.ts), Reserva Online / Grupos (lib/ops/reserva-online.ts)
 * e Totem (services/ops-server.ts).
 */
import { one, onlyDigits, query, tx } from './db';

type Reader = (text: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;

let schemaPronto = false;

export function resetarCacheSchemaVouchers() {
  schemaPronto = false;
}

/** Garante de forma idempotente as colunas e a tabela de beneficiários do módulo de vouchers. */
export async function garantirSchemaVouchers(): Promise<void> {
  // No Postgres o schema (kart.voucher.uso_max_total/restrito_clientes, kart.voucher_cliente, kart.inscricao.voucher_id)
  // vem das migrations do Kartódromo OS (supabase/kartodromo/migrations); nada a criar em tempo de execução.
  schemaPronto = true;
}

export function normalizarDocVoucher(v: unknown): string | null {
  const raw = String(v ?? '').trim();
  if (!raw) return null;
  if (!/[a-zA-Z]/.test(raw)) {
    const d = onlyDigits(raw);
    return d ? d.slice(0, 30) : null;
  }
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, 30);
}

export type BeneficiarioInput = {
  id?: number | null;
  clienteId?: number | null;
  nome: string;
  documento?: string | null;
  telefone?: string | null;
  usosMax?: number;
  observacao?: string | null;
};

export type BeneficiarioRow = {
  id: number;
  voucherId: number;
  clienteId: number | null;
  nome: string;
  documento: string | null;
  telefone: string | null;
  usosMax: number;
  observacao: string | null;
  usosFeitos: number;
  restantes: number;
  esgotado: boolean;
  ultimoUsoEm: string | null;
};

export type VoucherStatusResumo = {
  limiteTotal: number | null;
  restantes: number | null;
  esgotado: boolean;
  expirado: boolean;
  status: 'ativo' | 'esgotado' | 'expirado' | 'inativo';
};

/**
 * Calcula limite total efetivo, saldo restante e situação (esgotado/expirado/inativo/ativo).
 * Usado na listagem, nos detalhes e na validação do caixa/site/totem.
 */
export function resumirStatusVoucher(v: {
  ativo: boolean | number;
  usoUnico: boolean | number;
  usoMaxTotal?: number | null;
  restritoClientes?: boolean | number;
  usos: number;
  fim: string;
  hoje: string;
  beneficiarios?: Array<{ usosMax: number; usosFeitos: number }>;
  somaCotasBeneficiarios?: number | null;
  restantesBeneficiarios?: number | null;
  totalBeneficiarios?: number | null;
}): VoucherStatusResumo {
  const usos = Math.max(0, Number(v.usos || 0));
  const bens = v.beneficiarios;
  const totalBens = bens ? bens.length : Math.max(0, Number(v.totalBeneficiarios ?? 0));
  const somaCotas = bens
    ? bens.reduce((s, b) => s + Math.max(1, Number(b.usosMax || 1)), 0)
    : Number(v.somaCotasBeneficiarios ?? 0);
  const restantesBens = bens
    ? bens.reduce((s, b) => s + Math.max(0, Math.max(1, Number(b.usosMax || 1)) - Math.max(0, Number(b.usosFeitos || 0))), 0)
    : Number(v.restantesBeneficiarios ?? 0);

  let limiteTotal: number | null = null;
  if (v.usoUnico) limiteTotal = 1;
  else if (v.usoMaxTotal != null && Number(v.usoMaxTotal) > 0) limiteTotal = Number(v.usoMaxTotal);
  else if (v.restritoClientes && totalBens > 0 && somaCotas > 0) limiteTotal = somaCotas;

  const restantes = limiteTotal !== null ? Math.max(0, limiteTotal - usos) : null;
  const esgotadoPorTotal = limiteTotal !== null && usos >= limiteTotal;
  const esgotadoPorBens = Boolean(v.restritoClientes) && totalBens > 0 && restantesBens <= 0;
  const esgotado = esgotadoPorTotal || esgotadoPorBens;
  const expirado = Boolean(v.fim && v.hoje) && String(v.fim).slice(0, 10) < String(v.hoje).slice(0, 10);
  const ativo = Boolean(v.ativo);
  const status: VoucherStatusResumo['status'] = !ativo ? 'inativo' : esgotado ? 'esgotado' : expirado ? 'expirado' : 'ativo';
  return { limiteTotal, restantes, esgotado, expirado, status };
}

/** Normaliza e remove duplicados da lista de pessoas enviada pelo frontend/recepção. */
export function normalizarBeneficiariosInput(raw: unknown): BeneficiarioInput[] {
  if (!Array.isArray(raw)) return [];
  const out: BeneficiarioInput[] = [];
  const vistos = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const clienteId = o.clienteId != null && Number(o.clienteId) > 0 ? Math.trunc(Number(o.clienteId)) : null;
    const documento = normalizarDocVoucher(o.documento);
    const nomeBruto = String(o.nome ?? '').trim().slice(0, 200);
    const telefone = o.telefone != null && String(o.telefone).trim() ? String(o.telefone).trim().slice(0, 40) : null;
    const observacao = o.observacao != null && String(o.observacao).trim() ? String(o.observacao).trim().slice(0, 250) : null;
    const usosMax = Number(o.usosMax) >= 1 && Number.isFinite(Number(o.usosMax)) ? Math.min(999, Math.trunc(Number(o.usosMax))) : 1;
    if (!clienteId && !nomeBruto && !documento) continue;
    const chave = clienteId ? `c:${clienteId}` : documento ? `d:${documento}` : `n:${nomeBruto.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({
      id: o.id != null && Number(o.id) > 0 ? Math.trunc(Number(o.id)) : null,
      clienteId,
      nome: nomeBruto || (documento ? `CPF ${documento}` : 'Cliente'),
      documento,
      telefone,
      usosMax,
      observacao,
    });
  }
  return out;
}

const BENEFICIARIOS_SQL = `
  select vc.id, vc.voucher_id "voucherId", vc.cliente_id "clienteId",
         coalesce(nullif(trim(c.nome), ''), vc.nome) nome,
         coalesce(nullif(vc.documento, ''), nullif(c.documento_num, ''), replace(replace(replace(c.documento, '.', ''), '-', ''), '/', '')) documento,
         coalesce(nullif(trim(vc.telefone), ''), nullif(trim(c.telefone), '')) telefone,
         vc.usos_max "usosMax", vc.observacao,
         to_char(vc.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm",
         (
           (select count(*) from kart.voucher_uso u left join kart.cliente uc on uc.id = u.cliente_id
             where u.voucher_id = vc.voucher_id and not u.estornado
               and ((vc.cliente_id is not null and u.cliente_id = vc.cliente_id)
                 or (nullif(vc.documento, '') is not null and (uc.documento_num = vc.documento or replace(replace(replace(uc.documento, '.', ''), '-', ''), '/', '') = vc.documento))))
           + (select count(*) from kart.reserva_online_voucher_uso o left join kart.cliente oc on oc.id = o.cliente_id
             where o.voucher_id = vc.voucher_id and o.estado in ('reservado', 'consumido', 'reembolso_pendente')
               and ((vc.cliente_id is not null and o.cliente_id = vc.cliente_id)
                 or (nullif(vc.documento, '') is not null and (oc.documento_num = vc.documento or replace(replace(replace(oc.documento, '.', ''), '-', ''), '/', '') = vc.documento))))
           + (select count(*) from kart.reserva_grupo_voucher_uso gv left join kart.cliente gc on gc.id = gv.cliente_id
             where gv.voucher_id = vc.voucher_id and gv.estado in ('reservado', 'consumido')
               and ((vc.cliente_id is not null and gv.cliente_id = vc.cliente_id)
                 or (nullif(vc.documento, '') is not null and (gc.documento_num = vc.documento or replace(replace(replace(gc.documento, '.', ''), '-', ''), '/', '') = vc.documento))))
         ) "usosFeitos",
         (select to_char(max(dt), 'YYYY-MM-DD"T"HH24:MI') from (
            select max(u.criado_em) dt from kart.voucher_uso u left join kart.cliente uc on uc.id = u.cliente_id
              where u.voucher_id = vc.voucher_id and not u.estornado
                and ((vc.cliente_id is not null and u.cliente_id = vc.cliente_id)
                  or (nullif(vc.documento, '') is not null and (uc.documento_num = vc.documento or replace(replace(replace(uc.documento, '.', ''), '-', ''), '/', '') = vc.documento)))
            union all
            select max(o.criado_em) dt from kart.reserva_online_voucher_uso o left join kart.cliente oc on oc.id = o.cliente_id
              where o.voucher_id = vc.voucher_id and o.estado in ('reservado', 'consumido', 'reembolso_pendente')
                and ((vc.cliente_id is not null and o.cliente_id = vc.cliente_id)
                  or (nullif(vc.documento, '') is not null and (oc.documento_num = vc.documento or replace(replace(replace(oc.documento, '.', ''), '-', ''), '/', '') = vc.documento)))
            union all
            select max(gv.criado_em) dt from kart.reserva_grupo_voucher_uso gv left join kart.cliente gc on gc.id = gv.cliente_id
              where gv.voucher_id = vc.voucher_id and gv.estado in ('reservado', 'consumido')
                and ((vc.cliente_id is not null and gv.cliente_id = vc.cliente_id)
                  or (nullif(vc.documento, '') is not null and (gc.documento_num = vc.documento or replace(replace(replace(gc.documento, '.', ''), '-', ''), '/', '') = vc.documento)))
         ) d) "ultimoUsoEm"
  from kart.voucher_cliente vc
  left join kart.cliente c on c.id = vc.cliente_id
  where vc.voucher_id = @voucherId
  order by vc.nome, vc.id
`;

export async function listarBeneficiariosVoucher(voucherId: number, reader?: Reader): Promise<BeneficiarioRow[]> {
  const exec = reader ?? query;
  const rows = await exec(BENEFICIARIOS_SQL, { voucherId });
  return rows.map((r) => {
    const usosMax = Math.max(1, Number(r.usosMax ?? 1));
    const usosFeitos = Math.max(0, Number(r.usosFeitos ?? 0));
    return {
      id: Number(r.id),
      voucherId: Number(r.voucherId ?? voucherId),
      clienteId: r.clienteId == null ? null : Number(r.clienteId),
      nome: String(r.nome ?? ''),
      documento: r.documento ? String(r.documento) : null,
      telefone: r.telefone ? String(r.telefone) : null,
      usosMax,
      observacao: r.observacao ? String(r.observacao) : null,
      usosFeitos,
      restantes: Math.max(0, usosMax - usosFeitos),
      esgotado: usosFeitos >= usosMax,
      ultimoUsoEm: r.ultimoUsoEm ? String(r.ultimoUsoEm) : null,
    };
  });
}

/** Grava/mescla beneficiários do voucher resolvendo ClienteId por CPF quando já existir cadastro. */
export async function sincronizarBeneficiariosVoucher(
  voucherId: number,
  lista: BeneficiarioInput[],
  mode: 'replace' | 'merge',
  reader?: Reader,
): Promise<{ total: number }> {
  const executar = async (run: Reader) => {
    if (mode === 'replace') {
      await run(`delete from kart.voucher_cliente where voucher_id = @vid`, { vid: voucherId });
    }
    const existentes = mode === 'merge'
      ? await run(`select id, cliente_id "clienteId", documento from kart.voucher_cliente where voucher_id = @vid`, { vid: voucherId })
      : [];

    for (const item of lista) {
      let clienteId = item.clienteId ?? null;
      let nome = item.nome;
      let documento = item.documento ?? null;
      let telefone = item.telefone ?? null;

      if (clienteId) {
        const [cli] = await run(`select id "Id", nome "Nome", documento_num "DocumentoNum", documento "Documento", telefone "Telefone" from kart.cliente where id = @cid`, { cid: clienteId });
        if (cli) {
          nome = nome || String(cli.Nome ?? '');
          documento = documento ?? normalizarDocVoucher(cli.DocumentoNum ?? cli.Documento);
          telefone = telefone ?? (cli.Telefone ? String(cli.Telefone) : null);
        } else {
          clienteId = null;
        }
      } else if (documento) {
        const [cli] = await run(
          `select id "Id", nome "Nome", documento_num "DocumentoNum", documento "Documento", telefone "Telefone"
           from kart.cliente
           where (documento_num = @doc or replace(replace(replace(documento, '.', ''), '-', ''), '/', '') = @doc)
             and responsavel_id is null
           order by atualizado_em desc limit 1`,
          { doc: documento },
        );
        if (cli) {
          clienteId = Number(cli.Id);
          if (!nome || nome.startsWith('CPF ')) nome = String(cli.Nome ?? nome);
          telefone = telefone ?? (cli.Telefone ? String(cli.Telefone) : null);
        }
      }

      const dup = existentes.find((e) =>
        (clienteId && Number(e.clienteId) === clienteId)
        || (documento && e.documento && String(e.documento) === documento),
      );
      if (dup) {
        await run(
          `update kart.voucher_cliente
           set cliente_id = coalesce(cliente_id, @cid::int),
               nome = @nome,
               documento = coalesce(@doc, documento),
               telefone = coalesce(@tel, telefone),
               usos_max = @usosMax,
               observacao = coalesce(@obs, observacao)
           where id = @id`,
          { id: dup.id, cid: clienteId, nome: nome.slice(0, 200), doc: documento, tel: telefone, usosMax: item.usosMax ?? 1, obs: item.observacao ?? null },
        );
      } else {
        await run(
          `insert into kart.voucher_cliente (voucher_id, cliente_id, nome, documento, telefone, usos_max, observacao)
           values (@vid, @cid, @nome, @doc, @tel, @usosMax, @obs)`,
          { vid: voucherId, cid: clienteId, nome: nome.slice(0, 200), doc: documento, tel: telefone, usosMax: item.usosMax ?? 1, obs: item.observacao ?? null },
        );
      }
    }
    const [cnt] = await run(`select count(*) n from kart.voucher_cliente where voucher_id = @vid`, { vid: voucherId });
    return { total: Number(cnt?.n ?? 0) };
  };
  return reader ? executar(reader) : tx(executar);
}

export type ElegibilidadeResult =
  | { ok: true; matchedVcId?: number; autoLinkClienteId?: number | null; beneficiarioNome?: string | null; restantesPessoa?: number | null }
  | { ok: false; motivo: string; esgotado?: boolean; exigeIdentificacao?: boolean };

/**
 * Avalia limite total do voucher (UsoUnico / UsoMaxTotal) e elegibilidade nominal/grupo (kart.voucher_cliente).
 * Pode rodar dentro de transação (run) ou fora (one/query).
 */
export async function avaliarElegibilidadeVoucher(opts: {
  voucherId: number;
  usoUnico: boolean | number;
  usoMaxTotal?: number | null;
  usoMaxCliente: number;
  restritoClientes?: boolean | number;
  usosTotais: number;
  usosClienteDirecto: number;
  clienteId?: number | null;
  documento?: string | null;
  reader?: Reader;
}): Promise<ElegibilidadeResult> {
  const { voucherId, usoUnico, usoMaxTotal, usoMaxCliente, restritoClientes, usosTotais, usosClienteDirecto, clienteId } = opts;
  const docNorm = normalizarDocVoucher(opts.documento);

  if (usoUnico && usosTotais > 0) {
    return { ok: false, motivo: 'Voucher já utilizado (esgotado).', esgotado: true };
  }
  if (usoMaxTotal != null && Number(usoMaxTotal) > 0 && usosTotais >= Number(usoMaxTotal)) {
    return { ok: false, motivo: 'Este voucher já atingiu o limite máximo de utilizações (esgotado).', esgotado: true };
  }

  if (restritoClientes) {
    const bens = await listarBeneficiariosVoucher(voucherId, opts.reader);
    if (!bens.length) {
      return { ok: false, motivo: 'Este voucher é nominal e ainda não possui pessoas autorizadas na lista.' };
    }
    const totalRestanteBens = bens.reduce((s, b) => s + b.restantes, 0);
    if (totalRestanteBens <= 0) {
      return { ok: false, motivo: 'Voucher esgotado (todas as pessoas cadastradas já utilizaram).', esgotado: true };
    }
    if (!clienteId && !docNorm) {
      return { ok: false, exigeIdentificacao: true, motivo: 'Este voucher é nominal. Selecione ou informe o cliente/CPF antes de aplicar.' };
    }
    const matched = bens.find((b) =>
      (clienteId && b.clienteId === Number(clienteId))
      || (docNorm && b.documento && b.documento === docNorm),
    );
    if (!matched) {
      return { ok: false, motivo: 'Este voucher é nominal e não está liberado para este CPF/cliente.' };
    }
    const limitePessoa = Math.max(1, matched.usosMax || Number(usoMaxCliente || 1));
    const usosPessoa = Math.max(matched.usosFeitos, Number(usosClienteDirecto || 0));
    if (usosPessoa >= limitePessoa) {
      return { ok: false, motivo: `${matched.nome} já utilizou o máximo permitido (${limitePessoa} uso${limitePessoa > 1 ? 's' : ''}) deste voucher.`, esgotado: true };
    }
    const saldoGlobal = usoMaxTotal != null && Number(usoMaxTotal) > 0 ? Math.max(0, Number(usoMaxTotal) - usosTotais) : null;
    const restantesEfetivos = saldoGlobal != null
      ? Math.min(Math.max(0, limitePessoa - usosPessoa), saldoGlobal)
      : Math.max(0, limitePessoa - usosPessoa);
    return {
      ok: true,
      matchedVcId: matched.id,
      autoLinkClienteId: !matched.clienteId && clienteId ? Number(clienteId) : null,
      beneficiarioNome: matched.nome,
      restantesPessoa: restantesEfetivos,
    };
  }

  if ((clienteId || docNorm) && usosClienteDirecto >= Math.max(1, Number(usoMaxCliente ?? 1))) {
    return { ok: false, motivo: 'Limite de usos deste voucher para este cliente já atingido.' };
  }
  return { ok: true };
}

export type VoucherClienteDisponivel = {
  id: number;
  codigo: string;
  origem: string;
  referencia: string | null;
  tipo: string;
  valor: number;
  produtoId: number | null;
  produto: string | null;
  descontoMaximo: number | null;
  pedidoMinimo: number | null;
  usosFeitos: number;
  usosMax: number;
  restantesPessoa: number;
  restantesTotal: number | null;
  beneficiarioNome: string | null;
};

/** Lista vouchers nominais/fidelidade ativos e ainda com saldo para um cliente ou CPF (Caixa Recepção e Totem). */
export async function vouchersDisponiveisParaCliente(params: {
  clienteId?: number | null;
  documento?: string | null;
  produtoId?: number | null;
}): Promise<VoucherClienteDisponivel[]> {
  await garantirSchemaVouchers();
  const clienteId = params.clienteId && Number(params.clienteId) > 0 ? Number(params.clienteId) : null;
  let docNorm = normalizarDocVoucher(params.documento);
  if (!docNorm && clienteId) {
    const cli = await one<{ doc: string | null; docNum: string | null }>(
      `select documento doc, documento_num "docNum" from kart.cliente where id = @id`,
      { id: clienteId },
    );
    docNorm = normalizarDocVoucher(cli?.docNum ?? cli?.doc);
  }
  if (!clienteId && !docNorm) return [];

  const rows = await query<{
    id: number; codigo: string; origem: string; referencia: string | null; tipo: string; valor: number;
    produtoId: number | null; produto: string | null; descontoMaximo: number | null; pedidoMinimo: number | null;
    usoUnico: boolean | number; usoMaxTotal: number | null; usoMaxCliente: number; restritoClientes: boolean | number;
    usosTotais: number; vcId: number | null; vcUsosMax: number | null; vcNome: string | null; vcClienteId: number | null; vcDoc: string | null;
  }>(
    `select v.id, v.codigo, v.origem, v.referencia, v.tipo, v.valor,
            v.produto_id "produtoId", p.nome produto, v.desconto_maximo_centavos "descontoMaximo", v.pedido_minimo_centavos "pedidoMinimo",
            v.uso_unico "usoUnico", v.uso_max_total "usoMaxTotal", v.uso_max_cliente "usoMaxCliente", v.restrito_clientes "restritoClientes",
            (
              (select count(*) from kart.voucher_uso u where u.voucher_id = v.id and not u.estornado)
              + (select count(*) from kart.reserva_online_voucher_uso o where o.voucher_id = v.id and o.estado in ('reservado', 'consumido', 'reembolso_pendente'))
              + (select count(*) from kart.reserva_grupo_voucher_uso gv where gv.voucher_id = v.id and gv.estado in ('reservado', 'consumido'))
            ) "usosTotais",
            vc.id "vcId", vc.usos_max "vcUsosMax", vc.nome "vcNome", vc.cliente_id "vcClienteId", vc.documento "vcDoc"
     from kart.voucher v
     left join kart.produto p on p.id = v.produto_id
     left join kart.parceiro pr on pr.id = v.parceiro_id
     left join kart.fidelidade_conta fc on fc.id = v.fidelidade_conta_id
     left join lateral (
       select x.id, x.usos_max, x.nome, x.cliente_id, x.documento
       from kart.voucher_cliente x
       where x.voucher_id = v.id
         and ((@cid::int is not null and x.cliente_id = @cid::int)
           or (@doc::text is not null and x.documento = @doc::text))
       order by x.id limit 1
     ) vc on true
     where v.ativo
       and current_date between v.inicio_em and v.fim_em
       and (v.parceiro_id is null or pr.ativo)
       and (v.fidelidade_conta_id is null or fc.ativo)
       and (vc.id is not null or (@cid::int is not null and fc.cliente_id = @cid::int))
     order by v.id desc`,
    { cid: clienteId, doc: docNorm },
  );

  const out: VoucherClienteDisponivel[] = [];
  for (const r of rows) {
    if (params.produtoId && r.produtoId && Number(r.produtoId) !== Number(params.produtoId)) continue;
    const limiteTotal = r.usoUnico ? 1 : (r.usoMaxTotal != null && Number(r.usoMaxTotal) > 0 ? Number(r.usoMaxTotal) : null);
    const usosTotais = Number(r.usosTotais ?? 0);
    if (limiteTotal !== null && usosTotais >= limiteTotal) continue;

    // Usos desta pessoa especificamente (por ClienteId ou Documento)
    const docEfetivo = normalizarDocVoucher(r.vcDoc ?? docNorm);
    const usosPessoaRow = await one<{ n: number }>(
      `select
        (select count(*) from kart.voucher_uso u left join kart.cliente uc on uc.id = u.cliente_id
          where u.voucher_id = @vid and not u.estornado
            and ((@cid::int is not null and u.cliente_id = @cid::int)
              or (@doc::text is not null and (uc.documento_num = @doc::text or replace(replace(replace(uc.documento, '.', ''), '-', ''), '/', '') = @doc::text))))
        + (select count(*) from kart.reserva_online_voucher_uso o left join kart.cliente oc on oc.id = o.cliente_id
          where o.voucher_id = @vid and o.estado in ('reservado', 'consumido', 'reembolso_pendente')
            and ((@cid::int is not null and o.cliente_id = @cid::int)
              or (@doc::text is not null and (oc.documento_num = @doc::text or replace(replace(replace(oc.documento, '.', ''), '-', ''), '/', '') = @doc::text))))
        + (select count(*) from kart.reserva_grupo_voucher_uso gv left join kart.cliente gc on gc.id = gv.cliente_id
          where gv.voucher_id = @vid and gv.estado in ('reservado', 'consumido')
            and ((@cid::int is not null and gv.cliente_id = @cid::int)
              or (@doc::text is not null and (gc.documento_num = @doc::text or replace(replace(replace(gc.documento, '.', ''), '-', ''), '/', '') = @doc::text)))) n`,
      { vid: r.id, cid: clienteId ?? r.vcClienteId ?? null, doc: docEfetivo },
    );
    const usosFeitos = Number(usosPessoaRow?.n ?? 0);
    const usosMax = Math.max(1, Number(r.vcUsosMax ?? r.usoMaxCliente ?? 1));
    if (usosFeitos >= usosMax) continue;

    const saldoGlobal = limiteTotal !== null ? Math.max(0, limiteTotal - usosTotais) : null;
    const restantesPessoa = saldoGlobal !== null
      ? Math.min(Math.max(0, usosMax - usosFeitos), saldoGlobal)
      : Math.max(0, usosMax - usosFeitos);
    if (restantesPessoa <= 0) continue;

    out.push({
      id: Number(r.id),
      codigo: String(r.codigo),
      origem: String(r.origem),
      referencia: r.referencia ? String(r.referencia) : null,
      tipo: String(r.tipo),
      valor: Number(r.valor),
      produtoId: r.produtoId == null ? null : Number(r.produtoId),
      produto: r.produto ? String(r.produto) : null,
      descontoMaximo: r.descontoMaximo == null ? null : Number(r.descontoMaximo),
      pedidoMinimo: r.pedidoMinimo == null ? null : Number(r.pedidoMinimo),
      usosFeitos,
      usosMax,
      restantesPessoa: Math.max(0, usosMax - usosFeitos),
      restantesTotal: limiteTotal !== null ? Math.max(0, limiteTotal - usosTotais) : null,
      beneficiarioNome: r.vcNome ? String(r.vcNome) : null,
    });
  }
  return out;
}

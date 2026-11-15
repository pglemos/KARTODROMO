/**
 * Regras compartilhadas de vouchers: limite total (UsoMaxTotal), esgotamento automático e
 * lista de pessoas/grupos autorizados (dbo.VoucherCliente).
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
  if (schemaPronto) return;
  await query(`
    IF COL_LENGTH('dbo.Voucher', 'UsoMaxTotal') IS NULL
      ALTER TABLE dbo.Voucher ADD UsoMaxTotal INT NULL;
    IF COL_LENGTH('dbo.Voucher', 'RestritoClientes') IS NULL
      ALTER TABLE dbo.Voucher ADD RestritoClientes BIT NOT NULL CONSTRAINT DF_Voucher_RestritoClientes DEFAULT 0;
    IF OBJECT_ID('dbo.VoucherCliente') IS NULL
    BEGIN
      CREATE TABLE dbo.VoucherCliente (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VoucherId INT NOT NULL REFERENCES dbo.Voucher(Id) ON DELETE CASCADE,
        ClienteId INT NULL REFERENCES dbo.Cliente(Id),
        Nome NVARCHAR(200) NOT NULL,
        Documento VARCHAR(30) NULL,
        Telefone NVARCHAR(40) NULL,
        UsosMax INT NOT NULL DEFAULT 1 CHECK (UsosMax >= 1),
        Observacao NVARCHAR(250) NULL,
        CriadoEm DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
      );
      CREATE INDEX IX_VoucherCliente_Voucher ON dbo.VoucherCliente (VoucherId);
      CREATE INDEX IX_VoucherCliente_Cliente ON dbo.VoucherCliente (ClienteId) WHERE ClienteId IS NOT NULL;
      CREATE INDEX IX_VoucherCliente_Documento ON dbo.VoucherCliente (Documento) WHERE Documento IS NOT NULL;
    END;
    IF COL_LENGTH('dbo.Inscricao', 'VoucherId') IS NULL
      ALTER TABLE dbo.Inscricao ADD VoucherId INT NULL REFERENCES dbo.Voucher(Id);
  `);
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
  SELECT vc.Id id, vc.VoucherId voucherId, vc.ClienteId clienteId,
         COALESCE(NULLIF(LTRIM(RTRIM(c.Nome)), N''), vc.Nome) nome,
         COALESCE(NULLIF(vc.Documento, ''), NULLIF(c.DocumentoNum, ''), REPLACE(REPLACE(REPLACE(c.Documento, '.', ''), '-', ''), '/', '')) documento,
         COALESCE(NULLIF(LTRIM(RTRIM(vc.Telefone)), N''), NULLIF(LTRIM(RTRIM(c.Telefone)), N'')) telefone,
         vc.UsosMax usosMax, vc.Observacao observacao,
         CONVERT(varchar(16), vc.CriadoEm, 126) criadoEm,
         (
           (SELECT COUNT(*) FROM dbo.VoucherUso u LEFT JOIN dbo.Cliente uc ON uc.Id = u.ClienteId
             WHERE u.VoucherId = vc.VoucherId AND u.Estornado = 0
               AND ((vc.ClienteId IS NOT NULL AND u.ClienteId = vc.ClienteId)
                 OR (NULLIF(vc.Documento, '') IS NOT NULL AND (uc.DocumentoNum = vc.Documento OR REPLACE(REPLACE(REPLACE(uc.Documento, '.', ''), '-', ''), '/', '') = vc.Documento))))
           + (SELECT COUNT(*) FROM dbo.ReservaOnlineVoucherUso o LEFT JOIN dbo.Cliente oc ON oc.Id = o.ClienteId
             WHERE o.VoucherId = vc.VoucherId AND o.Estado IN ('reservado', 'consumido', 'reembolso_pendente')
               AND ((vc.ClienteId IS NOT NULL AND o.ClienteId = vc.ClienteId)
                 OR (NULLIF(vc.Documento, '') IS NOT NULL AND (oc.DocumentoNum = vc.Documento OR REPLACE(REPLACE(REPLACE(oc.Documento, '.', ''), '-', ''), '/', '') = vc.Documento))))
           + (SELECT COUNT(*) FROM dbo.ReservaGrupoVoucherUso gv LEFT JOIN dbo.Cliente gc ON gc.Id = gv.ClienteId
             WHERE gv.VoucherId = vc.VoucherId AND gv.Estado IN ('reservado', 'consumido')
               AND ((vc.ClienteId IS NOT NULL AND gv.ClienteId = vc.ClienteId)
                 OR (NULLIF(vc.Documento, '') IS NOT NULL AND (gc.DocumentoNum = vc.Documento OR REPLACE(REPLACE(REPLACE(gc.Documento, '.', ''), '-', ''), '/', '') = vc.Documento))))
         ) usosFeitos,
         (SELECT CONVERT(varchar(16), MAX(dt), 126) FROM (
            SELECT MAX(u.CriadoEm) dt FROM dbo.VoucherUso u LEFT JOIN dbo.Cliente uc ON uc.Id = u.ClienteId
              WHERE u.VoucherId = vc.VoucherId AND u.Estornado = 0
                AND ((vc.ClienteId IS NOT NULL AND u.ClienteId = vc.ClienteId)
                  OR (NULLIF(vc.Documento, '') IS NOT NULL AND (uc.DocumentoNum = vc.Documento OR REPLACE(REPLACE(REPLACE(uc.Documento, '.', ''), '-', ''), '/', '') = vc.Documento)))
            UNION ALL
            SELECT MAX(o.CriadoEm) dt FROM dbo.ReservaOnlineVoucherUso o LEFT JOIN dbo.Cliente oc ON oc.Id = o.ClienteId
              WHERE o.VoucherId = vc.VoucherId AND o.Estado IN ('reservado', 'consumido', 'reembolso_pendente')
                AND ((vc.ClienteId IS NOT NULL AND o.ClienteId = vc.ClienteId)
                  OR (NULLIF(vc.Documento, '') IS NOT NULL AND (oc.DocumentoNum = vc.Documento OR REPLACE(REPLACE(REPLACE(oc.Documento, '.', ''), '-', ''), '/', '') = vc.Documento)))
            UNION ALL
            SELECT MAX(gv.CriadoEm) dt FROM dbo.ReservaGrupoVoucherUso gv LEFT JOIN dbo.Cliente gc ON gc.Id = gv.ClienteId
              WHERE gv.VoucherId = vc.VoucherId AND gv.Estado IN ('reservado', 'consumido')
                AND ((vc.ClienteId IS NOT NULL AND gv.ClienteId = vc.ClienteId)
                  OR (NULLIF(vc.Documento, '') IS NOT NULL AND (gc.DocumentoNum = vc.Documento OR REPLACE(REPLACE(REPLACE(gc.Documento, '.', ''), '-', ''), '/', '') = vc.Documento)))
         ) d) ultimoUsoEm
  FROM dbo.VoucherCliente vc
  LEFT JOIN dbo.Cliente c ON c.Id = vc.ClienteId
  WHERE vc.VoucherId = @voucherId
  ORDER BY vc.Nome, vc.Id
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
      await run(`DELETE FROM dbo.VoucherCliente WHERE VoucherId = @vid`, { vid: voucherId });
    }
    const existentes = mode === 'merge'
      ? await run(`SELECT Id id, ClienteId clienteId, Documento documento FROM dbo.VoucherCliente WHERE VoucherId = @vid`, { vid: voucherId })
      : [];

    for (const item of lista) {
      let clienteId = item.clienteId ?? null;
      let nome = item.nome;
      let documento = item.documento ?? null;
      let telefone = item.telefone ?? null;

      if (clienteId) {
        const [cli] = await run(`SELECT Id, Nome, DocumentoNum, Documento, Telefone FROM dbo.Cliente WHERE Id = @cid`, { cid: clienteId });
        if (cli) {
          nome = nome || String(cli.Nome ?? '');
          documento = documento ?? normalizarDocVoucher(cli.DocumentoNum ?? cli.Documento);
          telefone = telefone ?? (cli.Telefone ? String(cli.Telefone) : null);
        } else {
          clienteId = null;
        }
      } else if (documento) {
        const [cli] = await run(
          `SELECT TOP 1 Id, Nome, DocumentoNum, Documento, Telefone
           FROM dbo.Cliente
           WHERE (DocumentoNum = @doc OR REPLACE(REPLACE(REPLACE(Documento, '.', ''), '-', ''), '/', '') = @doc)
             AND ResponsavelId IS NULL
           ORDER BY AtualizadoEm DESC`,
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
          `UPDATE dbo.VoucherCliente
           SET ClienteId = COALESCE(ClienteId, @cid),
               Nome = @nome,
               Documento = COALESCE(@doc, Documento),
               Telefone = COALESCE(@tel, Telefone),
               UsosMax = @usosMax,
               Observacao = COALESCE(@obs, Observacao)
           WHERE Id = @id`,
          { id: dup.id, cid: clienteId, nome: nome.slice(0, 200), doc: documento, tel: telefone, usosMax: item.usosMax ?? 1, obs: item.observacao ?? null },
        );
      } else {
        await run(
          `INSERT INTO dbo.VoucherCliente (VoucherId, ClienteId, Nome, Documento, Telefone, UsosMax, Observacao)
           VALUES (@vid, @cid, @nome, @doc, @tel, @usosMax, @obs)`,
          { vid: voucherId, cid: clienteId, nome: nome.slice(0, 200), doc: documento, tel: telefone, usosMax: item.usosMax ?? 1, obs: item.observacao ?? null },
        );
      }
    }
    const [cnt] = await run(`SELECT COUNT(*) n FROM dbo.VoucherCliente WHERE VoucherId = @vid`, { vid: voucherId });
    return { total: Number(cnt?.n ?? 0) };
  };
  return reader ? executar(reader) : tx(executar);
}

export type ElegibilidadeResult =
  | { ok: true; matchedVcId?: number; autoLinkClienteId?: number | null; beneficiarioNome?: string | null; restantesPessoa?: number | null }
  | { ok: false; motivo: string; esgotado?: boolean; exigeIdentificacao?: boolean };

/**
 * Avalia limite total do voucher (UsoUnico / UsoMaxTotal) e elegibilidade nominal/grupo (dbo.VoucherCliente).
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
    return {
      ok: true,
      matchedVcId: matched.id,
      autoLinkClienteId: !matched.clienteId && clienteId ? Number(clienteId) : null,
      beneficiarioNome: matched.nome,
      restantesPessoa: Math.max(0, limitePessoa - usosPessoa),
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
      `SELECT Documento doc, DocumentoNum docNum FROM dbo.Cliente WHERE Id = @id`,
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
    `SELECT v.Id id, v.Codigo codigo, v.Origem origem, v.Referencia referencia, v.Tipo tipo, v.Valor valor,
            v.ProdutoId produtoId, p.Nome produto, v.DescontoMaximoCentavos descontoMaximo, v.PedidoMinimoCentavos pedidoMinimo,
            v.UsoUnico usoUnico, v.UsoMaxTotal usoMaxTotal, v.UsoMaxCliente usoMaxCliente, v.RestritoClientes restritoClientes,
            (
              (SELECT COUNT(*) FROM dbo.VoucherUso u WHERE u.VoucherId = v.Id AND u.Estornado = 0)
              + (SELECT COUNT(*) FROM dbo.ReservaOnlineVoucherUso o WHERE o.VoucherId = v.Id AND o.Estado IN ('reservado', 'consumido', 'reembolso_pendente'))
              + (SELECT COUNT(*) FROM dbo.ReservaGrupoVoucherUso gv WHERE gv.VoucherId = v.Id AND gv.Estado IN ('reservado', 'consumido'))
            ) usosTotais,
            vc.Id vcId, vc.UsosMax vcUsosMax, vc.Nome vcNome, vc.ClienteId vcClienteId, vc.Documento vcDoc
     FROM dbo.Voucher v
     LEFT JOIN dbo.Produto p ON p.Id = v.ProdutoId
     LEFT JOIN dbo.Parceiro pr ON pr.Id = v.ParceiroId
     LEFT JOIN dbo.FidelidadeConta fc ON fc.Id = v.FidelidadeContaId
     OUTER APPLY (
       SELECT TOP 1 x.Id, x.UsosMax, x.Nome, x.ClienteId, x.Documento
       FROM dbo.VoucherCliente x
       WHERE x.VoucherId = v.Id
         AND ((@cid IS NOT NULL AND x.ClienteId = @cid)
           OR (@doc IS NOT NULL AND x.Documento = @doc))
       ORDER BY x.Id
     ) vc
     WHERE v.Ativo = 1
       AND CAST(SYSDATETIME() AS date) BETWEEN v.InicioEm AND v.FimEm
       AND (v.ParceiroId IS NULL OR pr.Ativo = 1)
       AND (v.FidelidadeContaId IS NULL OR fc.Ativo = 1)
       AND (vc.Id IS NOT NULL OR (@cid IS NOT NULL AND fc.ClienteId = @cid))
     ORDER BY v.Id DESC`,
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
      `SELECT
        (SELECT COUNT(*) FROM dbo.VoucherUso u LEFT JOIN dbo.Cliente uc ON uc.Id = u.ClienteId
          WHERE u.VoucherId = @vid AND u.Estornado = 0
            AND ((@cid IS NOT NULL AND u.ClienteId = @cid)
              OR (@doc IS NOT NULL AND (uc.DocumentoNum = @doc OR REPLACE(REPLACE(REPLACE(uc.Documento, '.', ''), '-', ''), '/', '') = @doc))))
        + (SELECT COUNT(*) FROM dbo.ReservaOnlineVoucherUso o LEFT JOIN dbo.Cliente oc ON oc.Id = o.ClienteId
          WHERE o.VoucherId = @vid AND o.Estado IN ('reservado', 'consumido', 'reembolso_pendente')
            AND ((@cid IS NOT NULL AND o.ClienteId = @cid)
              OR (@doc IS NOT NULL AND (oc.DocumentoNum = @doc OR REPLACE(REPLACE(REPLACE(oc.Documento, '.', ''), '-', ''), '/', '') = @doc))))
        + (SELECT COUNT(*) FROM dbo.ReservaGrupoVoucherUso gv LEFT JOIN dbo.Cliente gc ON gc.Id = gv.ClienteId
          WHERE gv.VoucherId = @vid AND gv.Estado IN ('reservado', 'consumido')
            AND ((@cid IS NOT NULL AND gv.ClienteId = @cid)
              OR (@doc IS NOT NULL AND (gc.DocumentoNum = @doc OR REPLACE(REPLACE(REPLACE(gc.Documento, '.', ''), '-', ''), '/', '') = @doc)))) n`,
      { vid: r.id, cid: clienteId ?? r.vcClienteId ?? null, doc: docEfetivo },
    );
    const usosFeitos = Number(usosPessoaRow?.n ?? 0);
    const usosMax = Math.max(1, Number(r.vcUsosMax ?? r.usoMaxCliente ?? 1));
    if (usosFeitos >= usosMax) continue;

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

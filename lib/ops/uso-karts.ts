import { createHash } from 'node:crypto';
import { one, tx } from './db';
import { HttpError } from './office';

export interface UsoKartsItem {
  kart?: unknown;
  minutos?: unknown;
}

export interface UsoKartsPayload {
  sessaoId?: unknown;
  agendaId?: unknown;
  karts?: UsoKartsItem[];
}

export interface UsoKartsResult {
  ok: boolean;
  categoria: string | null;
  somados: number;
  criados: number;
  ignorados: number;
  jaAplicado: boolean;
}

const sessionLocks = new Map<string, Promise<void>>();

async function acquireLock(sessaoId: string): Promise<() => void> {
  while (sessionLocks.has(sessaoId)) {
    try {
      await sessionLocks.get(sessaoId);
    } catch {
      // Ignora erro anterior para não travar a fila
    }
  }
  let release: () => void = () => {};
  const p = new Promise<void>((resolve) => {
    release = resolve;
  });
  sessionLocks.set(sessaoId, p);
  return () => {
    sessionLocks.delete(sessaoId);
    release();
  };
}

/**
 * Registra o uso dos karts de uma sessão de cronometragem de forma transacional e idempotente.
 * Retentativas com o mesmo payload retornam jaAplicado=true sem somar novamente.
 * Mudanças no payload para uma mesma sessão já aplicada lançam HTTP 409 (conflito).
 */
export async function registrarUsoKarts(payload: UsoKartsPayload): Promise<UsoKartsResult> {
  const sessaoId = typeof payload.sessaoId === 'string' ? payload.sessaoId.trim() : '';
  if (!sessaoId) {
    throw new HttpError(400, 'sessaoId obrigatório');
  }

  const release = await acquireLock(sessaoId);
  try {
    return await executarRegistrarUsoKarts(sessaoId, payload);
  } finally {
    release();
  }
}

async function executarRegistrarUsoKarts(sessaoId: string, payload: UsoKartsPayload): Promise<UsoKartsResult> {
  const agendaId = Number(payload.agendaId);
  const cat = agendaId > 0
    ? (await one<{ c: string | null }>(
        `SELECT p.Categoria c FROM dbo.Bateria b JOIN dbo.Produto p ON p.Id = b.ProdutoId WHERE b.Id = @id`,
        { id: agendaId }
      ))?.c ?? null
    : null;

  const kartsRaw = Array.isArray(payload.karts) ? payload.karts : [];
  type KartValidado = { numero: number; minutos: number };
  const validos: KartValidado[] = [];
  let ignorados = 0;

  for (const k of kartsRaw) {
    const numero = Number(String(k.kart ?? '').trim());
    const minutos = Math.round(Number(k.minutos));
    if (!Number.isSafeInteger(numero) || numero <= 0 || !(minutos > 0) || minutos > 600) {
      ignorados++;
    } else {
      validos.push({ numero, minutos });
    }
  }

  const sortedKartsStr = validos
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((k) => `${k.numero}:${k.minutos}`)
    .join(';');

  const payloadHash = createHash('sha256')
    .update(`${sessaoId}|${agendaId || ''}|${cat || ''}|${sortedKartsStr}`)
    .digest('hex');

  return await tx(async (run) => {
    // 1. Verifica se a sessão já foi processada
    const existentes = (await run(
      `SELECT Id id, Categoria categoria, Kart kart, Minutos minutos, PayloadHash payloadHash
       FROM dbo.CronoUsoKarts WHERE SessaoId = @sessaoId`,
      { sessaoId }
    )) as { id: number; categoria: string; kart: string; minutos: number; payloadHash: string }[];

    if (existentes.length > 0) {
      const hashGravado = existentes[0].payloadHash;
      if (hashGravado === payloadHash) {
        return {
          ok: true,
          jaAplicado: true,
          categoria: cat,
          somados: 0,
          criados: 0,
          ignorados,
        };
      }
      throw new HttpError(409, 'Sessão já processada com payload diferente');
    }

    let somados = 0;
    let criados = 0;

    // 2. Se não houver karts válidos, registra marcador vazio da sessão
    if (validos.length === 0) {
      await run(
        `INSERT INTO dbo.CronoUsoKarts (SessaoId, AgendaId, Categoria, Kart, Minutos, PayloadHash, CriadoEm)
         VALUES (@sessaoId, @agendaId, @categoria, '__VAZIO__', 0, @payloadHash, SYSDATETIME())`,
        {
          sessaoId,
          agendaId: agendaId > 0 ? agendaId : null,
          categoria: cat ?? '',
          payloadHash,
        }
      );
      return {
        ok: true,
        jaAplicado: false,
        categoria: cat,
        somados: 0,
        criados: 0,
        ignorados,
      };
    }

    // 3. Processa cada kart e insere o log transacional
    for (const { numero, minutos } of validos) {
      const linhas = (await run(
        `SELECT Id id, Categoria categoria, ItemId item, MinutosUso minutos, CONVERT(varchar(19), UltimaManutencao, 126) ultima
         FROM dbo.Manutencao WHERE TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n`,
        { n: numero }
      )) as { id: number; categoria: string | null; item: number | null; minutos: number; ultima: string | null }[];

      const cats = [...new Set(linhas.map((l) => l.categoria ?? ''))];
      const daCategoria = cat ? linhas.filter((l) => (l.categoria ?? '') === cat) : cats.length === 1 ? linhas : [];
      const porItem = new Map<string, typeof daCategoria>();
      for (const l of daCategoria) porItem.set(String(l.item ?? ''), [...(porItem.get(String(l.item ?? '')) ?? []), l]);
      const alvo = [...porItem.values()].map((g) => g.sort((a, x) => (x.ultima ?? '').localeCompare(a.ultima ?? '') || x.minutos - a.minutos || a.id - x.id)[0]);

      if (!alvo.length && cat) {
        await run(
          `INSERT dbo.Manutencao (Kart, Categoria, ItemId, MinutosUso, Realizada, Data)
           SELECT @k, @c, Id, @m, 0, SYSDATETIME() FROM dbo.ItemManutencao WHERE Ativo = 1 AND ControlaPorTempo = 1`,
          { k: String(numero), c: cat, m: minutos }
        );
        criados++;
      } else if (!alvo.length) {
        ignorados++;
      } else {
        for (const l of alvo) {
          await run(
            `UPDATE dbo.Manutencao SET MinutosUso = MinutosUso + @m, Realizada = 0, Data = SYSDATETIME() WHERE Id = @id`,
            { m: minutos, id: l.id }
          );
          somados++;
        }
      }

      await run(
        `INSERT INTO dbo.CronoUsoKarts (SessaoId, AgendaId, Categoria, Kart, Minutos, PayloadHash, CriadoEm)
         VALUES (@sessaoId, @agendaId, @categoria, @kart, @minutos, @payloadHash, SYSDATETIME())`,
        {
          sessaoId,
          agendaId: agendaId > 0 ? agendaId : null,
          categoria: cat ?? '',
          kart: String(numero),
          minutos,
          payloadHash,
        }
      );
    }

    return {
      ok: true,
      jaAplicado: false,
      categoria: cat,
      somados,
      criados,
      ignorados,
    };
  });
}

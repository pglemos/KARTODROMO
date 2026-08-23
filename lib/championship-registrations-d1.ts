import type { AdminD1Database, AdminD1Statement } from '@/lib/admin-d1';
import {
  championshipRegistrationsTable,
  type ChampionshipRegistrationRow,
  type ChampionshipRegistrationStatus,
} from '@/lib/championship-registrations';

type NormalizedRegistration = Omit<ChampionshipRegistrationRow, 'id' | 'protocol' | 'created_at' | 'updated_at' | 'reviewed_at' | 'admin_notes' | 'status' | 'evento'> & {
  evento: string | null;
  status: ChampionshipRegistrationStatus;
};

type RegistrationRow = Record<string, unknown>;

export type RegistrationListOptions = {
  evento?: string | null;
  q?: string | null;
  status?: ChampionshipRegistrationStatus | null;
  limit: number;
  offset: number;
};

const jsonValue = (value: unknown, fallback: unknown) => {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

function normalizeStoredRow(row: RegistrationRow): ChampionshipRegistrationRow {
  return {
    ...row,
    campeonato_id: row.campeonato_id == null ? null : String(row.campeonato_id),
    evento: String(row.evento ?? ''),
    modalidade: row.modalidade === 'individual' ? 'individual' : 'equipe',
    status: row.status as ChampionshipRegistrationStatus,
    pilotos: jsonValue(row.pilotos, []) as ChampionshipRegistrationRow['pilotos'],
    aceites: jsonValue(row.aceites, {}) as ChampionshipRegistrationRow['aceites'],
    idade: row.idade == null ? null : Number(row.idade),
    peso_kg: row.peso_kg == null ? null : Number(row.peso_kg),
    quantidade_karts: row.quantidade_karts == null ? null : Number(row.quantidade_karts),
    admin_notes: row.admin_notes == null ? null : String(row.admin_notes),
    reviewed_at: row.reviewed_at == null ? null : String(row.reviewed_at),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  } as ChampionshipRegistrationRow;
}

function bindRegistration(statement: AdminD1Statement, registration: NormalizedRegistration, id: string, protocol: string, timestamp: string) {
  return statement.bind(
    id,
    protocol,
    registration.campeonato_id,
    registration.evento,
    registration.modalidade,
    registration.status,
    registration.nome_equipe,
    registration.nome_chefe,
    registration.nome_completo,
    registration.cpf,
    registration.data_nascimento,
    registration.idade,
    registration.peso_kg,
    registration.email,
    registration.telefone,
    registration.cidade,
    registration.experiencia,
    registration.nivel_atual,
    registration.disponibilidade,
    registration.participacao_desejada,
    registration.interesse_ranking,
    registration.janelas_preferidas,
    registration.equipamento,
    registration.equipamento_detalhes,
    registration.contato_emergencia_nome,
    registration.contato_emergencia_telefone,
    registration.restricoes_medicas,
    registration.alergias,
    registration.medicamentos,
    registration.objetivos,
    registration.observacoes,
    registration.quantidade_karts,
    JSON.stringify(registration.pilotos),
    registration.pagamento,
    JSON.stringify(registration.aceites),
    null,
    null,
    timestamp,
    timestamp,
  );
}

export async function createChampionshipRegistration(
  db: AdminD1Database,
  registration: NormalizedRegistration,
  protocol: string,
): Promise<ChampionshipRegistrationRow> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await bindRegistration(db.prepare(`INSERT INTO ${championshipRegistrationsTable} (
    id, protocol, campeonato_id, evento, modalidade, status, nome_equipe, nome_chefe,
    nome_completo, cpf, data_nascimento, idade, peso_kg, email, telefone, cidade,
    experiencia, nivel_atual, disponibilidade, participacao_desejada, interesse_ranking,
    janelas_preferidas, equipamento, equipamento_detalhes, contato_emergencia_nome,
    contato_emergencia_telefone, restricoes_medicas, alergias, medicamentos, objetivos,
    observacoes, quantidade_karts, pilotos, pagamento, aceites, admin_notes, reviewed_at,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`), registration, id, protocol, timestamp).run();

  const row = await db.prepare(`SELECT * FROM ${championshipRegistrationsTable} WHERE id = ?`).bind(id).first<RegistrationRow>();
  if (!row) throw new Error('championship_registration_not_created');
  return normalizeStoredRow(row);
}

export async function listChampionshipRegistrations(db: AdminD1Database, options: RegistrationListOptions) {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (options.evento) {
    clauses.push('evento = ?');
    bindings.push(options.evento);
  }

  if (options.status) {
    clauses.push('status = ?');
    bindings.push(options.status);
  }

  const query = options.q?.trim();
  if (query) {
    clauses.push('(protocol LIKE ? OR evento LIKE ? OR nome_equipe LIKE ? OR nome_chefe LIKE ? OR nome_completo LIKE ? OR email LIKE ? OR telefone LIKE ?)');
    bindings.push(...Array.from({ length: 7 }, () => `%${query}%`));
  }

  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM ${championshipRegistrationsTable}${where}`).bind(...bindings).first<{ total: number }>();
  const result = await db.prepare(`SELECT * FROM ${championshipRegistrationsTable}${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...bindings, options.limit, options.offset)
    .all<RegistrationRow>();

  return {
    rows: result.results.map(normalizeStoredRow),
    total: Number(count?.total ?? 0),
  };
}

export async function updateChampionshipRegistration(
  db: AdminD1Database,
  id: string,
  update: { status?: ChampionshipRegistrationStatus; admin_notes?: string | null; reviewed_at?: string },
) {
  const fields: string[] = [];
  const bindings: unknown[] = [];

  for (const key of ['status', 'admin_notes', 'reviewed_at'] as const) {
    if (update[key] !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(update[key]);
    }
  }
  if (!fields.length) throw new Error('empty_update');

  fields.push('updated_at = ?');
  bindings.push(new Date().toISOString(), id);
  const result = await db.prepare(`UPDATE ${championshipRegistrationsTable} SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();
  if (!result.meta.changes) throw new Error('championship_registration_not_found');

  const row = await db.prepare(`SELECT * FROM ${championshipRegistrationsTable} WHERE id = ?`).bind(id).first<RegistrationRow>();
  if (!row) throw new Error('championship_registration_not_found');
  return normalizeStoredRow(row);
}

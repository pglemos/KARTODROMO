import type { SessionType } from './race-engine';

export type TimingEvent = { id: string; name: string; date: string; venue: string; trackId: string | null; active: boolean; createdAt: number };
export type TimingGroup = { id: string; eventId: string; name: string; categoryId: string | null; order: number };
export type TimingProof = { id: string; eventId: string; groupId: string; name: string; type: SessionType; durationMin: number; maxLaps: number | null; agendaId: string | null; order: number; heats: number; startAt: string; intervalMin: number };
export type TimingCategory = { id: string; name: string; color: string };
export type TimingTrack = { id: string; name: string; lengthMeters: number };
export type TimingCatalog = { events: TimingEvent[]; groups: TimingGroup[]; provas: TimingProof[]; categories: TimingCategory[]; tracks: TimingTrack[] };
export type CatalogEntity = keyof TimingCatalog;

export function emptyCatalog(): TimingCatalog {
  return { events: [], groups: [], provas: [], categories: [], tracks: [] };
}

export function normalizeCatalog(value: unknown): TimingCatalog {
  if (!value || typeof value !== 'object') throw new Error('Arquivo de eventos inválido.');
  const source = value as Partial<TimingCatalog>;
  const catalog: TimingCatalog = {
    events: Array.isArray(source.events) ? source.events : [],
    groups: Array.isArray(source.groups) ? source.groups : [],
    provas: Array.isArray(source.provas) ? source.provas : [],
    categories: Array.isArray(source.categories) ? source.categories : [],
    tracks: Array.isArray(source.tracks) ? source.tracks : [],
  };
  const ids = new Set<string>();
  for (const collection of Object.values(catalog)) for (const item of collection) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('O arquivo contém um registro sem identificador ou com identificador repetido.');
    ids.add(item.id);
  }
  for (const group of catalog.groups) if (!catalog.events.some((e) => e.id === group.eventId)) throw new Error(`O grupo "${group.name}" aponta para um evento inexistente.`);
  for (const proof of catalog.provas) {
    const group = catalog.groups.find((g) => g.id === proof.groupId);
    if (!group || group.eventId !== proof.eventId) throw new Error(`A prova "${proof.name}" aponta para um grupo inexistente.`);
  }
  return catalog;
}

function text(input: Record<string, unknown>, name: string, fallback = '') {
  return String(input[name] ?? fallback).trim();
}

type CatalogRecord = { id: string; [key: string]: unknown };

function entityList(catalog: TimingCatalog, entity: CatalogEntity): CatalogRecord[] {
  return catalog[entity] as CatalogRecord[];
}

export function createCatalogRecord(catalog: TimingCatalog, entity: CatalogEntity, input: Record<string, unknown>, id: string, now: number): TimingCatalog[keyof TimingCatalog][number] {
  const name = text(input, 'name');
  if (!name) throw new Error('Informe o nome.');
  let record: object;
  if (entity === 'events') {
    record = { id, name, date: text(input, 'date'), venue: text(input, 'venue'), trackId: text(input, 'trackId') || null, active: input.active !== false, createdAt: now } satisfies TimingEvent;
  } else if (entity === 'groups') {
    const eventId = text(input, 'eventId');
    if (!catalog.events.some((event) => event.id === eventId)) throw new Error('Selecione um evento existente.');
    record = { id, eventId, name, categoryId: text(input, 'categoryId') || null, order: Number(input.order ?? catalog.groups.filter((group) => group.eventId === eventId).length + 1) } satisfies TimingGroup;
  } else if (entity === 'provas') {
    const groupId = text(input, 'groupId');
    const group = catalog.groups.find((item) => item.id === groupId);
    if (!group) throw new Error('Selecione um grupo existente.');
    const type = text(input, 'type', 'treino') as SessionType;
    if (!['treino', 'classificacao', 'corrida'].includes(type)) throw new Error('Tipo de prova inválido.');
    record = {
      id, eventId: group.eventId, groupId, name, type,
      durationMin: Math.max(0, Number(input.durationMin ?? 10)),
      maxLaps: Number(input.maxLaps ?? 0) > 0 ? Number(input.maxLaps) : null,
      agendaId: text(input, 'agendaId') || null,
      order: Number(input.order ?? catalog.provas.filter((proof) => proof.groupId === groupId).length + 1),
      heats: Math.max(1, Number(input.heats ?? 1)), startAt: text(input, 'startAt'), intervalMin: Math.max(0, Number(input.intervalMin ?? 0)),
    } satisfies TimingProof;
  } else if (entity === 'categories') {
    record = { id, name, color: text(input, 'color', '#0B7A53') } satisfies TimingCategory;
  } else {
    const lengthMeters = Number(input.lengthMeters ?? 0);
    if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Informe a extensão do traçado em metros.');
    record = { id, name, lengthMeters } satisfies TimingTrack;
  }
  entityList(catalog, entity).push(record as never);
  return record as TimingCatalog[keyof TimingCatalog][number];
}

export function updateCatalogRecord(catalog: TimingCatalog, entity: CatalogEntity, id: string, input: Record<string, unknown>) {
  const records = entityList(catalog, entity);
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Registro não encontrado.');
  const before = records[index] as Record<string, unknown>;
  const next: Record<string, unknown> = { ...before, ...input, id };
  if (typeof next.name === 'string') next.name = next.name.trim();
  if (!next.name) throw new Error('Informe o nome.');
  if (entity === 'groups' && !catalog.events.some((event) => event.id === next.eventId)) throw new Error('Selecione um evento existente.');
  if (entity === 'provas') {
    const group = catalog.groups.find((item) => item.id === next.groupId);
    if (!group) throw new Error('Selecione um grupo existente.');
    next.eventId = group.eventId;
    if (!['treino', 'classificacao', 'corrida'].includes(String(next.type))) throw new Error('Tipo de prova inválido.');
  }
  if (entity === 'tracks' && Number(next.lengthMeters) <= 0) throw new Error('Informe a extensão do traçado em metros.');
  records[index] = next as never;
  return records[index] as TimingCatalog[keyof TimingCatalog][number];
}

export function deleteCatalogRecord(catalog: TimingCatalog, entity: CatalogEntity, id: string) {
  const records = entityList(catalog, entity);
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Registro não encontrado.');
  records.splice(index, 1);
  if (entity === 'events') {
    const groupIds = catalog.groups.filter((group) => group.eventId === id).map((group) => group.id);
    catalog.groups = catalog.groups.filter((group) => group.eventId !== id);
    catalog.provas = catalog.provas.filter((proof) => proof.eventId !== id && !groupIds.includes(proof.groupId));
  } else if (entity === 'groups') {
    catalog.provas = catalog.provas.filter((proof) => proof.groupId !== id);
  }
  return catalog;
}

export function duplicateEvent(catalog: TimingCatalog, id: string, makeId: () => string, now: number) {
  const event = catalog.events.find((item) => item.id === id);
  if (!event) throw new Error('Evento não encontrado.');
  const copyId = makeId();
  const copy = { ...event, id: copyId, name: `${event.name} (cópia)`, createdAt: now };
  catalog.events.push(copy);
  const groupMap = new Map<string, string>();
  for (const group of catalog.groups.filter((item) => item.eventId === id)) {
    const groupId = makeId();
    groupMap.set(group.id, groupId);
    catalog.groups.push({ ...group, id: groupId, eventId: copyId });
    for (const proof of catalog.provas.filter((item) => item.groupId === group.id)) {
      catalog.provas.push({ ...proof, id: makeId(), eventId: copyId, groupId });
    }
  }
  return copy;
}

export function distributeProof(catalog: TimingCatalog, id: string, input: Record<string, unknown>) {
  const proof = catalog.provas.find((item) => item.id === id);
  if (!proof) throw new Error('Prova não encontrada.');
  proof.heats = Math.max(1, Math.min(100, Number(input.heats ?? proof.heats)));
  proof.startAt = text(input, 'startAt', proof.startAt);
  proof.intervalMin = Math.max(0, Number(input.intervalMin ?? proof.intervalMin));
  return proof;
}

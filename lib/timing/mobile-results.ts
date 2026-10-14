import { computeStandings, type Competitor, type Session } from './race-engine';

export type MobileResultAction = 'publish' | 'withdraw';

function eventDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(timestamp);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function competitorKey(kart: string, name: string) {
  return `${kart}\0${name.trim()}`;
}

export function serializeMobilePublication(session: Session, action: MobileResultAction) {
  if (action === 'withdraw') return { action, sessionId: session.id };
  if (session.state !== 'encerrada') throw new Error('Encerre a bateria antes de publicar o resultado.');
  if (!session.competitors.length || session.competitors.length > 100) throw new Error('A bateria não tem uma lista de pilotos publicável.');

  const byStanding = new Map<string, Competitor[]>();
  for (const competitor of session.competitors) {
    const key = competitorKey(competitor.kart, competitor.name);
    byStanding.set(key, [...(byStanding.get(key) ?? []), competitor]);
  }
  const results = computeStandings(session).map((standing) => {
    const competitor = byStanding.get(competitorKey(standing.kart, standing.name))?.shift();
    const customerId = String(competitor?.customerId ?? '').trim();
    const displayName = standing.name.trim().replace(/\s+/g, ' ');
    if (!competitor || !/^\d{1,20}$/.test(customerId) || !displayName) {
      throw new Error('Vincule todos os pilotos a clientes antes de publicar.');
    }
    return {
      customerId,
      displayName,
      position: standing.position,
      kart: standing.kart,
      laps: standing.laps,
      bestLapMs: standing.bestLapMs,
    };
  });
  const eventName = session.name.trim();
  if (!eventName) throw new Error('Informe o nome da bateria antes de publicar.');
  return {
    action,
    sessionId: session.id,
    eventName,
    eventDate: eventDate(session.finishedAt ?? session.startedAt ?? session.createdAt),
    results,
  };
}

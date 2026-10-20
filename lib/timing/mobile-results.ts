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

/**
 * opcoes.ignorarSemCadastro: publicação automática (3 min depois de encerrar, junto com o e-mail): quem correu sem
 * cadastro na recepção fica de fora do app (não tem conta para ver), mas as posições dos outros continuam as oficiais.
 * Sem a opção (publicação pelo menu da crono), exige todos vinculados, como antes.
 */
export function serializeMobilePublication(session: Session, action: MobileResultAction, opcoes: { ignorarSemCadastro?: boolean } = {}) {
  if (action === 'withdraw') return { action, sessionId: session.id };
  if (session.state !== 'encerrada') throw new Error('Encerre a bateria antes de publicar o resultado.');
  if (!session.competitors.length || session.competitors.length > 100) throw new Error('A bateria não tem uma lista de pilotos publicável.');

  const byStanding = new Map<string, Competitor[]>();
  for (const competitor of session.competitors) {
    const key = competitorKey(competitor.kart, competitor.name);
    byStanding.set(key, [...(byStanding.get(key) ?? []), competitor]);
  }
  const vistos = new Set<string>();
  const results = computeStandings(session).flatMap((standing) => {
    const competitor = byStanding.get(competitorKey(standing.kart, standing.name))?.shift();
    const customerId = String(competitor?.customerId ?? '').trim();
    const displayName = standing.name.trim().replace(/\s+/g, ' ');
    // automático: também fica de fora quem foi inscrito e não andou (sem kart; o Worker recusaria a bateria inteira)
    const naoAndou = !standing.kart.trim() || standing.kart.trim().length > 40;
    if (!competitor || !/^\d{1,20}$/.test(customerId) || !displayName || (opcoes.ignorarSemCadastro && (vistos.has(customerId) || naoAndou))) {
      if (opcoes.ignorarSemCadastro) return [];
      throw new Error('Vincule todos os pilotos a clientes antes de publicar.');
    }
    vistos.add(customerId);
    return [{
      customerId,
      displayName,
      position: standing.position,
      kart: standing.kart,
      laps: standing.laps,
      bestLapMs: standing.bestLapMs,
    }];
  });
  if (!results.length) throw new Error('Nenhum piloto da bateria tem cadastro na recepção.');
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

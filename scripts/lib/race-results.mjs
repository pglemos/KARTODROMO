import { get, list, put } from '@vercel/blob';

export const BEST_RESULTS_COUNT = 4;

const KAC_POINTS_TOP_FOUR = new Map([
  [1, 25],
  [2, 22],
  [3, 20],
  [4, 18],
]);

export const parseTimeToMs = (value) => {
  const parts = String(value || '').trim().replace(',', '.').split(':').map(Number);

  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) return undefined;

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 1) return Math.round(parts[0] * 1000);
  return undefined;
};

export const pointsForPosition = (position) => {
  if (KAC_POINTS_TOP_FOUR.has(position)) return KAC_POINTS_TOP_FOUR.get(position);
  return Math.max(0, 18 - (position - 4));
};

const normalizeName = (name) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const sortEntries = (entries) =>
  [...entries].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;

    const timeA = Number.isFinite(a.bestLapMs) ? a.bestLapMs : Number.POSITIVE_INFINITY;
    const timeB = Number.isFinite(b.bestLapMs) ? b.bestLapMs : Number.POSITIVE_INFINITY;

    if (timeA !== timeB) return timeA - timeB;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

const decodeHtml = (value) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x2B;/gi, '+')
    .trim();

export const extractEntriesFromHtml = (html) => {
  const positions = [...html.matchAll(/pos-text[^>]*>(\d+)<\/div>/g)].map((match) => Number(match[1]));
  const bestLaps = [...html.matchAll(/competitor-time[^>]*>([^<]+)<\/h1>/g)].map((match) => decodeHtml(match[1]));
  const names = [...html.matchAll(/competitor-name-h1[^>]*>([^<]+)<\/h1>/g)].map((match) => decodeHtml(match[1]));
  const count = Math.min(positions.length, bestLaps.length, names.length);
  const entriesByPosition = new Map();

  for (let index = 0; index < count; index += 1) {
    const position = positions[index];
    const name = names[index];
    const bestLap = bestLaps[index];

    if (!Number.isFinite(position) || !name || entriesByPosition.has(position)) continue;

    entriesByPosition.set(position, {
      position,
      name,
      bestLap,
      bestLapMs: parseTimeToMs(bestLap),
      points: pointsForPosition(position),
    });
  }

  return sortEntries([...entriesByPosition.values()]);
};

const isUsefulTime = (value) => {
  const milliseconds = parseTimeToMs(value);
  return Number.isFinite(milliseconds) && milliseconds > 0;
};

export const extractEntriesFromSnapshot = (snapshot) => {
  const drivers = Array.isArray(snapshot?.drivers) ? snapshot.drivers : [];
  const candidates = drivers
    .filter((driver) => driver && Number.isFinite(Number(driver.position)) && String(driver.name || '').trim())
    .map((driver) => ({
      position: Number(driver.position),
      name: String(driver.name).trim(),
      kart: driver.kart ? String(driver.kart).trim() : undefined,
      bestLap: isUsefulTime(driver.time) ? String(driver.time).trim() : undefined,
      bestLapMs: isUsefulTime(driver.time) ? parseTimeToMs(driver.time) : undefined,
    }));
  const entriesByPosition = new Map();

  for (const entry of sortEntries(candidates)) {
    const current = entriesByPosition.get(entry.position);
    if (!current || (!current.bestLap && entry.bestLap)) entriesByPosition.set(entry.position, entry);
  }

  return sortEntries([...entriesByPosition.values()]).map((entry) => ({
    ...entry,
    points: pointsForPosition(entry.position),
  }));
};

export const buildStandings = (races) => {
  const pilots = new Map();

  for (const race of races) {
    for (const entry of race.entries || []) {
      if (!entry?.name || typeof entry.points !== 'number') continue;

      const key = normalizeName(entry.name);
      const current = pilots.get(key) || {
        name: entry.name,
        scores: [],
        starts: 0,
        wins: 0,
        seconds: 0,
        thirds: 0,
        fourths: 0,
      };

      current.name = entry.name;
      current.scores.push(entry.points);
      current.starts += 1;
      if (entry.position === 1) current.wins += 1;
      if (entry.position === 2) current.seconds += 1;
      if (entry.position === 3) current.thirds += 1;
      if (entry.position === 4) current.fourths += 1;
      pilots.set(key, current);
    }
  }

  return [...pilots.values()]
    .map((pilot) => {
      const orderedScores = [...pilot.scores].sort((a, b) => b - a);
      const countedResults = orderedScores.slice(0, BEST_RESULTS_COUNT);
      const discardedResults = orderedScores.slice(BEST_RESULTS_COUNT);
      const bestFive = orderedScores.slice(0, 5).reduce((sum, value) => sum + value, 0);

      return {
        position: 0,
        name: pilot.name,
        points: countedResults.reduce((sum, value) => sum + value, 0),
        starts: pilot.starts,
        wins: pilot.wins,
        seconds: pilot.seconds,
        thirds: pilot.thirds,
        fourths: pilot.fourths,
        countedResults,
        discardedResults,
        bestFive,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      if (b.thirds !== a.thirds) return b.thirds - a.thirds;
      if (b.fourths !== a.fourths) return b.fourths - a.fourths;
      if (b.bestFive !== a.bestFive) return b.bestFive - a.bestFive;
      return a.name.localeCompare(b.name, 'pt-BR');
    })
    .map(({ bestFive, ...pilot }, index) => ({ ...pilot, position: index + 1 }));
};

export const readExistingRaces = async (championshipId) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];

  const result = await list({
    prefix: `race-results/${championshipId}/races/`,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  const races = [];

  for (const blob of result.blobs) {
    const body = await get(blob.pathname, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!body || body.statusCode !== 200 || !body.stream) continue;
    races.push(JSON.parse(await new Response(body.stream).text()));
  }

  return races;
};

const uploadJson = async (pathname, payload) =>
  put(pathname, JSON.stringify(payload, null, 2), {
    access: 'public',
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

export const publishRaceResult = async (result) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Defina BLOB_READ_WRITE_TOKEN para publicar no Vercel Blob.');
  }

  const existingRaces = await readExistingRaces(result.championshipId);
  const raceKey = `${result.date}-${result.round || result.title}`;
  const races = [
    ...existingRaces.filter((race) => `${race.date}-${race.round || race.title}` !== raceKey),
    result,
  ];
  const completeResult = {
    ...result,
    entries: sortEntries(result.entries),
    standings: buildStandings(races),
  };
  const suffix = result.round ? `corrida-${result.round}` : Date.now().toString();
  const archivePath = `race-results/${result.championshipId}/races/${result.date}-${suffix}.json`;
  const latestPath = `race-results/${result.championshipId}/latest.json`;
  const [archiveBlob, latestBlob] = await Promise.all([
    uploadJson(archivePath, completeResult),
    uploadJson(latestPath, completeResult),
  ]);

  return { result: completeResult, archiveBlob, latestBlob };
};

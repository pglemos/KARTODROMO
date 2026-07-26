import { get, put } from '@vercel/blob';

type RaceResultPayload = {
  championshipId?: unknown;
  championshipName?: unknown;
  season?: unknown;
  title?: unknown;
  date?: unknown;
  round?: unknown;
  status?: unknown;
  source?: unknown;
  generatedAt?: unknown;
  entries?: unknown;
  standings?: unknown;
};

type ServerlessRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ServerlessResponse = {
  status: (statusCode: number) => ServerlessResponse;
  setHeader: (name: string, value: string) => void;
  json: (payload: unknown) => void;
};

const jsonResponse = (response: ServerlessResponse, payload: unknown, status = 200) => {
  response.setHeader('Cache-Control', 'no-store');
  response.status(status).json(payload);
};

const cleanChampionshipId = (value: string | null) => {
  const id = (value || 'kac').toLowerCase().trim();
  return /^[a-z0-9-]+$/.test(id) ? id : 'kac';
};

const latestPath = (championshipId: string) => `race-results/${championshipId}/latest.json`;

const racePath = (payload: RaceResultPayload, championshipId: string) => {
  const date = typeof payload.date === 'string' ? payload.date : new Date().toISOString().slice(0, 10);
  const round = Number(payload.round);
  const suffix = Number.isFinite(round) && round > 0 ? `corrida-${round}` : Date.now().toString();

  return `race-results/${championshipId}/races/${date}-${suffix}.json`;
};

const readBlobJson = async (pathname: string) => {
  const blob = await get(pathname, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  if (!blob || blob.statusCode !== 200 || !blob.stream) return null;

  const text = await new Response(blob.stream).text();
  return JSON.parse(text) as unknown;
};

const isAuthorized = (request: ServerlessRequest) => {
  const expected = process.env.RESULTS_ADMIN_TOKEN;
  if (!expected) return false;

  const header = request.headers.authorization || '';
  return header === `Bearer ${expected}`;
};

const validatePayload = (payload: RaceResultPayload) => {
  const errors: string[] = [];

  if (typeof payload.championshipId !== 'string' || !payload.championshipId.trim()) errors.push('championshipId obrigatório.');
  if (typeof payload.title !== 'string' || !payload.title.trim()) errors.push('title obrigatório.');
  if (typeof payload.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) errors.push('date deve usar YYYY-MM-DD.');
  if (!['live', 'final', 'provisional'].includes(String(payload.status))) errors.push('status inválido.');
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) errors.push('entries obrigatório.');

  return errors;
};

export default async function handler(request: ServerlessRequest, response: ServerlessResponse) {
  const requestUrl = new URL(request.url || '/', 'https://kartodromobetim.vercel.app');
  const championshipId = cleanChampionshipId(requestUrl.searchParams.get('championship'));

  if (request.method === 'GET') {
    try {
      const payload = await readBlobJson(latestPath(championshipId));

      if (!payload) {
        return jsonResponse(response, { error: 'Result not found' }, 404);
      }

      return jsonResponse(response, payload);
    } catch {
      return jsonResponse(response, { error: 'Failed to read result' }, 500);
    }
  }

  if (request.method === 'POST') {
    if (!isAuthorized(request)) {
      return jsonResponse(response, { error: 'Unauthorized' }, 401);
    }

    try {
      const payload = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as RaceResultPayload;
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return jsonResponse(response, { error: 'Invalid result payload', details: errors }, 400);
      }

      const normalizedChampionshipId = cleanChampionshipId(String(payload.championshipId));
      const body = JSON.stringify(payload, null, 2);

      const [latestBlob, archivedBlob] = await Promise.all([
        put(latestPath(normalizedChampionshipId), body, {
          access: 'public',
          allowOverwrite: true,
          contentType: 'application/json; charset=utf-8',
          cacheControlMaxAge: 60,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }),
        put(racePath(payload, normalizedChampionshipId), body, {
          access: 'public',
          allowOverwrite: true,
          contentType: 'application/json; charset=utf-8',
          cacheControlMaxAge: 60,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }),
      ]);

      return jsonResponse(response, {
        ok: true,
        latest: latestBlob.pathname,
        archived: archivedBlob.pathname,
      });
    } catch {
      return jsonResponse(response, { error: 'Failed to write result' }, 500);
    }
  }

  return jsonResponse(response, { error: 'Method not allowed' }, 405);
}

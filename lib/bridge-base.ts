/**
 * Unified bridge base resolver.
 * In production, KARTODROMO_LOCAL_API_ENDPOINT is the primary source.
 * Falls back to deriving from LIVETIME_SNAPSHOT_ENDPOINT.
 * Falls back to TELAO_LAYOUT_REMOTE_ENDPOINT for telao-related bridges.
 */

function cleanBase(url: string): string {
  return url.replace(/\/api\/livetime-snapshot.*$/i, '').replace(/\/+$/, '');
}

export function resolveBridgeBase(): string | null {
  // 1. Primary: KARTODROMO_LOCAL_API_ENDPOINT (Cloudflare Worker secret)
  const localApi = process.env.KARTODROMO_LOCAL_API_ENDPOINT;
  if (localApi) return cleanBase(localApi);

  // 2. Secondary: derive from LIVETIME_SNAPSHOT_ENDPOINT
  const snapshot = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (snapshot) return cleanBase(snapshot);

  // 3. Tertiary: derive from TELAO_LAYOUT_REMOTE_ENDPOINT
  const telao = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;
  if (telao) {
    return cleanBase(telao.replace(/\/api\/telao-layout-local\/?$/i, ''));
  }

  return null;
}

export function resolveSnapshotEndpoint(): string | null {
  // 1. Direct: LIVETIME_SNAPSHOT_ENDPOINT
  const snapshot = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (snapshot) return snapshot;

  // 2. Derive from KARTODROMO_LOCAL_API_ENDPOINT
  const localApi = process.env.KARTODROMO_LOCAL_API_ENDPOINT;
  if (localApi) return `${cleanBase(localApi)}/api/livetime-snapshot`;

  // 3. Derive from TELAO_LAYOUT_REMOTE_ENDPOINT
  const telao = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;
  if (telao) {
    const base = cleanBase(telao.replace(/\/api\/telao-layout-local\/?$/i, ''));
    return `${base}/api/livetime-snapshot`;
  }

  return null;
}

export function resolveViplexEndpoint(): string | null {
  // 1. Direct: VIPLEX_PROGRAMS_REMOTE_ENDPOINT
  const direct = process.env.VIPLEX_PROGRAMS_REMOTE_ENDPOINT;
  if (direct) return direct;

  // 2. Derive from bridge base
  const base = resolveBridgeBase();
  if (base) return `${base}/api/viplex-programs-local`;

  return null;
}

export const BRIDGE_FETCH_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
};

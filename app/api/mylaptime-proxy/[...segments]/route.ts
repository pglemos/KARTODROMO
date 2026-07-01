import { proxyMyLapTime } from '@/lib/mylaptime-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveUpstream(segments: string[]): { path: string; mode: 'transform' | 'passthrough' } | null {
  const [tag, ...rest] = segments;

  switch (tag) {
    case 'booking':
      return { path: 'booking', mode: 'transform' };
    case 'auth':
      return { path: `api/auth/${rest.join('/')}`, mode: 'transform' };
    case 'auth-page':
      return { path: `auth/${rest.join('/')}`, mode: 'transform' };
    case 'content':
      return { path: `_content/${rest.join('/')}`, mode: 'passthrough' };
    case 'framework':
      return { path: `_framework/${rest.join('/')}`, mode: 'passthrough' };
    case 'blazor':
      return { path: rest.length ? `_blazor/${rest.join('/')}` : '_blazor', mode: 'passthrough' };
    case 'mylaptime':
      return { path: rest.join('/'), mode: 'passthrough' };
    case 'styles':
      return { path: 'LapTime.Web.Tools.styles.css', mode: 'passthrough' };
    default:
      return null;
  }
}

async function handle(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const upstream = resolveUpstream(segments);

  if (!upstream) {
    return new Response(JSON.stringify({ error: 'unknown_mylaptime_path' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  return proxyMyLapTime(request, upstream.path, upstream.mode);
}

export const GET = handle;
export const POST = handle;
export const HEAD = handle;
export const OPTIONS = handle;

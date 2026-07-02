import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// A Sisecom (fabricante do LapTime/MyLapTime) abriu uma denuncia formal de abuso no Cloudflare
// contra `https://kartodromodebetim.com.br` (sem www) e `/booking`, alegando personificacao de
// marca — o proxy de agendamento (lib/mylaptime-proxy.ts) clona a interface deles. O Cloudflare
// passou a bloquear especificamente essas duas URLs (sem www) como "Suspected Phishing", mesmo com
// `www.kartodromodebetim.com.br` funcionando normalmente. Ate a arquitetura do proxy ser revista,
// redirecionamos TODO trafego do dominio sem www para o www, pra que ningeum (buscador, link
// antigo, favorito, URL digitada) chegue nas URLs exatas que foram denunciadas.
const BARE_HOST = 'kartodromodebetim.com.br';
const WWW_HOST = 'www.kartodromodebetim.com.br';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase().split(':')[0];

  if (host === BARE_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = 'https';
    url.host = WWW_HOST;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};

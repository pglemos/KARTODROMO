import { pagina } from './pagina';

export interface Env {
  /** Endereço do Grupo do Google com entrada livre, testador da faixa Alpha do app cliente. */
  GRUPO_TESTADORES: string;
  LINK_CLIENTE: string;
}

export function linkGrupo(email: string): string {
  const [nome] = email.split('@');
  return `https://groups.google.com/g/${nome}/about`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/' && req.method === 'GET') {
      return new Response(pagina({ grupo: linkGrupo(env.GRUPO_TESTADORES), cliente: env.LINK_CLIENTE }), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
      });
    }
    return new Response('Não encontrado', { status: 404 });
  },
};

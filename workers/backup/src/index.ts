/** Guarda e devolve os backups criptografados do SRVKART. Segredo: BACKUP_TOKEN (wrangler secret). */
interface Env { BACKUP: R2Bucket; BACKUP_TOKEN: string }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const esperado = new TextEncoder().encode(`Bearer ${env.BACKUP_TOKEN}`);
    const recebido = new TextEncoder().encode(request.headers.get('authorization') ?? '');
    if (!env.BACKUP_TOKEN || esperado.length !== recebido.length || !crypto.subtle.timingSafeEqual(esperado, recebido)) return new Response('401', { status: 401 });
    const nome = new URL(request.url).pathname.slice(1);
    if (!nome) return Response.json((await env.BACKUP.list()).objects.map((o) => ({ nome: o.key, tamanho: o.size, em: o.uploaded })));
    if (!/^[\w.-]+\.enc$/.test(nome)) return new Response('nome inválido', { status: 400 });
    if (request.method === 'PUT') {
      const o = await env.BACKUP.put(nome, request.body);
      return Response.json({ nome, tamanho: o?.size ?? 0 });
    }
    if (request.method === 'GET') {
      const o = await env.BACKUP.get(nome);
      return o ? new Response(o.body) : new Response('404', { status: 404 });
    }
    return new Response('405', { status: 405 });
  },
};

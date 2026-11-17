/**
 * HTMLRewriter mínimo para os Workers que rodam no kart-edge. Cobre o que eles usam: seletor `tag`, `tag[attr]` ou
 * `tag[attr="valor"]` e, no elemento, get/set/removeAttribute, remove, before/after/prepend/append e setInnerContent.
 * Trabalha sobre o HTML inteiro (as páginas são pequenas); não é streaming como o da Cloudflare.
 */
interface Conteudo { html?: boolean }
interface Handler { element?(el: Elemento): void | Promise<void> }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class Elemento {
  removido = false;
  antes = '';
  depois = '';
  inicio = '';
  fim = '';
  interno: string | null = null;
  constructor(readonly tagName: string, public attrs: [string, string | null][]) {}
  getAttribute(n: string) { const a = this.attrs.find(([k]) => k === n.toLowerCase()); return a ? a[1] ?? '' : null; }
  hasAttribute(n: string) { return this.attrs.some(([k]) => k === n.toLowerCase()); }
  setAttribute(n: string, v: string) { const k = n.toLowerCase(); const a = this.attrs.find(([x]) => x === k); if (a) a[1] = v; else this.attrs.push([k, v]); return this; }
  removeAttribute(n: string) { this.attrs = this.attrs.filter(([k]) => k !== n.toLowerCase()); return this; }
  remove() { this.removido = true; return this; }
  before(c: string, o?: Conteudo) { this.antes += o?.html ? c : esc(c); return this; }
  after(c: string, o?: Conteudo) { this.depois = (o?.html ? c : esc(c)) + this.depois; return this; }
  prepend(c: string, o?: Conteudo) { this.inicio = (o?.html ? c : esc(c)) + this.inicio; return this; }
  append(c: string, o?: Conteudo) { this.fim += o?.html ? c : esc(c); return this; }
  setInnerContent(c: string, o?: Conteudo) { this.interno = o?.html ? c : esc(c); return this; }
  abertura(): string {
    return `<${this.tagName}${this.attrs.map(([k, v]) => (v === null ? ` ${k}` : ` ${k}="${v.replace(/"/g, '&quot;')}"`)).join('')}>`;
  }
}

function casa(sel: string, tag: string, attrs: [string, string | null][]): boolean {
  const m = sel.trim().match(/^([a-zA-Z0-9-]+|\*)?(?:\[([a-zA-Z0-9_:-]+)(?:="([^"]*)")?\])?$/);
  if (!m) throw new Error(`HTMLRewriter do kart-edge: seletor não suportado: ${sel}`);
  if (m[1] && m[1] !== '*' && m[1].toLowerCase() !== tag) return false;
  if (m[2]) {
    const a = attrs.find(([k]) => k === m[2].toLowerCase());
    if (!a) return false;
    if (m[3] !== undefined && (a[1] ?? '') !== m[3]) return false;
  }
  return true;
}

export class HTMLRewriter {
  private regras: [string, Handler][] = [];
  on(seletor: string, h: Handler): this { this.regras.push([seletor, h]); return this; }
  onDocument(): this { return this; }

  transform(r: Response): Response {
    const regras = this.regras;
    const corpo = (async () => {
      let html = await r.text();
      const tags = [...html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>"'/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g)];
      // de trás para frente, para os índices continuarem válidos
      for (let i = tags.length - 1; i >= 0; i--) {
        const t = tags[i];
        const tag = t[1].toLowerCase();
        const attrs: [string, string | null][] = [...t[2].matchAll(/([^\s=>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
          .map((a) => [a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? null]);
        const aplicaveis = regras.filter(([s]) => casa(s, tag, attrs));
        if (!aplicaveis.length) continue;
        const el = new Elemento(tag, attrs);
        for (const [, h] of aplicaveis) await h.element?.(el);
        const ini = t.index!;
        let fimTag = ini + t[0].length;
        let interno = '';
        const fechamento = `</${tag}>`;
        const pos = t[3] ? -1 : html.toLowerCase().indexOf(fechamento, fimTag);
        const temFim = pos >= 0 && !['img', 'br', 'meta', 'link', 'input', 'hr', 'source'].includes(tag);
        if (temFim) { interno = html.slice(fimTag, pos); fimTag = pos + fechamento.length; }
        const novo = el.removido ? '' : el.antes + el.abertura() + el.inicio + (el.interno ?? interno) + el.fim + (temFim ? fechamento : '') + el.depois;
        html = html.slice(0, ini) + novo + html.slice(fimTag);
      }
      return html;
    })();
    const h = new Headers(r.headers);
    h.delete('content-length');
    return new Response(new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(await corpo)); c.close(); } }), { status: r.status, statusText: r.statusText, headers: h });
  }
}

/**
 * Atribuição de campanha (Fase 6 do Kartódromo OS): de onde veio quem reservou pelo site.
 *
 * Um cookie só, no domínio inteiro (`.kartodromodebetim.com.br`), escrito por quem recebe a visita — o site
 * institucional (script injetado pelo worker do site) e a página de reservas (`apps/reservas`) — e lido pelo
 * worker do cadastro ao criar o pedido (o `/api/reservas` é do mesmo domínio, então o cookie chega sozinho).
 *
 * - `kib_atr`: o último toque com parâmetro de campanha (UTM, fbclid, gclid, ctwa_clid), por 90 dias. Visita sem
 *   parâmetro não apaga o toque anterior.
 * - `_fbp` / `_fbc`: os cookies que a Meta usa para casar o evento do servidor com quem clicou no anúncio. `_fbc`
 *   nasce do `fbclid`; `_fbp` é criado se ainda não existir (sem pixel no site, é ele que identifica o navegador).
 *
 * O código do navegador é texto (`CODIGO_NAVEGADOR`): uma fonte só para o site e para a página de reservas.
 */

export const COOKIE_ATRIBUICAO = 'kib_atr';
export const CHAVES_DE_CAMPANHA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'gbraid', 'wbraid', 'ctwa_clid'] as const;
export type ChaveDeCampanha = (typeof CHAVES_DE_CAMPANHA)[number];

export type Toque = Partial<Record<ChaveDeCampanha, string>> & {
  /** caminho onde a pessoa chegou (sem a busca) */
  pagina?: string;
  /** domínio de onde veio (document.referrer), se for de fora */
  origem?: string;
  /** quando (ms desde 1970) */
  em?: number;
};

export type AtribuicaoDoPedido = {
  toque: Toque | null;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  navegador: string | null;
};

/**
 * O código que roda no navegador, como TEXTO: é a fonte única. O worker do site o injeta no `<head>`
 * (`SCRIPT_ATRIBUICAO`) e a página de reservas o executa (`capturarNoNavegador`). Não é uma função TS com
 * `toString()` porque o build do kart-edge usa `keepNames`, que embrulha funções internas em `__name(...)` — um
 * nome que não existe no navegador. Recebe `w` (a janela). Grava o toque com parâmetro de campanha e garante
 * `_fbp`/`_fbc`. Nunca lança.
 */
export const CODIGO_NAVEGADOR = `try {
  var chaves = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','gbraid','wbraid','ctwa_clid'];
  var doc = w.document, host = w.location.hostname, nosso = /(^|\\.)kartodromodebetim\\.com\\.br$/;
  var dominio = nosso.test(host) ? '; domain=.kartodromodebetim.com.br' : '';
  var seguro = w.location.protocol === 'https:' ? '; secure' : '';
  var gravar = function (nome, valor) { doc.cookie = nome + '=' + valor + '; path=/; max-age=7776000; samesite=lax' + dominio + seguro; };
  var ler = function (nome) { var m = doc.cookie.match(new RegExp('(?:^|; )' + nome + '=([^;]*)')); return m ? m[1] : null; };
  var agora = Date.now(), busca = new URLSearchParams(w.location.search), toque = {}, n = 0;
  for (var i = 0; i < chaves.length; i++) { var v = (busca.get(chaves[i]) || '').trim(); if (v) { toque[chaves[i]] = v.slice(0, 200); n++; } }
  if (n) {
    toque.pagina = w.location.pathname.slice(0, 120);
    try { var ref = doc.referrer ? new URL(doc.referrer).hostname : ''; if (ref && !nosso.test(ref)) toque.origem = ref.slice(0, 120); } catch (e) {}
    toque.em = agora;
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(toque)))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    if (b64.length < 1800) gravar('kib_atr', b64);
  }
  var fbclid = busca.get('fbclid');
  if (fbclid) gravar('_fbc', 'fb.1.' + agora + '.' + fbclid.slice(0, 500));
  if (!ler('_fbp')) gravar('_fbp', 'fb.1.' + agora + '.' + Math.floor(1e9 + Math.random() * 9e9));
} catch (e) {}`;

/** Executa o código do navegador na janela dada (página de reservas e testes). */
export function capturarNoNavegador(w: Window): void {
  try {
    new Function('w', CODIGO_NAVEGADOR)(w);
  } catch {
    /* atribuição nunca atrapalha a página */
  }
}

/** O mesmo código, para o worker do site injetar no `<head>`. */
export const SCRIPT_ATRIBUICAO = `<script>(function (w) {${CODIGO_NAVEGADOR}})(window);</script>`;

// ------------------------------------------------------------------------------------------------ servidor

function lerCookies(cabecalho: string | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const parte of (cabecalho ?? '').split(/;\s*/)) {
    const i = parte.indexOf('=');
    if (i > 0) m.set(parte.slice(0, i).trim(), parte.slice(i + 1).trim());
  }
  return m;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/** Decodifica e LIMPA o toque do cookie: só as chaves conhecidas, só texto, com teto. Cookie estranho vira null. */
export function decodificarToque(valor: string | null | undefined): Toque | null {
  if (!valor || valor.length > 2000) return null;
  try {
    const b64 = valor.replace(/-/g, '+').replace(/_/g, '/');
    const bruto = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(bruto) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return null;
    const t: Toque = {};
    for (const k of CHAVES_DE_CAMPANHA) {
      const v = texto(o[k], 200);
      if (v) t[k] = v;
    }
    const pagina = texto(o.pagina, 120);
    if (pagina) t.pagina = pagina;
    const origem = texto(o.origem, 120);
    if (origem) t.origem = origem;
    if (typeof o.em === 'number' && Number.isFinite(o.em)) t.em = o.em;
    return Object.keys(t).some((k) => (CHAVES_DE_CAMPANHA as readonly string[]).includes(k)) ? t : null;
  } catch {
    return null;
  }
}

const FBP_FBC = /^fb\.\d\.\d{10,16}\.[\w.-]{1,500}$/;

/** O que o worker grava no pedido: o toque, os cookies da Meta, o IP e o navegador de quem reservou. */
export function atribuicaoDaRequisicao(req: Request): AtribuicaoDoPedido {
  const c = lerCookies(req.headers.get('cookie'));
  const fbp = c.get('_fbp') ?? null;
  const fbc = c.get('_fbc') ?? null;
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim();
  return {
    toque: decodificarToque(c.get(COOKIE_ATRIBUICAO)),
    fbp: fbp && FBP_FBC.test(fbp) ? fbp : null,
    fbc: fbc && FBP_FBC.test(fbc) ? fbc : null,
    ip: ip && ip.length <= 45 ? ip : null,
    navegador: texto(req.headers.get('user-agent'), 400) ?? null,
  };
}

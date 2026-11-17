/**
 * Vira um hostname do Worker (domínio próprio da Cloudflare) para a VPS (registro A com proxy) — ou volta.
 * Uso: CF_TOKEN=... CF_ACCOUNT=... node virar-hostname.mjs vps   <hostname>...
 *      CF_TOKEN=... CF_ACCOUNT=... node virar-hostname.mjs worker <hostname>=<worker>...   (rollback)
 * O estado anterior (worker de cada hostname) é impresso para o rollback.
 */
const T = process.env.CF_TOKEN, A = process.env.CF_ACCOUNT, ZONA = 'b10bc7d100cd6e531702df35f1028361', VPS = '187.53.120.50';
const cf = (p, init = {}) => fetch(`https://api.cloudflare.com/client/v4${p}`, { ...init, headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json', ...(init.headers || {}) } }).then(async (r) => { const t = await r.text(); return t ? JSON.parse(t) : { success: r.ok }; });
const [modo, ...alvos] = process.argv.slice(2);

const dominios = (await cf(`/accounts/${A}/workers/domains`)).result ?? [];
for (const alvo of alvos) {
  const [host, worker] = alvo.split('=');
  const registros = (await cf(`/zones/${ZONA}/dns_records?name=${host}`)).result ?? [];
  if (modo === 'vps') {
    const d = dominios.find((x) => x.hostname === host);
    if (d) {
      const r = await cf(`/accounts/${A}/workers/domains/${d.id}`, { method: 'DELETE' });
      console.log(host, 'domínio do worker removido:', d.service, r.success ?? 'ok');
    }
    await new Promise((ok) => setTimeout(ok, 1500));
    const restantes = (await cf(`/zones/${ZONA}/dns_records?name=${host}`)).result ?? [];
    for (const x of restantes.filter((x) => ['A', 'AAAA', 'CNAME'].includes(x.type) && x.content !== VPS)) {
      await cf(`/zones/${ZONA}/dns_records/${x.id}`, { method: 'DELETE' });
      console.log(host, 'registro removido', x.type, x.content);
    }
    if (!restantes.some((x) => x.type === 'A' && x.content === VPS)) {
      const c = await cf(`/zones/${ZONA}/dns_records`, { method: 'POST', body: JSON.stringify({ type: 'A', name: host, content: VPS, proxied: true, ttl: 1, comment: 'kart-edge na VPS (Fase 4)' }) });
      console.log(host, '-> VPS (A proxied):', c.success, JSON.stringify(c.errors ?? []));
    }
  } else if (modo === 'worker') {
    for (const x of registros.filter((x) => x.type === 'A' && x.content === VPS)) await cf(`/zones/${ZONA}/dns_records/${x.id}`, { method: 'DELETE' });
    const r = await cf(`/accounts/${A}/workers/domains`, { method: 'PUT', body: JSON.stringify({ hostname: host, service: worker, environment: 'production', zone_id: ZONA }) });
    console.log(host, '-> worker', worker, r.success, JSON.stringify(r.errors ?? []));
  }
}

export function categoriaDoKart(kart: unknown): 'Indoor' | 'Super Kart' | null {
  const value = String(kart ?? '').trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const number = Number(value);
  return number <= 99 ? 'Indoor' : number <= 199 ? 'Super Kart' : null;
}

export function normalizarTracado(value: unknown) {
  return String(value ?? '').replace(/\s*·\s*Super\s*Kart\s*$/i, '').replace(/\s+normal$/i, '').trim();
}

/** Categoria da volta: número do kart (1-99 Indoor, 100-199 Super Kart); sem kart, o traçado "· Super Kart" ou a categoria publicada. */
export function categoriaDaVolta(l: { kart?: string | null; categoria?: string | null; tracado?: string | null }): 'Indoor' | 'Super Kart' | null {
  const doKart = categoriaDoKart(l.kart);
  if (doKart) return doKart;
  if (/super\s*kart/i.test(String(l.tracado ?? ''))) return 'Super Kart';
  const c = String(l.categoria ?? '');
  return /super\s*kart/i.test(c) ? 'Super Kart' : /indoor/i.test(c) ? 'Indoor' : null;
}

/** Volta mínima possível: no Traçado 1, Indoor não faz menos de 1:10.000 e Super Kart não faz menos de 1:04.000. Abaixo disso é outro traçado ou corte. */
export function pisoDoTracado(tracado: string, categoria: string | null): number {
  if (!/^tra[cç]ado\s+1$/i.test(normalizarTracado(tracado))) return 0;
  return categoria === 'Indoor' ? 70_000 : 64_000; // sem categoria conhecida, vale o menor dos dois
}

export type LinhaCompleta = { id?: string | null; nome: string; kart?: string | null; categoria?: string | null; tracado: string; dia: string; ms: number };

export function montarRanking(origem: LinhaCompleta[], url: URL) {
  const categoria = (url.searchParams.get('categoria') ?? '').toLowerCase().replace(/\s/g, '');
  const normalizadas = origem.filter(l => Number.isFinite(l.ms) && l.ms > 0).map(l => ({ ...l,
    tracado: normalizarTracado(l.tracado),
    categoria: categoriaDaVolta(l),
  })).filter(l => l.ms >= pisoDoTracado(l.tracado, l.categoria));
  const dias = [...new Set(normalizadas.map(l => l.dia))].sort().reverse();
  const dia = url.searchParams.get('dia');
  const filtradas = normalizadas.filter(l => (!dia || l.dia === dia) && (!categoria || categoria === 'todos' || l.categoria?.toLowerCase().replace(/\s/g, '') === categoria));
  const melhores = (linhas: typeof filtradas) => {
    const porPiloto = new Map<string, (typeof filtradas)[number]>();
    for (const l of linhas) {
      const chave = l.id ? 'id:' + l.id : 'nome:' + l.nome.trim().toLowerCase();
      const atual = porPiloto.get(chave);
      if (!atual || l.ms < atual.ms || (l.ms === atual.ms && l.dia > atual.dia)) porPiloto.set(chave, l);
    }
    return [...porPiloto.values()].sort((a, b) => a.ms - b.ms || a.nome.localeCompare(b.nome));
  };
  const tracados = [...new Set(filtradas.map(l => l.tracado))].filter(Boolean)
    .map(nome => ({ nome, pilotos: melhores(filtradas.filter(l => l.tracado === nome)).length }))
    .sort((a, b) => b.pilotos - a.pilotos || a.nome.localeCompare(b.nome));
  const tracado = url.searchParams.has('tracado') ? normalizarTracado(url.searchParams.get('tracado')) : tracados[0]?.nome ?? null;
  const todas = melhores(filtradas.filter(l => l.tracado === tracado));
  return { dias, tracados, tracado, total: todas.length, linhas: todas.slice(0, 100).map((l, i) => ({ ...l, id: l.id ?? null, pos: i + 1 })) };
}

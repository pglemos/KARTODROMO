/**
 * O que o servidor está fazendo agora (13/11/2026): o detector de travamento do event loop (services/ops-server.ts)
 * só dizia "travado por N ms". Cada tarefa periódica, tarefa do app e requisição HTTP se registra aqui enquanto roda;
 * no aviso de travamento sai a lista, e a culpada aparece por repetição.
 */
const ativos = new Map<number, { nome: string; desde: number }>();
let seq = 0;

/** Registra `nome` enquanto a promessa roda. */
export function emCurso<T>(nome: string, p: Promise<T>): Promise<T> {
  const id = ++seq;
  ativos.set(id, { nome, desde: Date.now() });
  return p.finally(() => ativos.delete(id));
}

/** "pedidos 3,2s · http GET /api/office/agenda 0,1s" (as mais antigas primeiro, no máximo 8). */
export function descreverAndamento(agora = Date.now()) {
  const lista = [...ativos.values()].sort((a, b) => a.desde - b.desde).slice(0, 8);
  return lista.length ? lista.map((a) => `${a.nome} ${((agora - a.desde) / 1000).toFixed(1).replace('.', ',')}s`).join(' · ') : 'nada registrado';
}

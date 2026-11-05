import { randomUUID } from 'node:crypto';
import type { AppStore } from './store';
type Registro = { iniciadoEm: string; concluidoEm: string | null; quantidadeKarts: number };
export function tempoGalpao(store: AppStore, bateria: string, etapa: {
  atualizar: boolean; podeIniciar?: boolean; todosAptos: boolean; concluido: boolean; quantidade: number;
}, agora = new Date()) {
  let registro = store.db.prepare('SELECT iniciadoEm, concluidoEm, quantidadeKarts FROM tempos_galpao WHERE bateria = ?').get(bateria) as Registro | undefined;
  // Sem registro anterior, uma bateria já pronta não oferece um início confiável para medir.
  if (!registro && etapa.concluido) return null;
  if (etapa.atualizar && (registro || (etapa.todosAptos && etapa.podeIniciar !== false))) {
    const em = agora.toISOString();
    const concluidoEm = etapa.todosAptos && etapa.concluido ? registro?.concluidoEm ?? em : null;
    const proximo = { iniciadoEm: registro?.iniciadoEm ?? em, concluidoEm, quantidadeKarts: etapa.quantidade };
    const acao = !registro ? 'galpao-start' : !registro.concluidoEm && concluidoEm ? 'galpao-complete' : registro.concluidoEm && !concluidoEm ? 'galpao-reopen' : null;
    store.transacao(() => {
      store.db.prepare('INSERT OR REPLACE INTO tempos_galpao VALUES (?, ?, ?, ?)').run(bateria, proximo.iniciadoEm, proximo.concluidoEm, proximo.quantidadeKarts);
      if (acao) store.db.prepare(`INSERT INTO auditoria (auditId, sessionId, timestampServerUTC, action, after, status, sourceSystem) VALUES (?, ?, ?, ?, ?, 'APPLIED', 'app-v1')`)
        .run(randomUUID(), bateria, em, acao, JSON.stringify(proximo));
    });
    registro = proximo;
  }
  if (!registro) return null;
  return { ...registro, decorridoMs: Math.max(0, new Date(registro.concluidoEm ?? agora).getTime() - new Date(registro.iniciadoEm).getTime()) };
}

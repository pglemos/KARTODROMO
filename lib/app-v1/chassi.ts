import { ErroApp } from './comandos';
import type { AppStore } from './store';

export function chassisFrota(store: AppStore): Record<string, string> {
  return Object.fromEntries((store.db.prepare('SELECT kart, chassi FROM karts_chassi').all() as { kart: string; chassi: string }[]).map(c => [c.kart, c.chassi]));
}

export function gravarChassi(store: AppStore, kart: string, valor: unknown, usuario: string, cadastrados?: string[]) {
  if (!/^\d{1,3}$/.test(kart) || (cadastrados && !cadastrados.includes(kart))) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe um kart cadastrado com até três dígitos.');
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > 80 || /\p{Cc}/u.test(valor)) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe a identificação do chassi com até 80 caracteres.');
  const chassi = valor.trim();
  store.transacao(() => {
    store.db.prepare('INSERT OR REPLACE INTO karts_chassi (kart, chassi, atualizadoPor, atualizadoEm) VALUES (?, ?, ?, ?)').run(kart, chassi, usuario, new Date().toISOString());
    store.subirRevisao('frota');
  });
  return { kart, chassi };
}

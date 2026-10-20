import { describe, expect, it } from 'vitest';
import { closeSession, createSession, startSession } from '../../lib/timing/race-engine';
import { serializeMobilePublication } from '../../lib/timing/mobile-results';

// Publicação automática no app (3 min depois de encerrar): quem correu sem cadastro fica de fora, o resto vai.
function bateria(competitors: { kart: string; name: string; customerId?: string }[]) {
  const s = createSession({ id: 'auto', name: 'BATERIA 19:20 · CORRIDA', type: 'corrida', durationMin: 10, now: 0, competitors });
  startSession(s, 1_000);
  closeSession(s, 60_000);
  return s;
}

describe('resultado automático no app', () => {
  it('ignora quem não tem cadastro e mantém os outros', () => {
    const s = bateria([{ kart: '4', name: 'Ana Silva', customerId: '10' }, { kart: '5', name: 'Kart 5' }, { kart: '6', name: 'Bia Souza', customerId: '11' }]);
    const p = serializeMobilePublication(s, 'publish', { ignorarSemCadastro: true });
    expect(p.results?.map((r) => r.customerId).sort()).toEqual(['10', '11']);
    expect(p.results?.every((r) => r.position >= 1)).toBe(true);
  });

  it('pelo menu continua exigindo todos vinculados', () => {
    const s = bateria([{ kart: '4', name: 'Ana Silva', customerId: '10' }, { kart: '5', name: 'Kart 5' }]);
    expect(() => serializeMobilePublication(s, 'publish')).toThrow('Vincule todos os pilotos');
  });

  it('sem nenhum piloto com cadastro não publica', () => {
    const s = bateria([{ kart: '5', name: 'Kart 5' }]);
    expect(() => serializeMobilePublication(s, 'publish', { ignorarSemCadastro: true })).toThrow('Nenhum piloto');
  });
});

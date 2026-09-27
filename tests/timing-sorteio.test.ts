import { describe, expect, it } from 'vitest';
import { createSession, mesmoPrograma, setCompetitors, type Session } from '../lib/timing/race-engine';
import { competidoresComSorteio, pilotosDoSorteio, validarSorteio } from '../lib/timing/sorteio';

const DIA = Date.UTC(2026, 8, 27, 15, 0, 0);

function bateria(id: string, competitors: { kart: string; name: string; customerId?: string | null }[], extra: Partial<Session> = {}): Session {
  const s = createSession({ id, name: id, type: 'corrida', durationMin: 20, now: DIA, competitors });
  return Object.assign(s, extra);
}

describe('sorteio de karts', () => {
  it('lista os pilotos com os karts que já usaram hoje (locação) e ignora karts sem piloto', () => {
    const antes = bateria('b1', [{ kart: '12', name: 'Ana', customerId: '10' }, { kart: '7', name: 'Bruno' }], { state: 'encerrada' });
    const outroDia = bateria('b0', [{ kart: '30', name: 'Ana', customerId: '10' }], { state: 'encerrada', createdAt: DIA - 86_400_000 });
    const agora = bateria('b2', [{ kart: '', name: 'Ana', customerId: '10' }, { kart: '', name: 'bruno ' }, { kart: '9', name: 'Kart 9' }]);
    const pilotos = pilotosDoSorteio(agora, [antes, outroDia, agora], mesmoPrograma);
    expect(pilotos).toEqual([
      { indice: 0, nome: 'Ana', customerId: '10', kartAtual: '', excecoes: ['12'] },
      { indice: 1, nome: 'bruno', customerId: null, kartAtual: '', excecoes: ['7'] },
    ]);
  });

  it('em evento só conta as baterias do mesmo evento; tomada de tempo do mesmo programa não conta', () => {
    const tomada = bateria('t', [{ kart: '5', name: 'Ana' }], { state: 'encerrada', eventId: 'ev', programaId: 'p1' });
    const outroEvento = bateria('x', [{ kart: '6', name: 'Ana' }], { state: 'encerrada', eventId: 'outro' });
    const bateria1 = bateria('r1', [{ kart: '8', name: 'Ana' }], { state: 'encerrada', eventId: 'ev' });
    const corrida = bateria('c', [{ kart: '5', name: 'Ana' }], { eventId: 'ev', programaId: 'p1' });
    expect(pilotosDoSorteio(corrida, [tomada, outroEvento, bateria1, corrida], mesmoPrograma)[0].excecoes).toEqual(['8']);
  });

  it('valida o resultado antes de gravar', () => {
    const s = bateria('b', [{ kart: '', name: 'Ana' }, { kart: '', name: 'Bia' }]);
    const karts = new Set(['1', '2', '3']);
    expect(() => validarSorteio(s, [{ indice: 0, kart: '1' }, { indice: 1, kart: '2' }], karts)).not.toThrow();
    expect(() => validarSorteio(s, [{ indice: 0, kart: '1' }, { indice: 1, kart: '1' }], karts)).toThrow(/dois pilotos/);
    expect(() => validarSorteio(s, [{ indice: 0, kart: '9' }], karts)).toThrow(/transponder/);
    expect(() => validarSorteio(s, [{ indice: 5, kart: '1' }], karts)).toThrow(/não está nessa bateria/);
    expect(() => validarSorteio(s, [], karts)).toThrow(/vazio/);
    s.state = 'em_andamento';
    expect(() => validarSorteio(s, [{ indice: 0, kart: '1' }], karts)).toThrow(/já largou/);
  });

  it('aplica o sorteio sem perder o cliente e tira o kart de quem ficou com um número sorteado para outro', () => {
    const s = bateria('b', [{ kart: '', name: 'Ana', customerId: '10' }, { kart: '4', name: 'Bia', customerId: '11' }, { kart: '', name: 'Caio' }]);
    setCompetitors(s, competidoresComSorteio(s, [{ indice: 0, kart: '4' }, { indice: 2, kart: '15' }]));
    expect(s.competitors.map((c) => [c.name, c.kart, c.customerId])).toEqual([['Ana', '4', '10'], ['Bia', '', '11'], ['Caio', '15', null]]);
  });
});

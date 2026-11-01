import { categoriaDe, conquistasDe, iniciais, nomeBonito, xpDe } from '../src/features/ranking/gamificacao';
import { formatarVolta } from '../src/features/ranking/api';

const carreira = { id: '1', nome: 'BERNARDO DA SILVA', baterias: 19, corridas: 7, voltas: 239, vitorias: 2, podios: 3, poles: 6, voltasMaisRapidas: 8,
  primeira: '2026-09-06', ultima: '2026-10-18', recentes: [], atualizadoEm: '',
  tracados: [{ nome: 'Traçado 1', ms: 60836, dia: '2026-10-18', corridas: 5, semana: { pos: 1, de: 229 }, mes: null, geral: { pos: 4, de: 5954 } }] };

describe('gamificação do ranking real', () => {
  it('soma o XP pelas regras publicadas e acha a categoria', () => {
    expect(xpDe(carreira)).toBe(19 * 50 + 3 * 50 + 2 * 100 + 6 * 50 + 8 * 50);
    expect(categoriaDe(2000).nome).toBe('SEMI-PRO');
    expect(categoriaDe(0).nome).toBe('NOVATO');
    expect(categoriaDe(99999)).toMatchObject({ nome: 'LENDA', proxima: null, progresso: 1 });
  });
  it('libera conquistas só com os números reais', () => {
    const c = Object.fromEntries(conquistasDe(carreira).map((x) => [x.id, x.liberada]));
    expect(c).toMatchObject({ estreia: true, frequente: true, veterano: false, vitoria: true, campeao: false, top10: true });
  });
  it('formata nome, iniciais e volta', () => {
    expect(nomeBonito('BERNARDO DA SILVA')).toBe('Bernardo da Silva');
    expect(iniciais('Bernardo da Silva')).toBe('BS');
    expect(formatarVolta(60836)).toBe('1:00.836');
    expect(formatarVolta(54193)).toBe('54.193');
  });
});

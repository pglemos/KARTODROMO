import { describe, it, expect } from 'vitest';

describe('Admin - Modal de Reserva em Grupo (UI/UX Pro Max)', () => {
  const nomeBonito = (n: string) =>
    String(n || '')
      .trim()
      .toLowerCase()
      .replace(/(^|[\s'\(\[\-])([\p{L}])/gu, (_, a, b) => a + b.toUpperCase())
      .replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (x) => x.toLowerCase());

  const formatarTelefone = (v: string) => {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  it('deve formatar nomes em Title Case com tratamento para partículas, parênteses e sobrenomes', () => {
    expect(nomeBonito('eduardo (sem sobrenome)')).toBe('Eduardo (Sem Sobrenome)');
    expect(nomeBonito('ISRAEL FELIPE')).toBe('Israel Felipe');
    expect(nomeBonito('BERNARDO SA DOS SANTOS')).toBe('Bernardo Sa dos Santos');
    expect(nomeBonito('MATHEUS XAVIER')).toBe('Matheus Xavier');
    expect(nomeBonito('piloto 7')).toBe('Piloto 7');
  });

  it('deve aplicar máscara telefônica brasileira corretamente (fixo ou celular)', () => {
    // 10 dígitos (sem 9º dígito ou fixo)
    expect(formatarTelefone('3194060444')).toBe('(31) 9406-0444');
    // 11 dígitos (celular atual)
    expect(formatarTelefone('31989012098')).toBe('(31) 98901-2098');
    expect(formatarTelefone('31991348690')).toBe('(31) 99134-8690');
    // Entrada com prefixo DDI +55
    expect(formatarTelefone('+55 (31) 98901-2098')).toBe('(31) 98901-2098');
    expect(formatarTelefone('553194060444')).toBe('(31) 9406-0444');
    // Vazio
    expect(formatarTelefone('')).toBe('');
  });

  it('deve organizar pendências de pagamento sem muro corrido de texto', () => {
    const pilotos = [
      { id: 1, nome: 'eduardo (sem sobrenome)', ordem: 1, pago: false, falta_centavos: 14500 },
      { id: 2, nome: 'ISRAEL FELIPE', ordem: 2, pago: false, falta_centavos: 14500 },
      { id: 3, nome: 'EDUARDO SA', ordem: 3, pago: true, falta_centavos: 0 },
      { id: 4, nome: 'ENRICO GOMES DE SA', ordem: 4, pago: true, falta_centavos: 0 },
      { id: 5, nome: 'BERNARDO SA DOS SANTOS', ordem: 5, pago: false, falta_centavos: 14500 },
      { id: 6, nome: 'MATHEUS XAVIER', ordem: 6, pago: false, falta_centavos: 14500 },
      { id: 7, nome: '', ordem: 7, pago: false, falta_centavos: 14500 },
      { id: 8, nome: '', ordem: 8, pago: false, falta_centavos: 14500 },
      { id: 9, nome: '', ordem: 9, pago: false, falta_centavos: 14500 },
      { id: 10, nome: '', ordem: 10, pago: false, falta_centavos: 14500 },
      { id: 11, nome: '', ordem: 11, pago: false, falta_centavos: 14500 },
      { id: 12, nome: '', ordem: 12, pago: false, falta_centavos: 14500 },
      { id: 13, nome: '', ordem: 13, pago: false, falta_centavos: 14500 },
      { id: 14, nome: '', ordem: 14, pago: false, falta_centavos: 14500 },
      { id: 15, nome: '', ordem: 15, pago: false, falta_centavos: 14500 },
    ];

    const pendentes = pilotos.filter((p) => !p.pago);
    expect(pendentes.length).toBe(13);

    // Os primeiros 6 recebem chips individuais limpos
    const primeirosChips = pendentes.slice(0, 6).map((p) => nomeBonito(p.nome) || 'Piloto ' + p.ordem);
    expect(primeirosChips).toEqual([
      'Eduardo (Sem Sobrenome)',
      'Israel Felipe',
      'Bernardo Sa dos Santos',
      'Matheus Xavier',
      'Piloto 7',
      'Piloto 8',
    ]);

    // O excedente é agrupado elegantemente
    const restantesCount = pendentes.length - 6;
    expect(restantesCount).toBe(7);
  });

  it('deve mapear os chips de totem sem valores cinza vazios ou truncados', () => {
    const chipCad = (p: { cadastro: string; falta?: string[] }) =>
      ({
        completo: ['verde', 'Pronto para o totem'],
        incompleto: ['laranja', 'Falta ' + (p.falta || []).join(', ')],
        enviado: ['laranja', 'Aguardando cadastro'],
        pendente: ['laranja', 'Aguardando cadastro'],
      }[p.cadastro] || ['laranja', p.cadastro || 'Aguardando cadastro']);

    expect(chipCad({ cadastro: 'completo' })).toEqual(['verde', 'Pronto para o totem']);
    expect(chipCad({ cadastro: 'incompleto', falta: ['CPF', 'e-mail', 'peso'] })).toEqual([
      'laranja',
      'Falta CPF, e-mail, peso',
    ]);
    expect(chipCad({ cadastro: 'enviado' })).toEqual(['laranja', 'Aguardando cadastro']);
    expect(chipCad({ cadastro: 'pendente' })).toEqual(['laranja', 'Aguardando cadastro']);
    expect(chipCad({ cadastro: '' })).toEqual(['laranja', 'Aguardando cadastro']);
  });
});

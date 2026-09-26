import { describe, expect, it } from 'vitest';
import { renderTermoResponsabilidade, type TermoParticipante } from '../../lib/ops/termo';

const participante: TermoParticipante = {
  nome: 'Ana Exemplo <Pilota>',
  documento: '123.456.789-00',
  nascimento: '2001-12-31',
  email: 'ana@example.test',
  telefone: '(31) 90000-0000',
  cep: '30000-000',
  endereco: 'Rua de Exemplo',
  numero: '12',
  complemento: 'Casa',
  bairro: 'Centro',
  cidade: 'Betim',
  responsavelNome: null,
  responsavelDocumento: null,
  responsavelTelefone: null,
  responsavelEmail: null,
};

const empresa = {
  nome: 'Kartódromo Betim',
  razaoSocial: 'Kartódromo Internacional de Betim Ltda',
  cidade: 'Betim',
};

const impressoEm = new Date('2026-05-20T13:39:00.000Z');

describe('termo de responsabilidade em bobina', () => {
  it('reproduz os campos e as cláusulas do termo de referência em 80 mm', () => {
    const html = renderTermoResponsabilidade({ empresa, participantes: [participante], impressoEm });

    expect(html).toContain('@page{size:80mm 297mm;margin:0}');
    expect(html).toContain('/ui/kib-logo.png');
    expect(html).not.toContain('rule-profile');
    expect(html).toContain('Nome: Ana Exemplo &lt;Pilota&gt;');
    expect(html).toContain('Nascimento: 31/12/2001');
    expect(html).toContain('Endereço: Rua de Exemplo, 12, Casa');
    expect(html).toContain('Bairro: Centro');
    expect(html).toContain('CEP: 30000-000');
    expect(html).toContain('Tel.: (31) 90000-0000');
    expect(html).toContain('E-mail: ana@example.test');
    expect(html).toContain('<strong>Dos equipamentos obrigatórios:</strong>');
    expect(html).toContain('A Kartódromo Internacional de Betim Ltda, administradora do KARTÓDROMO');
    expect(html).not.toContain('<strong>Kartódromo Internacional de Betim Ltda</strong>');
    expect(html).toContain('BETIM, quarta-feira, 20 de maio de 2026, às 10:39');
    expect(html).not.toContain('RASCUNHO');
    expect(html).not.toContain('Reserva nº');
  });

  it('cria uma folha por participante e mantém as linhas do termo em branco', () => {
    const html = renderTermoResponsabilidade({
      empresa,
      participantes: [participante, { ...participante, nome: 'Bia Exemplo' }],
      branco: true,
      impressoEm,
    });

    expect((html.match(/<section class="page">/g) ?? []).length).toBe(2);
    // só o Nome do participante: o rodapé Nome/Tel./Doc./E-mail do responsável saiu
    expect(html.match(/Nome: ________________________/g)?.length).toBe(2);
    expect(html).toContain('Nascimento: ____/____/________');
    expect(html).toContain('Doc.: ________________________');
    expect(html).not.toContain('signature-grid');
  });

  it('traz as assinaturas do participante e do responsável legal, como no LapTime', () => {
    const html = renderTermoResponsabilidade({ empresa, participantes: [participante], impressoEm });

    expect(html).toContain('PARTICIPANTE PILOTO');
    expect(html).toContain('RESPONSÁVEL LEGAL');
    expect(html.indexOf('PARTICIPANTE PILOTO')).toBeGreaterThan(html.indexOf('Declaro ter lido'));
    expect(html).not.toMatch(/position:absolute/);
  });
});

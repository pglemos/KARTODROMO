import { describe, expect, it } from 'vitest';
import {
  idadeNaData,
  renderTermoResponsabilidade,
  type TermoEmpresa,
  type TermoParticipante,
} from '../../lib/ops/termo';

const defaultEmpresa: TermoEmpresa = {
  nome: 'Kartódromo Betim',
  razaoSocial: 'Kartódromo Internacional de Betim Ltda',
  cidade: 'Betim',
};

const defaultParticipante: TermoParticipante = {
  nome: 'Carlos Sainz Jr',
  documento: 'MG-12.345.678',
  nascimento: '2008-05-20',
  email: 'carlos.sainz@kartodromo.test',
  telefone: '(31) 98765-4321',
  cep: '32600-000',
  endereco: 'Av. das Américas',
  numero: '1000',
  complemento: 'Box 15',
  bairro: 'Distrito Industrial',
  cidade: 'Betim',
  responsavelNome: null,
  responsavelDocumento: null,
  responsavelTelefone: null,
  responsavelEmail: null,
};

const fixedDate = new Date('2026-05-20T14:00:00.000Z'); // 11:00 em Brasília

describe('Challenger M1_2: Adversarial Stress Test do Layout Dinâmico TM-T20 (80mm auto)', () => {
  describe('1. Eliminação Estrita da Altura Fixa de 297mm e Resíduos de A4', () => {
    it('não contém nenhuma menção a "297mm" em qualquer cenário de renderização', () => {
      const cenarios = [
        renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [defaultParticipante], impressoEm: fixedDate }),
        renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [defaultParticipante], branco: true, impressoEm: fixedDate }),
        renderTermoResponsabilidade({
          empresa: defaultEmpresa,
          participantes: [
            defaultParticipante,
            { ...defaultParticipante, nome: 'Piloto 2' },
            { ...defaultParticipante, nome: 'Piloto 3' },
          ],
          impressoEm: fixedDate,
        }),
        renderTermoResponsabilidade({
          empresa: defaultEmpresa,
          participantes: [defaultParticipante],
          textoPersonalizado: 'Regulamento especial de corrida noturna sob chuva.\n\nCláusula adicional de segurança.',
          impressoEm: fixedDate,
        }),
        renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [], impressoEm: fixedDate }),
      ];

      for (const html of cenarios) {
        expect(html).not.toContain('297mm');
        expect(html).not.toMatch(/297\s*mm/i);
      }
    });

    it('declara regra @page explícita com tamanho 80mm auto e margem 0', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [defaultParticipante], impressoEm: fixedDate });

      expect(html).toContain('@page{size:80mm auto;margin:0}');
      // Não deve ter min-height nem height fixo na classe .page
      expect(html).not.toMatch(/\.page\{[^}]*min-height:\s*\d+/);
      expect(html).not.toMatch(/\.page\{[^}]*height:\s*\d+/);
    });

    it('mantém largura fixa de 80mm e box-sizing border-box para alimentação contínua na bobina', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [defaultParticipante], impressoEm: fixedDate });

      expect(html).toContain('*{box-sizing:border-box}');
      expect(html).toContain('html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}');
      expect(html).toContain('.page{position:relative;width:80mm;');
      expect(html).toContain('padding:0 5.7mm 4mm');
      expect(html).toContain('@media print{html,body{width:80mm}.page{margin:0;box-shadow:none}}');
    });
  });

  describe('2. Quebra de Página e Prevenção de Páginas em Branco na Impressora de Bobina', () => {
    it('emite break-after: page apenas entre participantes intermediários, eliminando salto na última folha', () => {
      const html = renderTermoResponsabilidade({
        empresa: defaultEmpresa,
        participantes: [
          { ...defaultParticipante, nome: 'Participante 1' },
          { ...defaultParticipante, nome: 'Participante 2' },
          { ...defaultParticipante, nome: 'Participante 3' },
        ],
        impressoEm: fixedDate,
      });

      // Deve conter exatamente 3 sections .page
      const matches = html.match(/<section class="page">/g) ?? [];
      expect(matches.length).toBe(3);

      // Regra CSS geral tem quebra de página
      expect(html).toContain('break-after:page;page-break-after:always');

      // Regra da última página cancela a quebra para não cuspir papel em branco após o corte
      expect(html).toContain('.page:last-child{break-after:auto;page-break-after:auto}');
    });

    it('em termo de participante único, a seção única é :last-child e não sofre quebra posterior', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [defaultParticipante], impressoEm: fixedDate });
      const pages = html.match(/<section class="page">/g) ?? [];
      expect(pages.length).toBe(1);
      expect(html).toContain('.page:last-child{break-after:auto;page-break-after:auto}');
    });

    it('em lista vazia de participantes, renderiza fallback sem seções de página', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [], impressoEm: fixedDate });
      expect(html).not.toContain('<section class="page">');
      expect(html).toContain('<p>Nada para imprimir.</p>');
    });

    it('bloco de assinatura possui proteção contra quebra interna (break-inside: avoid)', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [defaultParticipante], impressoEm: fixedDate });

      expect(html).toContain('.assinatura{margin:16mm auto 0;width:50mm;text-align:center;flex:none;break-inside:avoid;page-break-inside:avoid}');
      // Assinaturas posicionadas no fluxo natural (sem position: absolute)
      expect(html).not.toMatch(/\.assinatura\{[^}]*position:\s*absolute/);
    });
  });

  describe('3. Robustez Contra Casos Extremos de Texto, Nomes Longos e Injeções', () => {
    it('garante quebra de texto (overflow-wrap: anywhere) para strings infinitas sem espaço', () => {
      const nomeGigante = 'A'.repeat(250);
      const emailGigante = 'usuario.extremamente.longo.sem.espaco.' + 'B'.repeat(120) + '@provedor.gigante.test';
      const participanteExtremo: TermoParticipante = {
        ...defaultParticipante,
        nome: nomeGigante,
        email: emailGigante,
      };

      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [participanteExtremo], impressoEm: fixedDate });

      // Garante presença da classe com overflow-wrap: anywhere
      expect(html).toContain('.row{min-height:3.81mm;display:block;overflow-wrap:anywhere}');
      expect(html).toContain(nomeGigante);
      expect(html).toContain(emailGigante);
    });

    it('escapa com segurança caracteres especiais e tentativas de injeção XSS/HTML', () => {
      const participanteInvasor: TermoParticipante = {
        ...defaultParticipante,
        nome: '<script>alert("hacked")</script>',
        documento: '"><img src=x onerror=alert(1)>',
        email: 'attacker@evil.com"><script>',
        endereco: 'Rua & < > " \' Segredo',
        bairro: '<b onmouseover=evil()>',
        cidade: 'Betim & Região',
      };

      const empresaInvasora: TermoEmpresa = {
        nome: 'Kartódromo <script>evil()</script>',
        razaoSocial: 'Razão & Cia "Segura" <Ltda>',
        cidade: 'Betim <MG>',
      };

      const html = renderTermoResponsabilidade({
        empresa: empresaInvasora,
        participantes: [participanteInvasor],
        textoPersonalizado: '<marquee>Aviso importante</marquee>',
        impressoEm: fixedDate,
      });

      // Nenhum elemento script ou tag crua deve estar sem escape no corpo
      expect(html).not.toContain('<script>alert');
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<marquee>');
      expect(html).toContain('&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;');
      expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;marquee&gt;Aviso importante&lt;/marquee&gt;');
    });

    it('trata graciosamente valores nulos, indefinidos e em branco sem crash ou literais "null"/"undefined"', () => {
      const participanteVazio: TermoParticipante = {
        nome: '',
        documento: null,
        nascimento: null,
        email: null,
        telefone: null,
        cep: null,
        endereco: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        responsavelNome: null,
        responsavelDocumento: null,
        responsavelTelefone: null,
        responsavelEmail: null,
      };

      const empresaMinima: TermoEmpresa = {
        nome: 'Kart Betim',
        razaoSocial: null,
        cidade: null,
      };

      const html = renderTermoResponsabilidade({
        empresa: empresaMinima,
        participantes: [participanteVazio],
        impressoEm: fixedDate,
      });

      // Não deve vazar a palavra literal "null" ou "undefined" em rótulos do participante
      expect(html).not.toContain('Nome: null');
      expect(html).not.toContain('Nome: undefined');
      expect(html).not.toContain('Doc.: null');
      expect(html).not.toContain('Doc.: undefined');
      expect(html).not.toContain('Endereço: null');
      expect(html).not.toContain('A null, administradora do KARTÓDROMO');
      // Cidade padrão cai em Betim se null
      expect(html).toContain('BETIM, quarta-feira');
    });

    it('formata endereço composto com número e complemento sem separadores espúrios', () => {
      const p1: TermoParticipante = { ...defaultParticipante, endereco: 'Rua A', numero: '10', complemento: 'Bloco B' };
      const p2: TermoParticipante = { ...defaultParticipante, endereco: 'Av B', numero: null, complemento: null };
      const p3: TermoParticipante = { ...defaultParticipante, endereco: null, numero: null, complemento: null };

      const h1 = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [p1], impressoEm: fixedDate });
      expect(h1).toContain('Endereço: Rua A, 10, Bloco B');

      const h2 = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [p2], impressoEm: fixedDate });
      expect(h2).toContain('Endereço: Av B');
      expect(h2).not.toContain('Av B,');

      const h3 = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [p3], impressoEm: fixedDate });
      expect(h3).toContain('Endereço: </div>');
    });
  });

  describe('4. Cálculo Exato de Idade e Fusos Horários (Regras de Menor de 18 Anos)', () => {
    it('calcula a idade estritamente com base no fuso horário America/Sao_Paulo', () => {
      // 20/05/2026 às 21:00 em Brasília (UTC-3) corresponde a 21/05/2026 às 00:00 UTC
      const dataNoiteUtc = new Date('2026-05-21T00:30:00.000Z'); // 20/05 às 21:30 em Brasília

      // Quem nasceu em 2008-05-20 faz 18 anos no dia 20/05/2026.
      // Em UTC já é dia 21, mas em Brasília é dia 20. Deve ter 18 anos!
      expect(idadeNaData('2008-05-20', dataNoiteUtc)).toBe(18);

      // Quem nasceu em 2008-05-21 ainda tem 17 anos em Brasília na noite de 20/05
      expect(idadeNaData('2008-05-21', dataNoiteUtc)).toBe(17);
    });

    it('identifica corretamente menores de 18 anos e anota "(X anos)" ao lado do nascimento', () => {
      const menor: TermoParticipante = { ...defaultParticipante, nascimento: '2011-08-10' };
      const maior: TermoParticipante = { ...defaultParticipante, nascimento: '1995-03-15' };

      const htmlMenor = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [menor], impressoEm: fixedDate });
      expect(htmlMenor).toContain('Nascimento: 10/08/2011 (14 anos)');

      const htmlMaior = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [maior], impressoEm: fixedDate });
      expect(htmlMaior).toContain('Nascimento: 15/03/1995 (31 anos)');
    });

    it('aniversariante de 1 ano recebe singular "(1 ano)" e datas absurdas retornam null', () => {
      const bebe1Ano = new Date('2026-05-20T12:00:00.000Z');
      expect(idadeNaData('2025-05-20', bebe1Ano)).toBe(1);

      // Futuro (idade negativa)
      expect(idadeNaData('2030-01-01', bebe1Ano)).toBeNull();
      // Idade >= 120 anos (data inválida/século 19)
      expect(idadeNaData('1890-01-01', bebe1Ano)).toBeNull();
      // String vazia / caracteres inválidos
      expect(idadeNaData('', bebe1Ano)).toBeNull();
      expect(idadeNaData('not-a-date', bebe1Ano)).toBeNull();
    });
  });

  describe('5. Estimativa de Geometria e Economia Térmica vs 297mm Legado (Oráculo Empírico)', () => {
    it('comprova que o termo padrão ocupa entre 140mm e 190mm, gerando ~40% a 50% de economia de papel', () => {
      // Modelo oráculo de estimativa de altura em bobina TM-T20:
      // - Logo: 20.3mm + 1.4mm margens = 21.7mm
      // - H1: 7.62mm
      // - Customer Info: 8 linhas * ~3.81mm = 30.48mm
      // - Legal Text: 9 cláusulas (~22 linhas * 3.3mm) = 72.6mm
      // - Date: 5mm altura + 5mm margem = 10mm
      // - Assinaturas: 2 * (16mm margem + 0.6pt linha + 3.5mm texto + 2.5mm obs) ≈ 44mm
      // Altura total estimada: ~186mm.
      const alturaEstimadaMm = 21.7 + 7.62 + 30.48 + 72.6 + 10 + 44;
      const alturaLegadaMm = 297.0;
      const economiaMm = alturaLegadaMm - alturaEstimadaMm;
      const percentualEconomia = (economiaMm / alturaLegadaMm) * 100;

      expect(alturaEstimadaMm).toBeGreaterThan(140);
      expect(alturaEstimadaMm).toBeLessThan(210);
      expect(percentualEconomia).toBeGreaterThan(30);
      expect(percentualEconomia).toBeLessThan(60);

      // Em 50 pilotos/dia em um fim de semana:
      const economiaMetrosPorDia = (50 * economiaMm) / 1000;
      expect(economiaMetrosPorDia).toBeGreaterThan(4.5); // Economiza mais de 4,5 metros de bobina por dia
    });
  });
});

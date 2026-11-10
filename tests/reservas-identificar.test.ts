import { describe, expect, it } from 'vitest';

describe('funções de máscara e conversão de dados do auto-preenchimento de reservas', () => {
  const dig = (v: string) => String(v || '').replace(/\D/g, '');

  const mascaraCPF = (v: string) => {
    const d = dig(v).slice(0, 11);
    return d.length > 9 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
         : d.length > 6 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
         : d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3)}`
         : d;
  };

  const mascaraFone = (v: string) => {
    const d = dig(v).slice(0, 11);
    return d.length <= 2 ? d.replace(/^(\d{1,2})/, '($1')
         : d.length <= 6 ? d.replace(/^(\d{2})(\d+)/, '($1) $2')
         : d.length <= 10 ? d.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3')
         : d.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  };

  const mascaraData = (v: string) => {
    if (!v) return '';
    let s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }
    const d = dig(s).slice(0, 8);
    return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
         : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}`
         : d;
  };

  const mascaraCEP = (v: string) => {
    const d = dig(v).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  it('formata CPF corretamente', () => {
    expect(mascaraCPF('07357831604')).toBe('073.578.316-04');
    expect(mascaraCPF('123456')).toBe('123.456');
  });

  it('formata celular nacional com DDD', () => {
    expect(mascaraFone('31971502225')).toBe('(31) 97150-2225');
    expect(mascaraFone('3135941234')).toBe('(31) 3594-1234');
  });

  it('converte datas ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/AAAA)', () => {
    expect(mascaraData('1984-11-20')).toBe('20/11/1984');
    expect(mascaraData('2000-01-05')).toBe('05/01/2000');
    expect(mascaraData('20111984')).toBe('20/11/1984');
  });

  it('formata CEP com hífen', () => {
    expect(mascaraCEP('32015410')).toBe('32015-410');
  });

  it('higieniza e adiciona @ no Instagram', () => {
    const formatarInsta = (ig: string) => {
      let s = String(ig || '').trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '');
      return s ? '@' + s.toLowerCase() : '';
    };

    expect(formatarInsta('joseandre')).toBe('@joseandre');
    expect(formatarInsta('@joseandre')).toBe('@joseandre');
    expect(formatarInsta('https://instagram.com/joseandre/')).toBe('@joseandre');
  });
});

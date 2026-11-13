import { describe, expect, it, vi } from 'vitest';
import { conteudoLembrete, lembretesSync, type Lembrete } from '../workers/pre-cadastro/src/lembretes';

const base: Lembrete = { chave: 'pagar-12-202611201900', tipo: 'pagar', para: 'ana@exemplo.com', nome: 'Ana Souza', bateria: 'BATERIA 19:00', inicio: '2026-11-20T19:00',
  link: 'https://www.asaas.com/i/abc123', responsavel: 'Lari', valorCentavos: 14500, soltaEm24h: true };

describe('texto dos lembretes', () => {
  it('falta pagar: nome, dia, valor, prazo das 24h e o link de pagamento', () => {
    const c = conteudoLembrete(base);
    expect(c.subject).toBe('Falta pagar sua vaga no kart · sexta-feira, 20/11 às 19:00');
    expect(c.text).toContain('Oi, Ana!');
    expect(c.text).toMatch(/R\$\s145,00/);
    expect(c.text).toContain('24 horas antes');
    expect(c.html).toContain('https://www.asaas.com/i/abc123');
  });
  it('faltam cadastros: quantidade, link do grupo, painel e botão do WhatsApp', () => {
    const c = conteudoLembrete({ ...base, tipo: 'cadastros', faltam: 3, link: 'https://cadastro.kartodromodebetim.com.br/?r=TOKEN1234567', painel: 'https://cadastro.kartodromodebetim.com.br/painel?g=G1&k=x' });
    expect(c.subject).toBe('Faltam 3 cadastros no seu grupo · sexta-feira, 20/11 às 19:00');
    expect(c.html).toContain('wa.me/?text=');
    expect(c.text).toContain('Veja quem já entrou');
  });
  it('vagas soltas: avisa quem organiza, com link para reservar e o painel', () => {
    const c = conteudoLembrete({ ...base, tipo: 'soltas', faltam: 2, link: 'https://reservas.kartodromodebetim.com.br/', painel: 'https://cadastro.kartodromodebetim.com.br/painel?g=G1&k=x' });
    expect(c.subject).toBe('2 vagas do seu grupo voltaram para venda · sexta-feira, 20/11 às 19:00');
    expect(c.text).toContain('Quem já pagou continua garantido');
    expect(c.text).toContain('\nReservar: https://reservas.kartodromodebetim.com.br');
    expect(c.html).toContain('Reservar mais vagas');
    expect(conteudoLembrete({ ...base, tipo: 'soltas', faltam: 1, link: 'https://reservas.kartodromodebetim.com.br/' }).subject).toMatch(/^1 vaga do seu grupo voltou/);
  });
  it('escapa HTML do nome', () => {
    expect(conteudoLembrete({ ...base, nome: '<b>Ana</b>' }).html).not.toContain('<b>Ana');
  });
});

describe('envio', () => {
  function env() {
    const mem = new Map<string, string>();
    return { mem, env: { PRE: { get: async (k: string) => (mem.has(k) ? {} : null), put: async (k: string, v: string) => { mem.set(k, v); } }, RESEND_API_KEY: 're_x', RESEND_FROM_EMAIL: 'Kart <a@kartodromodebetim.com.br>' } };
  }
  const pedir = (e: unknown, lembretes: unknown[]) => lembretesSync(new Request('https://x', { method: 'POST', body: JSON.stringify({ lembretes }) }), e as never);

  it('cada lembrete sai uma vez só', async () => {
    const { mem, env: e } = env();
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await (await pedir(e, [base])).json()).toMatchObject({ enviados: 1 });
    expect(await (await pedir(e, [base])).json()).toMatchObject({ enviados: 0, jaEnviados: 1 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(mem.has('lembretes/pagar-12-202611201900')).toBe(true);
    f.mockRestore();
  });

  it('recusa link de fora (golpe) e e-mail inválido', async () => {
    const { env: e } = env();
    const f = vi.spyOn(globalThis, 'fetch');
    const r = await (await pedir(e, [{ ...base, link: 'https://golpe.example/pagar' }, { ...base, chave: 'x2-1', para: 'sem-arroba' }])).json();
    expect(r).toMatchObject({ enviados: 0, invalidos: 2 });
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });

  it('falha no envio não marca como enviado (tenta no próximo ciclo)', async () => {
    const { mem, env: e } = env();
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('erro', { status: 500 }));
    const r = (await (await pedir(e, [base])).json()) as { enviados: number };
    expect(r.enviados).toBe(0);
    expect(mem.has('lembretes/pagar-12-202611201900')).toBe(false);
    f.mockRestore();
  });
});

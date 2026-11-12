import { describe, expect, it, vi } from 'vitest';
import { grupoSitePermitido, validarReserva, type Agenda } from '../workers/pre-cadastro/src/validar';
import { syncResultado, visaoPublica, type EnvReservas, type Pedido } from '../workers/pre-cadastro/src/reservas';

// "Cada um paga o seu" criado pelo próprio cliente no site (decisões do dono, 12/11/2026):
// 2 a 10 pilotos, só com 24h ou mais até a bateria, e só os dados de quem organiza no pedido.

const HOJE = new Date('2026-10-01T15:00:00Z'); // 12:00 em Brasília
const agenda: Agenda = {
  atualizadoEm: HOJE.toISOString(), precoCentavos: 14500, maxPilotos: 10, prazoMin: 15, antecedenciaMin: 120, grupoSite: true,
  horarios: [
    { id: 101, inicio: '2026-10-03T09:15', nome: 'BATERIA 09:15', livres: 10 }, // daqui a ~45h
    { id: 103, inicio: '2026-10-01T20:00', nome: 'BATERIA 20:00', livres: 10 }, // daqui a 8h
  ],
};
const organizador = {
  bateriaId: 101, quantidade: 4, forma: 'pix', politica: true, lgpd: true, modo: 'individual',
  documento: '529.982.247-25', nome: 'Maria da Silva', email: 'maria@exemplo.com', instagram: '@maria.silva', telefone: '(31) 98888-7777', nascimento: '1990-05-20', peso: '62',
};

describe('validarReserva no modo cada um paga o seu', () => {
  it('aceita só os dados de quem organiza (os amigos se cadastram pelo link)', () => {
    const v = validarReserva(organizador, agenda, HOJE);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.dados).toMatchObject({ quantidade: 4, modo: 'individual', acompanhantes: [], compradorPilota: true, pilotos: ['Maria da Silva'] });
  });

  it('quem organiza pode não pilotar (paga a garantia)', () => {
    const v = validarReserva({ ...organizador, compradorPilota: false }, agenda, HOJE);
    expect(v.ok && v.dados).toMatchObject({ compradorPilota: false, pilotos: [] });
  });

  it('grupo de 2 a 10 pilotos', () => {
    expect(validarReserva({ ...organizador, quantidade: 1 }, agenda, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/de 2 a 10 pilotos/) });
    expect(validarReserva({ ...organizador, quantidade: 2 }, agenda, HOJE).ok).toBe(true);
  });

  it('bateria com menos de 24h: só "eu pago tudo"', () => {
    expect(validarReserva({ ...organizador, bateriaId: 103 }, agenda, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/24h/) });
  });

  it('sem o modo, continua exigindo o cadastro de cada piloto', () => {
    const { modo: _m, ...normal } = organizador;
    expect(validarReserva(normal, agenda, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/Cadastre os outros 3 pilotos/) });
  });

  it('SRVKART antigo (agenda sem grupoSite): recusa, para não cobrar todas as vagas do organizador', () => {
    expect(validarReserva(organizador, { ...agenda, grupoSite: undefined }, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/ainda não está disponível/) });
  });

  it('grupoSitePermitido: limite exato de 24h', () => {
    const agora = Date.parse('2026-10-01T12:00:00-03:00');
    expect(grupoSitePermitido('2026-10-02T12:00', agora)).toBe(true);
    expect(grupoSitePermitido('2026-10-02T11:59', agora)).toBe(false);
  });
});

describe('links do grupo devolvidos pelo SRVKART', () => {
  function env() {
    const mem = new Map<string, string>();
    const PRE = {
      get: vi.fn(async (k: string) => (mem.has(k) ? { json: async () => JSON.parse(mem.get(k)!) } : null)),
      put: vi.fn(async (k: string, v: string) => { mem.set(k, String(v)); }),
      delete: vi.fn(async (k: string) => { mem.delete(k); }),
      list: vi.fn(async () => ({ objects: [] })),
    };
    return { mem, env: { PRE } as unknown as EnvReservas };
  }
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
  const pedido = (extra: Partial<Pedido> = {}): Pedido => ({
    id: '11111111-2222-3333-4444-555555555555', codigo: 'ABC234', status: 'pago', criadoEm: '', atualizadoEm: '', bateriaId: 101, quantidade: 4, forma: 'pix',
    pilotos: ['Maria da Silva'], acompanhantes: [], compradorPilota: true, modo: 'individual',
    cliente: { nome: 'Maria da Silva', chave: '52998224725' } as Pedido['cliente'], ...extra,
  });
  const confirmar = (e: EnvReservas, grupo: Record<string, unknown>) => syncResultado(new Request('https://x', {
    method: 'POST', body: JSON.stringify([{ id: pedido().id, acao: 'confirmado', codigo: 'ABC234', grupo }]),
  }), e, ctx);

  it('guarda os links e mostra na tela do pedido', async () => {
    const { mem, env: e } = env();
    mem.set(`reservas/pedidos/${pedido().id}.json`, JSON.stringify(pedido()));
    await confirmar(e, { codigo: 'G1A2B3C', link: 'https://cadastro.kartodromodebetim.com.br/?r=TOKENRESP123', painel: 'https://cadastro.kartodromodebetim.com.br/painel?g=G1A2B3C&k=AbCdEfGh12345678' });
    const p = JSON.parse(mem.get(`reservas/pedidos/${pedido().id}.json`)!) as Pedido;
    expect(p.status).toBe('confirmado');
    expect(visaoPublica(p).grupo).toEqual({ codigo: 'G1A2B3C', link: 'https://cadastro.kartodromodebetim.com.br/?r=TOKENRESP123', painel: 'https://cadastro.kartodromodebetim.com.br/painel?g=G1A2B3C&k=AbCdEfGh12345678' });
  });

  it('link de fora do kartódromo é ignorado', async () => {
    const { mem, env: e } = env();
    mem.set(`reservas/pedidos/${pedido().id}.json`, JSON.stringify(pedido()));
    await confirmar(e, { codigo: 'G1', link: 'https://golpe.example/?r=x', painel: 'https://golpe.example/painel' });
    expect(visaoPublica(JSON.parse(mem.get(`reservas/pedidos/${pedido().id}.json`)!)).grupo).toBeNull();
  });

  it('pedido já confirmado sem links recebe os links no ciclo seguinte (grupo criado depois)', async () => {
    const { mem, env: e } = env();
    mem.set(`reservas/pedidos/${pedido().id}.json`, JSON.stringify(pedido({ status: 'confirmado' })));
    await confirmar(e, { codigo: 'G1A2B3C', link: 'https://cadastro.kartodromodebetim.com.br/?r=TOKENRESP123', painel: 'https://cadastro.kartodromodebetim.com.br/painel?g=G1A2B3C&k=AbCdEfGh12345678' });
    expect(visaoPublica(JSON.parse(mem.get(`reservas/pedidos/${pedido().id}.json`)!)).grupo?.codigo).toBe('G1A2B3C');
  });
});

describe('grupo do site: quem organiza sem pilotar não ocupa vaga', async () => {
  const { montar } = await import('../lib/ops/grupos');
  const g = { id: 1, codigo: 'G1', bateriaId: 9, vagas: 20, disponiveis: 0, inicio: '2026-11-20T19:00', bateria: 'B', responsavelId: 50, responsavel: 'Ana', responsavelTelefone: null,
    origem: 'site', modo: 'individual', preco: 14500, sinalPct: 0, observacao: null, status: 'ativa', criadoEm: '', criadoPor: null } as never;
  const amigo = (id: number) => ({ id, ordem: id, responsavel: 0, token: 't' + id, inscricaoId: 100 + id, inscricaoStatus: 'reservada', inscricaoPaga: 0, pagoPeloGrupo: 0 });

  it('responsável com InscricaoId NULL fica fora da conta; o link do grupo continua sendo o dele', () => {
    const m = montar(g, [{ id: 1, ordem: 1, responsavel: 1, token: 'tresp', inscricaoId: null, inscricaoStatus: null }, amigo(2), amigo(3)], [], []);
    expect(m.n).toBe(2);
    expect(m.total).toBe(29000);
    expect(m.linkGrupo).toContain('?r=tresp');
  });

  it('responsável que pilota (com vaga) continua contando', () => {
    const m = montar(g, [{ id: 1, ordem: 1, responsavel: 1, token: 'tresp', inscricaoId: 101, inscricaoStatus: 'confirmada', inscricaoPaga: 1, pagoPeloGrupo: 0 }, amigo(2)], [], []);
    expect(m.n).toBe(2);
    expect(m.pilotos[0].pago).toBe(true);
    expect(m.pilotos[1].pago).toBe(false);
  });
});

describe('Minhas reservas: grupos que o CPF organiza', async () => {
  const { gruposDoResponsavel, esquecerGrupos } = await import('../workers/pre-cadastro/src/extras');
  const { createHash } = await import('node:crypto');
  const hash = (cpf: string) => createHash('sha256').update(`cpf:${cpf}`).digest('hex');
  const env = (lista: unknown[]) => ({ PRE: { get: async (k: string) => (k === 'grupos/todos.json' ? { json: async () => lista } : null) } }) as never;
  const g = { codigo: 'G1A2B3C', status: 'ativa', responsavel: 'Ana', bateria: 'B', inicio: '2026-11-20T19:00', modo: 'individual', precoCentavos: 14500,
    responsavelToken: 'TOKENRESP123', respDocHash: hash('52998224725'), painel: { chave: 'AbCdEfGh12345678', n: 4, pagos: 2, cadastrados: 3 } };

  it('mostra só os grupos do CPF, com link e painel no endereço único', async () => {
    esquecerGrupos();
    const r = await gruposDoResponsavel(env([g, { ...g, codigo: 'GOUTRO1', respDocHash: hash('11144477735') }]), '52998224725');
    expect(r).toEqual([expect.objectContaining({ codigo: 'G1A2B3C', link: 'https://reservas.kartodromodebetim.com.br/?r=TOKENRESP123',
      painel: 'https://reservas.kartodromodebetim.com.br/painel?g=G1A2B3C&k=AbCdEfGh12345678', vagas: 4, pagos: 2 })]);
  });

  it('grupo cancelado não aparece', async () => {
    esquecerGrupos();
    expect(await gruposDoResponsavel(env([{ ...g, status: 'cancelada' }]), '52998224725')).toEqual([]);
  });
});

/** Validação do pré-cadastro online: as mesmas regras do cadastro no totem (lib/ops + FormTotem). Sem IO. */

export type Menor = { nome: string; nascimento: string; documento: string };
export type PreCadastro = {
  tipoDocumento: 'CPF' | 'RG' | 'Passaporte';
  documento: string;
  nome: string;
  email: string;
  telefone: string;
  nascimento: string; // AAAA-MM-DD
  peso: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  menores: Menor[];
  lgpd: true;
};

export const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const txt = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function cpfValido(v: string) {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[t])) return false;
  }
  return true;
}

/** Data AAAA-MM-DD real, no passado e com idade plausível. */
export function dataValida(v: string, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return false;
  const anos = (hoje.getTime() - d.getTime()) / (365.25 * 86_400_000);
  return anos >= 0 && anos < 110;
}

/** Chave única do cadastro (a mesma que o totem usa para achar o cliente): só os dígitos, ou o texto do passaporte. */
export function chaveDocumento(tipo: string, documento: string) {
  const d = digitos(documento);
  return tipo === 'Passaporte' && !d ? documento.toUpperCase().replace(/[^A-Z0-9]/g, '') : d;
}

export function validar(entrada: Record<string, unknown>, hoje = new Date()): { ok: true; dados: PreCadastro } | { ok: false; erro: string } {
  const tipo = (['CPF', 'RG', 'Passaporte'] as const).find((t) => t === entrada.tipoDocumento) ?? 'CPF';
  const documento = txt(entrada.documento, 40);
  const nome = txt(entrada.nome, 120);
  const email = txt(entrada.email, 160).toLowerCase();
  const telefone = txt(entrada.telefone, 25);
  const nascimento = txt(entrada.nascimento, 10);
  const peso = txt(entrada.peso, 6).replace(',', '.');
  const estado = txt(entrada.estado, 2).toUpperCase();

  if (!documento) return { ok: false, erro: `Informe o ${tipo === 'Passaporte' ? 'passaporte' : tipo}.` };
  if (tipo === 'CPF' && !cpfValido(documento)) return { ok: false, erro: 'CPF inválido. Confira os números.' };
  if (tipo !== 'CPF' && chaveDocumento(tipo, documento).length < 5) return { ok: false, erro: `${tipo} inválido.` };
  if (nome.split(' ').length < 2) return { ok: false, erro: 'Informe o nome completo.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: 'E-mail inválido.' };
  if (digitos(telefone).length < 10) return { ok: false, erro: 'Informe o celular com DDD.' };
  if (!dataValida(nascimento, hoje)) return { ok: false, erro: 'Data de nascimento inválida.' };
  if (peso && !(Number(peso) >= 15 && Number(peso) <= 250)) return { ok: false, erro: 'Peso inválido (em kg).' };
  if (estado && !/^[A-Z]{2}$/.test(estado)) return { ok: false, erro: 'UF inválida.' };
  if (entrada.lgpd !== true) return { ok: false, erro: 'É preciso aceitar o Termo de Consentimento para Tratamento de Dados Pessoais.' };

  const menoresBrutos = Array.isArray(entrada.menores) ? entrada.menores.slice(0, 10) : [];
  const menores: Menor[] = [];
  for (const m of menoresBrutos as Record<string, unknown>[]) {
    const n = txt(m?.nome, 120);
    const nasc = txt(m?.nascimento, 10);
    if (!n && !nasc) continue;
    if (n.split(' ').length < 2) return { ok: false, erro: 'Informe o nome completo de cada menor.' };
    if (!dataValida(nasc, hoje)) return { ok: false, erro: `Data de nascimento inválida para ${n}.` };
    menores.push({ nome: n, nascimento: nasc, documento: txt(m?.documento, 40) });
  }

  return {
    ok: true,
    dados: {
      tipoDocumento: tipo, documento, nome, email, telefone, nascimento, peso,
      cep: digitos(entrada.cep).slice(0, 8), endereco: txt(entrada.endereco, 150), numero: txt(entrada.numero, 20),
      complemento: txt(entrada.complemento, 80), bairro: txt(entrada.bairro, 80), cidade: txt(entrada.cidade, 80), estado,
      menores, lgpd: true,
    },
  };
}

// ---------------------------------------------------------------- reserva online

export type Horario = { id: number; inicio: string; nome: string; livres: number };
export type Agenda = { atualizadoEm: string; precoCentavos: number; maxPilotos: number; prazoMin: number; antecedenciaMin: number; horarios: Horario[] };
export type Reserva = { cliente: PreCadastro; bateriaId: number; quantidade: number; forma: 'pix' | 'cartao'; pilotos: string[] };

/** Anos completos em `hoje` para quem nasceu em AAAA-MM-DD. */
export function idade(nascimento: string, hoje = new Date()) {
  const [a, m, d] = nascimento.split('-').map(Number);
  let anos = hoje.getUTCFullYear() - a;
  if (hoje.getUTCMonth() + 1 < m || (hoje.getUTCMonth() + 1 === m && hoje.getUTCDate() < d)) anos--;
  return anos;
}

/**
 * Pedido de reserva do site: os dados de quem compra (as regras do pré-cadastro, com CPF obrigatório — a Asaas
 * exige — e maior de 18), o horário escolhido na agenda publicada, quantos pilotos e a forma de pagamento.
 * A vaga de verdade é conferida pelo servidor da recepção; aqui só evita pedido impossível.
 */
export function validarReserva(entrada: Record<string, unknown>, agenda: Agenda | null, hoje = new Date()): { ok: true; dados: Reserva } | { ok: false; erro: string } {
  if (!agenda) return { ok: false, erro: 'A agenda está sendo atualizada. Tente de novo em instantes.' };
  const horario = agenda.horarios.find((h) => h.id === Number(entrada.bateriaId));
  if (!horario) return { ok: false, erro: 'Esse horário não está mais disponível. Escolha outro.' };
  const quantidade = Math.trunc(Number(entrada.quantidade));
  if (!(quantidade >= 1 && quantidade <= agenda.maxPilotos)) return { ok: false, erro: `Escolha de 1 a ${agenda.maxPilotos} pilotos.` };
  if (quantidade > horario.livres) return { ok: false, erro: horario.livres ? `Esse horário tem só ${horario.livres} ${horario.livres === 1 ? 'vaga' : 'vagas'}.` : 'Esse horário lotou. Escolha outro.' };
  const forma = entrada.forma === 'pix' || entrada.forma === 'cartao' ? entrada.forma : null;
  if (!forma) return { ok: false, erro: 'Escolha Pix ou cartão.' };
  if (entrada.politica !== true) return { ok: false, erro: 'É preciso aceitar a política de cancelamento.' };
  const v = validar({ ...entrada, tipoDocumento: 'CPF' }, hoje);
  if (!v.ok) return v;
  if (idade(v.dados.nascimento, hoje) < 18) return { ok: false, erro: 'A reserva precisa ser feita por um adulto (18 anos ou mais), que é o responsável pelo pagamento.' };
  const pilotos = (Array.isArray(entrada.pilotos) ? entrada.pilotos : []).map((p) => txt(p, 80)).filter(Boolean).slice(0, quantidade);
  return { ok: true, dados: { cliente: v.dados, bateriaId: horario.id, quantidade, forma, pilotos } };
}

/** Código curto da reserva, sem letras que se confundem (0/O, 1/I/L). */
export function codigoReserva(aleatorio: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(aleatorio(6), (b) => alfabeto[b % alfabeto.length]).join('');
}
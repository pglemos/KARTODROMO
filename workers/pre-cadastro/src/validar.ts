/** Validação do pré-cadastro online: as mesmas regras do cadastro no totem (lib/ops + FormTotem). Sem IO. */
import { erroInstagramCliente, normalizarInstagram } from '../../../lib/ops/instagram';

export type Menor = { nome: string; nascimento: string; documento: string };
export type PreCadastro = {
  tipoDocumento: 'CPF' | 'RG' | 'Passaporte';
  documento: string;
  nome: string;
  email: string;
  /** @usuário do Instagram (sai no resultado impresso da bateria) */
  instagram: string;
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
  // e-mail, peso e endereço são obrigatórios como no totem (cadastro novo); o CEP é opcional
  if (!email) return { ok: false, erro: 'Informe seu e-mail (o recibo e o resultado vão para ele).' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: 'E-mail inválido.' };
  if (digitos(telefone).length < 10) return { ok: false, erro: 'Informe o celular com DDD.' };
  if (!dataValida(nascimento, hoje)) return { ok: false, erro: 'Data de nascimento inválida.' };
  if (!peso) return { ok: false, erro: 'Informe seu peso (kg). Ele é usado para equilibrar os karts.' };
  if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { ok: false, erro: 'Peso inválido: informe entre 20 e 250 kg.' };
  if (estado && !/^[A-Z]{2}$/.test(estado)) return { ok: false, erro: 'UF inválida.' };
  if (!txt(entrada.endereco, 150)) return { ok: false, erro: 'Informe o endereço (rua e número).' };
  if (!txt(entrada.bairro, 80)) return { ok: false, erro: 'Informe o bairro.' };
  if (!txt(entrada.cidade, 80)) return { ok: false, erro: 'Informe a cidade.' };
  // obrigatório como no totem: o resultado impresso traz o Instagram de cada piloto (15/10, recepção)
  const erroInstagram = erroInstagramCliente(entrada.instagram);
  if (erroInstagram) return { ok: false, erro: erroInstagram.replace(' do piloto', '') };
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
      tipoDocumento: tipo, documento, nome, email, instagram: normalizarInstagram(entrada.instagram), telefone, nascimento, peso,
      cep: digitos(entrada.cep).slice(0, 8), endereco: txt(entrada.endereco, 150), numero: txt(entrada.numero, 20),
      complemento: txt(entrada.complemento, 80), bairro: txt(entrada.bairro, 80), cidade: txt(entrada.cidade, 80), estado,
      menores, lgpd: true,
    },
  };
}

// ---------------------------------------------------------------- reserva online

export type Horario = { id: number; inicio: string; nome: string; livres: number };
export type Agenda = { atualizadoEm: string; precoCentavos: number; maxPilotos: number; prazoMin: number; antecedenciaMin: number; horarios: Horario[] };
/** Cada vaga é de uma pessoa: com 3 vagas, quem compra é o piloto 1 e os outros 2 vêm cadastrados aqui. */
export type Acompanhante = {
  nome: string; documento: string; nascimento: string; instagram: string; email: string; telefone: string; peso: string;
  cep: string; endereco: string; complemento: string; bairro: string; cidade: string;
};
export type Reserva = { cliente: PreCadastro; bateriaId: number; quantidade: number; forma: 'pix' | 'cartao'; pilotos: string[]; acompanhantes: Acompanhante[]; compradorPilota: boolean };
/** Idade mínima para pilotar o kart de locação (requisito do kartódromo). */
export const IDADE_MINIMA_PILOTO = 14;

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
  if (entrada.politica !== true) return { ok: false, erro: 'Para reservar, aceite a Política de Cancelamento, Reagendamento e Reembolso.' };
  const v = validar({ ...entrada, tipoDocumento: 'CPF' }, hoje);
  if (!v.ok) return v;
  if (idade(v.dados.nascimento, hoje) < 18) return { ok: false, erro: 'A reserva precisa ser feita por um adulto (18 anos ou mais), que é o responsável pelo pagamento.' };
  // cada vaga é de uma pessoa diferente: quem compra ocupa uma vaga se for pilotar (padrão); cada outra vaga precisa do
  // cadastro de quem vai correr (nome, CPF, nascimento). Cadastros a mais (diminuiu a quantidade depois) são ignorados.
  const compradorPilota = entrada.compradorPilota !== false;
  const faltam = quantidade - (compradorPilota ? 1 : 0);
  const brutos = ((Array.isArray(entrada.acompanhantes) ? entrada.acompanhantes : []) as Record<string, unknown>[]).slice(0, faltam);
  if (brutos.length !== faltam) return { ok: false, erro: faltam === 1 ? (compradorPilota ? 'Cadastre o outro piloto: cada vaga é de uma pessoa diferente.' : 'Cadastre quem vai pilotar.') : compradorPilota ? `Cadastre os outros ${faltam} pilotos: cada vaga é de uma pessoa diferente.` : `Cadastre os ${faltam} pilotos: cada vaga é de uma pessoa diferente.` };
  const documentos = new Set([digitos(v.dados.documento)]);
  const acompanhantes: Acompanhante[] = [];
  for (const [i, a] of brutos.entries()) {
    const n = i + (compradorPilota ? 2 : 1);
    const nome = txt(a?.nome, 120);
    const documento = txt(a?.documento, 20);
    const nascimento = txt(a?.nascimento, 10);
    if (nome.split(' ').length < 2) return { ok: false, erro: `Informe o nome completo do piloto ${n}.` };
    if (!cpfValido(documento)) return { ok: false, erro: `CPF inválido do piloto ${n} (${nome}).` };
    if (documentos.has(digitos(documento))) return { ok: false, erro: `O CPF do piloto ${n} (${nome}) repete o de outro piloto. Cada vaga é de uma pessoa diferente.` };
    documentos.add(digitos(documento));
    if (!dataValida(nascimento, hoje)) return { ok: false, erro: `Data de nascimento inválida do piloto ${n} (${nome}).` };
    if (idade(nascimento, hoje) < IDADE_MINIMA_PILOTO) return { ok: false, erro: `${nome} precisa ter ${IDADE_MINIMA_PILOTO} anos ou mais para pilotar.` };
    // mesmos campos obrigatórios do totem para cada piloto (cada um tem o próprio cadastro)
    const quem = `do piloto ${n} (${nome})`;
    const email = txt(a?.email, 160).toLowerCase();
    if (!email) return { ok: false, erro: `Informe o e-mail ${quem}.` };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: `E-mail inválido ${quem}.` };
    const telefone = txt(a?.telefone, 25);
    if (digitos(telefone).length < 10) return { ok: false, erro: `Informe o celular com DDD ${quem}.` };
    const peso = txt(a?.peso, 6).replace(',', '.');
    if (!peso) return { ok: false, erro: `Informe o peso (kg) ${quem}.` };
    if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { ok: false, erro: `Peso inválido ${quem}: informe entre 20 e 250 kg.` };
    const endereco = txt(a?.endereco, 150);
    if (!endereco) return { ok: false, erro: `Informe o endereço (rua e número) ${quem}.` };
    const bairro = txt(a?.bairro, 80);
    if (!bairro) return { ok: false, erro: `Informe o bairro ${quem}.` };
    const cidade = txt(a?.cidade, 80);
    if (!cidade) return { ok: false, erro: `Informe a cidade ${quem}.` };
    const instagram = String(a?.instagram ?? '').trim();
    if (erroInstagramCliente(instagram)) return { ok: false, erro: `Informe o Instagram ${quem}. Use o @usuário (ex.: @andre.silva).` };
    acompanhantes.push({
      nome, documento, nascimento, instagram: normalizarInstagram(instagram), email, telefone, peso,
      cep: digitos(a?.cep).slice(0, 8), endereco, complemento: txt(a?.complemento, 80), bairro, cidade,
    });
  }
  const pilotos = [...(compradorPilota ? [v.dados.nome] : []), ...acompanhantes.map((a) => a.nome)];
  return { ok: true, dados: { cliente: v.dados, bateriaId: horario.id, quantidade, forma, pilotos, acompanhantes, compradorPilota } };
}

/** Código curto da reserva, sem letras que se confundem (0/O, 1/I/L). */
export function codigoReserva(aleatorio: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(aleatorio(6), (b) => alfabeto[b % alfabeto.length]).join('');
}
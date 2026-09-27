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

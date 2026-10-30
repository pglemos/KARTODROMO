/**
 * Pré-cadastro online (QR code): o site guarda o cadastro na Cloudflare até este servidor buscar,
 * gravar em dbo.Cliente (a mesma tabela que o totem consulta) e apagar de lá.
 * Env: PRECADASTRO_URL (https://cadastro.kartodromodebetim.com.br) e PRECADASTRO_KEY (segredo do /api/sync).
 */
import { insertCliente, one, onlyDigits, updateCliente, type ClienteInput } from './db';
import { vincularCadastroDoLink } from './grupos';
import { registrarPreCadastro } from './painel';

export type PreCadastro = {
  key: string;
  chave: string;
  recebidoEm: string;
  tipoDocumento: string;
  documento: string;
  nome: string;
  email: string;
  /** @usuário do Instagram; cadastros antigos do site não têm */
  instagram?: string;
  telefone: string;
  nascimento: string;
  peso: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  menores: { nome: string; nascimento: string; documento: string }[];
  /** Link da reserva em grupo (painel web): a vaga do grupo passa para o nome desta pessoa. */
  reserva?: string;
};

type Log = (...args: unknown[]) => void;

/** Outro piloto da reserva online, com os mesmos campos do cadastro do totem (ver workers/pre-cadastro/src/validar.ts). */
export type AcompanhanteSite = {
  nome: string; documento: string; nascimento: string; instagram?: string; email?: string; telefone?: string; peso?: string;
  cep?: string; endereco?: string; complemento?: string; bairro?: string; cidade?: string;
};

/** Contato e endereço do piloto que não é o comprador: o que vier preenchido (campo vazio não apaga o que já existe). */
export function contatoAcompanhante(a: AcompanhanteSite): ClienteInput {
  const peso = Number(String(a.peso ?? '').replace(',', '.'));
  return {
    ...(a.instagram ? { instagram: a.instagram } : {}),
    ...(a.email ? { email: a.email } : {}),
    ...(a.telefone ? { telefone: a.telefone } : {}),
    ...(peso > 0 ? { peso } : {}),
    ...(a.cep ? { cep: a.cep } : {}),
    ...(a.endereco ? { endereco: a.endereco } : {}),
    ...(a.complemento ? { complemento: a.complemento } : {}),
    ...(a.bairro ? { bairro: a.bairro } : {}),
    ...(a.cidade ? { cidade: a.cidade } : {}),
  };
}

const url = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
const chave = () => process.env.PRECADASTRO_KEY || '';
export const preCadastroLigado = () => Boolean(url() && chave());

async function chamar(caminho: string, init: RequestInit = {}, timeoutMs = 8000) {
  const r = await fetch(url() + caminho, { ...init, headers: { 'x-sync-key': chave(), 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`pré-cadastro ${caminho}: HTTP ${r.status}`);
  return r.json();
}

/**
 * Dados que vão para o cliente. Quem já tem cadastro só atualiza contato, peso e endereço
 * (nome, documento e nascimento já gravados não mudam por um formulário da internet).
 */
export function dadosDoCliente(p: PreCadastro, existente: { nascimento: string | null } | null): ClienteInput {
  const endereco: ClienteInput = { cep: p.cep, endereco: p.endereco, numero: p.numero, complemento: p.complemento, bairro: p.bairro, cidade: p.cidade, estado: p.estado };
  const contato: ClienteInput = { email: p.email, telefone: p.telefone, peso: p.peso || null, ...(p.instagram ? { instagram: p.instagram } : {}), ...endereco, lgpd: true };
  if (existente) return { ...contato, ...(existente.nascimento ? {} : { nascimento: p.nascimento }) };
  return { nome: p.nome, tipoDocumento: p.tipoDocumento, documento: p.documento, nascimento: p.nascimento, ...contato };
}

/** Grava um pré-cadastro (e os menores dele) em dbo.Cliente. Devolve o id do cliente. */
export async function gravarPreCadastro(p: PreCadastro, log: Log): Promise<number> {
  const doc = p.chave || onlyDigits(p.documento);
  const existente = await one<{ id: number; nascimento: string | null }>(
    `SELECT TOP 1 Id id, CONVERT(varchar(10), Nascimento, 126) nascimento FROM dbo.Cliente
      WHERE (DocumentoNum = @d OR Documento = @d) AND ResponsavelId IS NULL ORDER BY AtualizadoEm DESC`,
    { d: doc },
  );
  let id: number;
  if (existente) {
    id = existente.id;
    await updateCliente(id, dadosDoCliente(p, existente), true);
    log(`pré-cadastro: cliente ${id} atualizado pelo site`);
  } else {
    id = await insertCliente(dadosDoCliente(p, null), 'site');
    log(`pré-cadastro: cliente novo ${id} pelo site`);
  }
  registrarPreCadastro(p.nome, !existente, !!p.reserva);
  for (const m of p.menores ?? []) {
    const filho = await one<{ id: number }>(
      `SELECT TOP 1 Id id FROM dbo.Cliente WHERE ResponsavelId = @r AND UPPER(LTRIM(RTRIM(Nome))) = UPPER(@n)`,
      { r: id, n: m.nome.trim() },
    );
    const dados: ClienteInput = { nascimento: m.nascimento, ...(m.documento ? { tipoDocumento: 'RG', documento: m.documento } : {}), lgpd: true };
    if (filho) await updateCliente(filho.id, dados, true);
    else await insertCliente({ nome: m.nome, ...dados, responsavelId: id }, 'site');
  }
  return id;
}

/**
 * Outro piloto de uma reserva online (o comprador informou nome, CPF e nascimento). Quem já tem cadastro pelo CPF é
 * reaproveitado sem mexer nos dados (só preenche o nascimento se faltar); quem não tem ganha um cadastro novo. O termo e o
 * aceite de dados (LGPD) a própria pessoa faz no totem — por isso não marcamos LGPD aqui.
 */
export async function gravarAcompanhante(a: AcompanhanteSite & { chave?: string }, log: Log): Promise<number> {
  const doc = a.chave || onlyDigits(a.documento);
  const existente = await one<{ id: number; nascimento: string | null }>(
    `SELECT TOP 1 Id id, CONVERT(varchar(10), Nascimento, 126) nascimento FROM dbo.Cliente
      WHERE (DocumentoNum = @d OR Documento = @d) AND ResponsavelId IS NULL ORDER BY AtualizadoEm DESC`,
    { d: doc },
  );
  // os mesmos campos do cadastro do totem (e-mail, celular, peso, endereço, Instagram); o que vier em branco não apaga
  const contato = contatoAcompanhante(a);
  if (existente) {
    const novos: ClienteInput = { ...contato, ...(!existente.nascimento && a.nascimento ? { nascimento: a.nascimento } : {}) };
    if (Object.keys(novos).length) await updateCliente(existente.id, novos, true);
    return existente.id;
  }
  const id = await insertCliente({ nome: a.nome, tipoDocumento: 'CPF', documento: a.documento, nascimento: a.nascimento, ...contato }, 'site');
  log(`pré-cadastro: piloto ${id} cadastrado pela reserva online de outra pessoa`);
  return id;
}

/** Busca os pendentes no site, grava e apaga lá. Chamado a cada 30 s. */
export async function sincronizarPreCadastros(log: Log) {
  if (!preCadastroLigado()) return 0;
  const pendentes = (await chamar('/api/sync/pendentes')) as PreCadastro[];
  const feitos: string[] = [];
  for (const p of pendentes) {
    try {
      const id = await gravarPreCadastro(p, log);
      if (p.reserva) await vincularCadastroDoLink(p.reserva, id, log).catch((e) => log(`grupo: vínculo do link falhou (${(e as Error).message})`));
      feitos.push(p.key);
    } catch (e) { log(`pré-cadastro ${p.key}: erro ${(e as Error).message}`); }
  }
  if (feitos.length) await chamar('/api/sync/concluir', { method: 'POST', body: JSON.stringify({ keys: feitos }) });
  return feitos.length;
}

/** Totem não achou o cliente: pergunta ao site na hora (o cadastro pode ter sido feito há segundos). */
export async function buscarPreCadastroAgora(identificador: string, log: Log) {
  if (!preCadastroLigado()) return false;
  try {
    const p = (await chamar(`/api/sync/buscar?q=${encodeURIComponent(identificador)}`, {}, 4000)) as PreCadastro | null;
    if (!p) return false;
    const id = await gravarPreCadastro(p, log);
    if (p.reserva) await vincularCadastroDoLink(p.reserva, id, log).catch(() => undefined);
    await chamar('/api/sync/concluir', { method: 'POST', body: JSON.stringify({ keys: [p.key] }) }).catch(() => undefined);
    return true;
  } catch (e) {
    log(`pré-cadastro: busca na hora falhou (${(e as Error).message})`);
    return false;
  }
}

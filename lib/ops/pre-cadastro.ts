/**
 * Pré-cadastro online (QR code): o site guarda o cadastro na Cloudflare até este servidor buscar,
 * gravar em dbo.Cliente (a mesma tabela que o totem consulta) e apagar de lá.
 * Env: PRECADASTRO_URL (https://cadastro.kartodromodebetim.com.br) e PRECADASTRO_KEY (segredo do /api/sync).
 */
import { insertCliente, one, onlyDigits, updateCliente, type ClienteInput } from './db';

export type PreCadastro = {
  key: string;
  chave: string;
  recebidoEm: string;
  tipoDocumento: string;
  documento: string;
  nome: string;
  email: string;
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
};

type Log = (...args: unknown[]) => void;

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
  const contato: ClienteInput = { email: p.email, telefone: p.telefone, peso: p.peso || null, ...endereco, lgpd: true };
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

/** Busca os pendentes no site, grava e apaga lá. Chamado a cada 30 s. */
export async function sincronizarPreCadastros(log: Log) {
  if (!preCadastroLigado()) return 0;
  const pendentes = (await chamar('/api/sync/pendentes')) as PreCadastro[];
  const feitos: string[] = [];
  for (const p of pendentes) {
    try { await gravarPreCadastro(p, log); feitos.push(p.key); } catch (e) { log(`pré-cadastro ${p.key}: erro ${(e as Error).message}`); }
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
    await gravarPreCadastro(p, log);
    await chamar('/api/sync/concluir', { method: 'POST', body: JSON.stringify({ keys: [p.key] }) }).catch(() => undefined);
    return true;
  } catch (e) {
    log(`pré-cadastro: busca na hora falhou (${(e as Error).message})`);
    return false;
  }
}

/**
 * Termo de responsabilidade aceito online. O SRVKART publica no site o mesmo texto da impressão (com versão = hash do
 * texto); o pré-cadastro devolve o aceite (versão, data, autorização de imagem) e aqui ele vira kart.cliente_termo_aceite.
 * A assinatura no papel na recepção continua; o aceite online adianta a fila e aparece no painel do grupo.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { one, query } from './db';
import { paragrafosDoTermo } from './termo';

type Log = (...args: unknown[]) => void;
export type AceiteTermo = { versao?: unknown; aceitoEm?: unknown; imagem?: unknown; ip?: unknown };

const siteUrl = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
const siteChave = () => process.env.PRECADASTRO_KEY || '';

export async function termoAtual(arquivo: string | null) {
  const empresa = await one<{ nome: string; razaoSocial: string | null }>('select nome, razao_social "razaoSocial" from kart.empresa where id = 1');
  const nome = empresa?.razaoSocial?.trim() || empresa?.nome || 'Kartódromo';
  const personalizado = arquivo && existsSync(arquivo) ? readFileSync(arquivo, 'utf8') : undefined;
  const paragrafos = paragrafosDoTermo(nome, personalizado);
  const versao = createHash('sha256').update(JSON.stringify(paragrafos)).digest('hex').slice(0, 12);
  return { versao, titulo: 'Termo de Responsabilidade', empresa: nome, paragrafos };
}

let ultimo = '';
/** Manda o texto ao site quando muda (chamado a cada minuto). */
export async function publicarTermoNoSite(arquivo: string | null, log: Log) {
  if (!siteUrl() || !siteChave()) return false;
  const t = await termoAtual(arquivo);
  const json = JSON.stringify(t);
  if (json === ultimo) return false;
  const r = await fetch(siteUrl() + '/api/sync/termo', { method: 'PUT', body: json, headers: { 'x-sync-key': siteChave(), 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  ultimo = json;
  log(`termo: versão ${t.versao} publicada no site`);
  return true;
}

/** Grava o aceite que veio com o pré-cadastro (ignora repetido: mesma versão no mesmo minuto). */
export async function gravarAceiteTermo(clienteId: number, a: AceiteTermo | undefined, log: Log) {
  if (!a || !/^[a-f0-9]{12}$/.test(String(a.versao ?? ''))) return false;
  const quando = Date.parse(String(a.aceitoEm ?? '')) ? new Date(String(a.aceitoEm)) : new Date();
  const ja = await one(`select 1 x from kart.cliente_termo_aceite where cliente_id = @c and versao = @v and abs(extract(epoch from (aceito_em - @q::timestamp at time zone 'America/Sao_Paulo'))) < 60`, { c: clienteId, v: a.versao, q: quando });
  if (ja) return true;
  await query(`insert into kart.cliente_termo_aceite (cliente_id, versao, aceito_em, autoriza_imagem, origem, ip) values (@c, @v, @q, @img, 'site', @ip)`,
    { c: clienteId, v: String(a.versao), q: quando, img: a.imagem !== false, ip: String(a.ip ?? '').slice(0, 45) || null });
  log(`termo: cliente ${clienteId} aceitou a versão ${a.versao} pelo site`);
  return true;
}

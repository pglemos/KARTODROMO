/**
 * Lado do site (Cloudflare) da API de transmissão ao vivo: o servidor da cronometragem (ORBITS) PUBLICA o retrato
 * aqui e o parceiro LÊ com a chave dele. Assim nenhuma porta do kartódromo fica aberta para a internet.
 *
 * Segredos do Worker (wrangler secret, nunca no código):
 *   TRANSMISSAO_CHAVES_SHA256     hashes das chaves dos parceiros ("cosmo:<sha256>", vários separados por vírgula)
 *   TRANSMISSAO_PUBLICACAO_SHA256 hash da chave que o ORBITS usa para publicar
 */
import { getR2Json, hasR2Store, putR2Json } from '@/lib/r2-client';
import { conferirChave, extrairChave, lerHashes, VERSAO_TRANSMISSAO, type Transmissao } from '@/lib/timing/transmissao';

export const CHAVE_R2 = 'transmissao/v1/corrida.json';
/** Sem envio do ORBITS há mais que isso, o retrato vai marcado como sem sinal (a cronometragem envia a cada ≤ 30 s). */
export const SEM_SINAL_APOS_MS = 90_000;
export const TAMANHO_MAXIMO = 512 * 1024;

export type TransmissaoGuardada = Transmissao & { recebidoEm: string };
export type TransmissaoEntregue = TransmissaoGuardada & { sinal: 'ao-vivo' | 'sem-sinal' };

export const SEM_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** cache curto por instância do Worker: muitos pedidos no mesmo segundo leem o R2 uma vez só */
let memoria: { lidoEm: number; dados: TransmissaoGuardada | null } | null = null;

export async function autorizarLeitura(request: Request): Promise<string | null> {
  return conferirChave(extrairChave((n) => request.headers.get(n), new URL(request.url)), lerHashes(process.env.TRANSMISSAO_CHAVES_SHA256));
}

export async function autorizarPublicacao(request: Request): Promise<boolean> {
  const chave = extrairChave((n) => request.headers.get(n), new URL('https://x/'));
  return (await conferirChave(chave, lerHashes(process.env.TRANSMISSAO_PUBLICACAO_SHA256))) != null;
}

export function validarRetrato(corpo: unknown): Transmissao | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const t = corpo as Partial<Transmissao>;
  if (t.versao !== VERSAO_TRANSMISSAO || typeof t.situacao !== 'string' || !Array.isArray(t.pilotos) || t.pilotos.length > 200) return null;
  return t as Transmissao;
}

export async function guardarRetrato(t: Transmissao, agora = Date.now()): Promise<void> {
  const guardada: TransmissaoGuardada = { ...t, recebidoEm: new Date(agora).toISOString() };
  await putR2Json(CHAVE_R2, guardada);
  memoria = { lidoEm: agora, dados: guardada };
}

export async function lerRetrato(agora = Date.now()): Promise<TransmissaoEntregue | null> {
  if (!memoria || agora - memoria.lidoEm > 700) memoria = { lidoEm: agora, dados: hasR2Store() ? await getR2Json<TransmissaoGuardada>(CHAVE_R2) : null };
  const dados = memoria.dados;
  if (!dados) return null;
  const idade = agora - Date.parse(dados.recebidoEm);
  return { ...dados, sinal: Number.isFinite(idade) && idade <= SEM_SINAL_APOS_MS ? 'ao-vivo' : 'sem-sinal' };
}

/** só para testes */
export function esquecerMemoria() {
  memoria = null;
}

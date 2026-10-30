import { extname } from 'node:path';
import * as path from 'node:path';

export const aplicativosDesktop = new Set(['Recepcao', 'Autoatendimento', 'Cronometragem']);

export function caminhoArquivoAtualizacao(raiz: string, app: string, nome: string): string | null {
  if (!aplicativosDesktop.has(app) || !nome || nome.includes('/') || nome.includes('\\')) return null;
  // Os clientes desktop ainda enviam raízes Windows mesmo quando o teste roda no macOS/Linux.
  const pathApi = /^[A-Za-z]:[\\/]/.test(raiz) || raiz.startsWith('\\\\') ? path.win32 : path;
  const pasta = pathApi.resolve(raiz, app);
  const arquivo = pathApi.resolve(pasta, nome);
  const rel = pathApi.relative(pasta, arquivo);
  if (!rel || rel.startsWith('..' + pathApi.sep) || rel === '..' || rel.includes(pathApi.sep)) return null;
  return arquivo;
}

export function tipoConteudoAtualizacao(nome: string): string {
  return extname(nome).toLowerCase() === '.zip' ? 'application/zip' : 'application/json; charset=utf-8';
}

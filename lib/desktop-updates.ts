import { extname, relative, resolve, sep } from 'node:path';

export const aplicativosDesktop = new Set(['Recepcao', 'Autoatendimento', 'Cronometragem']);

export function caminhoArquivoAtualizacao(raiz: string, app: string, nome: string): string | null {
  if (!aplicativosDesktop.has(app) || !nome || nome.includes('/') || nome.includes('\\')) return null;
  const pasta = resolve(raiz, app);
  const arquivo = resolve(pasta, nome);
  const rel = relative(pasta, arquivo);
  if (!rel || rel.startsWith('..' + sep) || rel === '..' || rel.includes(sep)) return null;
  return arquivo;
}

export function tipoConteudoAtualizacao(nome: string): string {
  return extname(nome).toLowerCase() === '.zip' ? 'application/zip' : 'application/json; charset=utf-8';
}

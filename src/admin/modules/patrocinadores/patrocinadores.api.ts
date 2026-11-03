import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api-client';
import type { ArquivoEnviado, CategoriaArquivo, Cobranca, Contrato, Empresa, Espaco, Recorrencia } from './patrocinadores.types';

const LIMITE = 'limit=1000';

export const patrocinadoresApi = {
  empresas: () => apiGet<Empresa[]>(`patro_empresas?${LIMITE}`),
  espacos: () => apiGet<Espaco[]>(`patro_espacos?${LIMITE}`),
  contratos: () => apiGet<Contrato[]>(`patro_contratos_full?${LIMITE}`),
  cobrancas: () => apiGet<Cobranca[]>(`patro_cobrancas_full?${LIMITE}`),

  salvar: <T>(recurso: string, id: string | null, dados: Record<string, unknown>) =>
    id ? apiPatch<T>(`${recurso}/${id}`, dados) : apiPost<T>(recurso, dados),
  remover: (recurso: string, id: string) => apiDelete(`${recurso}/${id}`),

  gerarCobrancas: (contratoId: string) =>
    apiPost<{ geradas: number; total: number }>('patro_gerar_cobrancas', { contrato_id: contratoId }),
  baixar: (id: string, pagoEm: string, forma: string) =>
    apiPatch(`patro_cobrancas/${id}`, { status: 'pago', pago_em: pagoEm, forma_pagamento: forma || null }),
  reabrir: (id: string) => apiPatch(`patro_cobrancas/${id}`, { status: 'pendente', pago_em: null, forma_pagamento: null }),
  cancelarCobranca: (id: string) => apiPatch(`patro_cobrancas/${id}`, { status: 'cancelado' }),
};

export const arquivoUrl = (id: string, baixar = false) =>
  `/api/admin/patrocinadores/arquivos/${id}${baixar ? '?download=1' : ''}`;

/** Reduz imagens grandes antes do envio (limite de 8 MB por arquivo). */
async function reduzirImagem(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 1_500_000) return file;
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }) : file;
}

export async function enviarArquivo(file: File, categoria: CategoriaArquivo): Promise<ArquivoEnviado> {
  const pronto = await reduzirImagem(file);
  const form = new FormData();
  form.append('file', pronto);
  form.append('categoria', categoria);
  const response = await fetch('/api/admin/patrocinadores/arquivos', { method: 'POST', body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const mensagens: Record<string, string> = {
      invalid_file_type: 'Tipo de arquivo não aceito. Use imagem (PNG, JPG, WEBP), PDF ou DOCX.',
      invalid_file_size: 'Arquivo vazio ou maior que 8 MB.',
    };
    throw new Error(mensagens[data?.error] ?? data?.error ?? `HTTP ${response.status}`);
  }
  return data as ArquivoEnviado;
}

export const mesesPorRecorrencia: Record<Recorrencia, number> = {
  unico: 0,
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export const recorrenciaLabel: Record<Recorrencia, string> = {
  unico: 'Pagamento único',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

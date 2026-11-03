import { useRef, useState } from 'react';
import { FileText, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { arquivoUrl, enviarArquivo } from './patrocinadores.api';
import type { CategoriaArquivo } from './patrocinadores.types';

type Props = {
  label: string;
  categoria: CategoriaArquivo;
  valor: string | null;
  onChange: (id: string | null) => void;
  onErro: (mensagem: string) => void;
  /** 'imagem' mostra miniatura; 'documento' mostra link para o PDF. */
  tipo: 'imagem' | 'documento';
  ajuda?: string;
};

export function ArquivoCampo({ ajuda, categoria, label, onChange, onErro, tipo, valor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const escolher = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    try {
      onChange((await enviarArquivo(file, categoria)).id);
    } catch (error) {
      onErro(error instanceof Error ? error.message : 'Falha ao enviar arquivo');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-kib-borda-forte bg-kib-fundo p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-kib-borda bg-kib-superficie text-kib-texto-3">
          {valor && tipo === 'imagem' ? (
            <img src={arquivoUrl(valor)} alt={label} className="h-full w-full object-contain" />
          ) : valor ? (
            <FileText size={26} />
          ) : tipo === 'imagem' ? (
            <ImagePlus size={24} />
          ) : (
            <Upload size={24} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-kib-texto">{label}</p>
          <p className="text-xs text-kib-texto-3">
            {valor ? (tipo === 'documento' ? 'Arquivo anexado' : 'Imagem anexada') : (ajuda ?? 'Nenhum arquivo enviado')}
          </p>
          {valor && tipo === 'documento' && (
            <a className="text-xs font-bold text-kib-acao underline" href={arquivoUrl(valor, true)} target="_blank" rel="noreferrer">
              Abrir / baixar
            </a>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-kib-campo px-3 text-xs font-bold text-kib-texto hover:bg-kib-borda-forte disabled:opacity-60"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {valor ? 'Trocar' : 'Enviar'}
          </button>
          {valor && (
            <button
              type="button"
              aria-label={`Remover ${label}`}
              onClick={() => onChange(null)}
              className="inline-flex min-h-10 items-center rounded-lg border border-kib-borda px-2.5 text-kib-texto-2 hover:text-kib-perigo"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={tipo === 'imagem' ? 'image/png,image/jpeg,image/webp,image/gif' : 'application/pdf,.docx'}
        onChange={(event) => void escolher(event.target.files?.[0])}
      />
    </div>
  );
}

export interface TokenLido {
  caminho: string;
  tipo: string;
  valor: unknown;
  escuro?: unknown;
  descricao: string;
  obsoleto: string | null;
  kib: { contraste?: { sobre: string; min: number; nivel?: string }[]; temas?: { escuro?: unknown }; csharp?: { corConhecida?: string }; legado?: boolean };
  legado: boolean;
}
export type Temas = { claro: Map<string, unknown>; escuro: Map<string, unknown> };
export declare const raiz: string;
export declare const arquivoTokens: string;
export declare const TEMAS: ['claro', 'escuro'];
export declare function carregarJson(caminho?: string): Record<string, unknown>;
export declare function listarTokens(arvore: Record<string, unknown>): { tokens: TokenLido[]; erros: string[] };
export declare function resolverTema(tokens: TokenLido[], tema: 'claro' | 'escuro'): { valores: Map<string, unknown>; erros: string[] };
export declare function lerTokens(caminho?: string): { tokens: TokenLido[]; temas: Temas };
export declare function corParaRgba(hex: string): { r: number; g: number; b: number; a: number };
export declare function numeroDe(v: unknown): number;
export declare function nomePascal(caminho: string): string;

export type Contagem = Record<string, Record<string, number>>;
export declare const ESCOPO: string[];
export declare const CONGELADO: RegExp;
export declare function listarArquivos(base?: string): string[];
export declare function contarTudo(base?: string): Contagem;
export declare function comparar(atual: Contagem, baseline: Contagem): { piorou: { arquivo: string; regra: string; antes: number; agora: number }[]; melhorou: { arquivo: string; regra: string; antes: number; agora: number }[] };
export declare function relatorio(atual: Contagem): string;

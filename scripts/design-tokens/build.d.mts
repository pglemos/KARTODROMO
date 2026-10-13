import type { ResultadoContraste } from './contraste.mjs';
export declare const SAIDAS: Record<'css' | 'timingUi' | 'csharp' | 'kotlin' | 'androidXml' | 'referencia', string>;
export declare function gerar(caminhoTokens?: string): { arquivos: Record<string, string>; contrastes: ResultadoContraste[] };
export declare function desatualizados(arquivos: Record<string, string>, base?: string): string[];

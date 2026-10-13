import type { TokenLido, Temas } from './ler-tokens.mjs';
export interface ResultadoContraste { token: string; sobre: string; tema: string; razao: number; min: number; ok: boolean; nivel: string }
export declare function razaoContraste(frente: string, fundo: string): number;
export declare function verificarContrastes(tokens: TokenLido[], temas: Temas): ResultadoContraste[];

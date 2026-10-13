import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// O totem tem visual APROVADO e congelado: as cores dele vêm de componente.totem.* com os valores EXATOS de antes
// da migração (fase 6, 09/10/2026 — 36 fotos do autoteste idênticas byte a byte). Mudou um valor aqui = mudou o totem.
const tokens = JSON.parse(readFileSync('tokens/kib.tokens.json', 'utf8'));
const APROVADO: Record<string, string> = {
  cartao: '#FFFFFF12', 'verde-escuro': '#007A3D', 'verde-suave': '#BFEFD2', texto: '#F7FAF6', 'texto-suave': '#B7C2BA',
  'texto-muito-suave': '#829388', campo: '#0B100C', 'borda-campo': '#415044', amarelo: '#FACC15', 'informativo-fundo': '#184030',
  'informativo-texto': '#97F7C2', 'super-fundo': '#4C390C', 'super-texto': '#FFD24A', foco: '#00E676', grade: '#FFFFFF09',
  divisor: '#FFFFFF18', contorno: '#FFFFFF1A', 'contorno-forte': '#FFFFFF26', 'botao-claro-sobre': '#FFFFFF2A', 'check-topo': '#4CE07A',
  'check-base': '#1FA64A', 'check-borda': '#D0D0D0', 'menu-selecionado': '#464A50', 'campo-desligado': '#222428',
  'botao-claro-pressionado': '#E8ECE8', 'passo-pendente': '#FFFFFF14', 'veu-leve': '#FFFFFF0A', 'linha-lista': '#FFFFFF0C',
  'linha-fina': '#FFFFFF14', trilho: '#FFFFFF2D', 'contorno-caixa': '#FFFFFFB4', 'marca-check': '#00210A',
};

describe('totem congelado', () => {
  it('as cores do totem continuam exatamente as aprovadas', () => {
    for (const [nome, hex] of Object.entries(APROVADO)) expect(tokens.componente.totem[nome]?.$value, nome).toBe(hex);
  });
  it('a paleta do totem (Estilo) lê dos tokens, sem cor solta', () => {
    const controles = readFileSync('desktop/src/Kartodromo.Autoatendimento/Controles.cs', 'utf8');
    const estilo = controles.slice(controles.indexOf('public static class Estilo'), controles.indexOf('static readonly string Familia'));
    expect(estilo).not.toMatch(/Color\.FromArgb\(\s*\d/);
    expect((estilo.match(/Tokens\.Escuro\.ComponenteTotem/g) ?? []).length).toBe(16);
  });
});

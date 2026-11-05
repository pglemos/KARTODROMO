/** O ID 1 era o padrão do LapTime; sem confirmação histórica, não identifica o desenho usado. */
export function tracadoLegado(id: string, nome: string): string {
  if (/^l[tr]-/.test(id) && /^tra[cç]ado\s+1(?:\s+normal)?(?:\s*·\s*super\s*kart)?$/i.test(nome.trim())) return 'Traçado não confirmado';
  return nome;
}

export const tracadoConfirmado = (nome: string) => !/^Traçado (?:principal|não confirmado)(?:$|\s*·)/i.test(nome);

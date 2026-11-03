/** A familia vem do cadastro, nunca de comparar prefixos dos nomes. */
export function validarFamiliaEquipes(equipes: { id: number; grupoId: number | null }[]) {
  const familias = new Set(equipes.map(q => q.grupoId == null ? `inscricao:${q.id}` : `familia:${q.grupoId}`));
  if (familias.size > 1) throw new Error('Selecione apenas inscrições da mesma família de equipes.');
}

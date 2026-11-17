/**
 * Colunas da promoção do aniversariante e das baterias de campeonato (migrations/ops/0020_aniversario_campeonato.sql).
 * Garantidas uma vez por processo, para o servidor não depender de alguém rodar a migration à mão.
 */

/** Regra do site: aniversariante + pelo menos 10 convidados pagantes → a corrida dele sai por R$ 90,00. */
export const ANIVERSARIO_MIN_CONVIDADOS = 10;
export const ANIVERSARIO_PRECO_PADRAO = 9000;

let pronto: Promise<void> | null = null;

export function garantirColunasEventos(): Promise<void> {
  // No Postgres as colunas (kart.reserva_grupo.aniversario/preco_aniversariante_centavos, kart.bateria.campeonato)
  // vêm das migrations do Kartódromo OS; nada a criar em tempo de execução.
  if (!pronto) pronto = Promise.resolve();
  return pronto;
}

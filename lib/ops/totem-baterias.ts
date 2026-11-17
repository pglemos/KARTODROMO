export type TotemBateriaCandidate = {
  id: number;
  nome: string;
  inicio: string;
  vagas: number;
  ocupadas: number;
  livres: number;
  tipoKart: string;
  status: string;
  autoAtendimento: boolean | number | string;
  reservaFechada: boolean | number | string;
  dataHoje: string;
  campeonato?: boolean | number;
};

export const TOTEM_BATERIAS_SQL = `
      select b.id, b.nome, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.vagas, b.tipo_kart "tipoKart",
             b.status, b.auto_atendimento "autoAtendimento", b.reserva_fechada "reservaFechada", b.campeonato,
             to_char(now(), 'YYYY-MM-DD') "dataHoje",
             (select count(*) from kart.inscricao i where i.bateria_id = b.id and i.status <> 'cancelada') ocupadas
      from kart.bateria b
      where b.status = 'aberta' and b.auto_atendimento and not b.reserva_fechada
        and b.inicio >= current_date
        and b.inicio < current_date + 1
      order by b.inicio`;

function isTrue(value: boolean | number | string) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function isFalse(value: boolean | number | string) {
  return value === false || value === 0 || value === '0' || value === 'false';
}

export function bateriaDisponivelNoTotem(row: Pick<TotemBateriaCandidate, 'inicio' | 'status' | 'autoAtendimento' | 'reservaFechada' | 'livres'>, dataHoje: string): boolean {
  return row.status === 'aberta'
    && isTrue(row.autoAtendimento)
    && isFalse(row.reservaFechada)
    && String(row.inicio).slice(0, 10) === dataHoje
    && Number(row.livres) > 0;
}

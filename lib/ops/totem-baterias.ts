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
};

export const TOTEM_BATERIAS_SQL = `
      SELECT b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Vagas vagas, b.TipoKart tipoKart,
             b.Status status, b.AutoAtendimento autoAtendimento, b.ReservaFechada reservaFechada,
             CONVERT(varchar(10), SYSDATETIME(), 126) dataHoje,
             (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas
      FROM dbo.Bateria b
      WHERE b.Status = 'aberta' AND b.AutoAtendimento = 1 AND b.ReservaFechada = 0
        AND b.Inicio >= CAST(SYSDATETIME() AS date)
        AND b.Inicio < DATEADD(day, 1, CAST(SYSDATETIME() AS date))
      ORDER BY b.Inicio`;

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

/** Mesmo vinculo para a recepcao e o grid: somente o evento desta bateria e o piloto ativo. */
export const ENDURANCE_VINCULO_SQL = `OUTER APPLY (
  SELECT TOP 1 ep.Pulseira pulseira, eq.Id equipeId,
    STUFF((SELECT ' / ' + qs.Nome FROM dbo.EndurancePilotoInscricao ps
      JOIN dbo.EnduranceEquipe qs ON qs.Id=ps.EquipeId AND qs.EventoId=ps.EventoId
      WHERE ps.Id=ep.Id AND ps.Ativo=1 ORDER BY qs.Nome
      FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,3,'') equipe
  FROM dbo.EnduranceEvento ev
  JOIN dbo.EndurancePiloto ep ON ep.EventoId = ev.Id AND ep.ClienteId = i.ClienteId AND ep.Ativo = 1
  JOIN dbo.EnduranceEquipe eq ON eq.Id = ep.EquipeId AND eq.EventoId = ev.Id
  WHERE ev.BateriaId = i.BateriaId AND ev.Ativo = 1
  ORDER BY ev.Id DESC, ep.Id DESC
) endurance`;

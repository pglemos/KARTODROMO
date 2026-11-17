/** Mesmo vinculo para a recepcao e o grid: somente o evento desta bateria e o piloto ativo. Usado depois de `from kart.inscricao i ...`. */
export const ENDURANCE_VINCULO_SQL = `left join lateral (
  select ep.pulseira, eq.id "equipeId",
    (select string_agg(qs.nome, ' / ' order by qs.nome) from kart.endurance_piloto_inscricao ps
      join kart.endurance_equipe qs on qs.id = ps.equipe_id and qs.evento_id = ps.evento_id
      where ps.id = ep.id and ps.ativo) equipe
  from kart.endurance_evento ev
  join kart.endurance_piloto ep on ep.evento_id = ev.id and ep.cliente_id = i.cliente_id and ep.ativo
  join kart.endurance_equipe eq on eq.id = ep.equipe_id and eq.evento_id = ev.id
  where ev.bateria_id = i.bateria_id and ev.ativo
  order by ev.id desc, ep.id desc
  limit 1
) endurance on true`;

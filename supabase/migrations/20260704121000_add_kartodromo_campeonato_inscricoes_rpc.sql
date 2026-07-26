create extension if not exists pgcrypto with schema extensions;

create or replace function public.kartodromo_validate_championship_admin_key(p_admin_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if encode(digest(coalesce(p_admin_key, ''), 'sha256'), 'hex') <> '0219652e398778e1b3ecbf02359ce74b975a5ab535a7836b7ca8215382c120d8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
end;
$$;

create or replace function public.kartodromo_create_campeonato_inscricao(p_payload jsonb)
returns table(id uuid, protocol text, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.kartodromo_campeonato_inscricoes (
    protocol, campeonato_id, evento, modalidade, status, nome_equipe, nome_chefe,
    nome_completo, cpf, data_nascimento, idade, peso_kg, email, telefone, cidade,
    experiencia, nivel_atual, disponibilidade, participacao_desejada, interesse_ranking,
    janelas_preferidas, equipamento, equipamento_detalhes, contato_emergencia_nome,
    contato_emergencia_telefone, restricoes_medicas, alergias, medicamentos, objetivos,
    observacoes, quantidade_karts, pilotos, pagamento, aceites
  ) values (
    nullif(p_payload->>'protocol', ''),
    nullif(p_payload->>'campeonato_id', ''),
    nullif(p_payload->>'evento', ''),
    coalesce(nullif(p_payload->>'modalidade', ''), 'equipe'),
    coalesce(nullif(p_payload->>'status', ''), 'pendente'),
    nullif(p_payload->>'nome_equipe', ''),
    nullif(p_payload->>'nome_chefe', ''),
    nullif(p_payload->>'nome_completo', ''),
    nullif(p_payload->>'cpf', ''),
    nullif(p_payload->>'data_nascimento', ''),
    nullif(p_payload->>'idade', '')::integer,
    nullif(p_payload->>'peso_kg', '')::numeric,
    nullif(p_payload->>'email', ''),
    nullif(p_payload->>'telefone', ''),
    nullif(p_payload->>'cidade', ''),
    nullif(p_payload->>'experiencia', ''),
    nullif(p_payload->>'nivel_atual', ''),
    nullif(p_payload->>'disponibilidade', ''),
    nullif(p_payload->>'participacao_desejada', ''),
    nullif(p_payload->>'interesse_ranking', ''),
    nullif(p_payload->>'janelas_preferidas', ''),
    nullif(p_payload->>'equipamento', ''),
    nullif(p_payload->>'equipamento_detalhes', ''),
    nullif(p_payload->>'contato_emergencia_nome', ''),
    nullif(p_payload->>'contato_emergencia_telefone', ''),
    nullif(p_payload->>'restricoes_medicas', ''),
    nullif(p_payload->>'alergias', ''),
    nullif(p_payload->>'medicamentos', ''),
    nullif(p_payload->>'objetivos', ''),
    nullif(p_payload->>'observacoes', ''),
    nullif(p_payload->>'quantidade_karts', '')::integer,
    coalesce(p_payload->'pilotos', '[]'::jsonb),
    nullif(p_payload->>'pagamento', ''),
    coalesce(p_payload->'aceites', '{}'::jsonb)
  )
  returning kartodromo_campeonato_inscricoes.id, kartodromo_campeonato_inscricoes.protocol, kartodromo_campeonato_inscricoes.status;
end;
$$;

create or replace function public.kartodromo_list_campeonato_inscricoes(
  p_admin_key text,
  p_q text default null,
  p_status text default null,
  p_evento text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_data jsonb;
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.kartodromo_validate_championship_admin_key(p_admin_key);

  select count(*) into v_total
  from public.kartodromo_campeonato_inscricoes i
  where (p_status is null or p_status = '' or i.status = p_status)
    and (p_evento is null or p_evento = '' or i.evento = p_evento)
    and (
      v_q is null
      or i.protocol ilike '%' || v_q || '%'
      or i.evento ilike '%' || v_q || '%'
      or i.nome_equipe ilike '%' || v_q || '%'
      or i.nome_chefe ilike '%' || v_q || '%'
      or i.nome_completo ilike '%' || v_q || '%'
      or i.email ilike '%' || v_q || '%'
      or i.telefone ilike '%' || v_q || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) into v_data
  from (
    select *
    from public.kartodromo_campeonato_inscricoes i
    where (p_status is null or p_status = '' or i.status = p_status)
      and (p_evento is null or p_evento = '' or i.evento = p_evento)
      and (
        v_q is null
        or i.protocol ilike '%' || v_q || '%'
        or i.evento ilike '%' || v_q || '%'
        or i.nome_equipe ilike '%' || v_q || '%'
        or i.nome_chefe ilike '%' || v_q || '%'
        or i.nome_completo ilike '%' || v_q || '%'
        or i.email ilike '%' || v_q || '%'
        or i.telefone ilike '%' || v_q || '%'
      )
    order by i.created_at desc
    limit v_limit offset v_offset
  ) row_data;

  return jsonb_build_object('data', v_data, 'total', v_total);
end;
$$;

create or replace function public.kartodromo_update_campeonato_inscricao(
  p_admin_key text,
  p_id uuid,
  p_status text default null,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  perform public.kartodromo_validate_championship_admin_key(p_admin_key);

  if p_status is not null and p_status not in ('pendente', 'em_analise', 'confirmada', 'recusada', 'cancelada') then
    raise exception 'status_invalid' using errcode = '22023';
  end if;

  update public.kartodromo_campeonato_inscricoes
  set
    status = coalesce(p_status, status),
    admin_notes = case when p_admin_notes is null then admin_notes else nullif(trim(p_admin_notes), '') end,
    reviewed_at = case when p_status is null then reviewed_at else now() end
  where id = p_id
  returning to_jsonb(public.kartodromo_campeonato_inscricoes.*) into v_row;

  if v_row is null then
    raise exception 'registration_not_found' using errcode = '02000';
  end if;

  return v_row;
end;
$$;

grant execute on function public.kartodromo_create_campeonato_inscricao(jsonb) to anon, authenticated;
grant execute on function public.kartodromo_list_campeonato_inscricoes(text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.kartodromo_update_campeonato_inscricao(text, uuid, text, text) to anon, authenticated;

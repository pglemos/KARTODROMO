-- Public read model for the two-race Ultras stage.
-- The local LapTime bridge is the only writer. It stores the complete
-- calculated snapshot as JSON so the public site never needs LapTime or the
-- UDK service-role key.

create table if not exists public.live_stage_snapshots (
  stage_id uuid primary key references public.stages(id) on delete cascade,
  captured_at timestamptz not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists live_stage_snapshots_updated_at_idx
  on public.live_stage_snapshots (updated_at desc);

create or replace function public.set_live_stage_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_stage_snapshots_set_updated_at on public.live_stage_snapshots;
create trigger live_stage_snapshots_set_updated_at
before update on public.live_stage_snapshots
for each row execute function public.set_live_stage_snapshots_updated_at();

alter table public.live_stage_snapshots enable row level security;

grant select on public.live_stage_snapshots to anon, authenticated;

drop policy if exists "public can read live stage snapshots" on public.live_stage_snapshots;
create policy "public can read live stage snapshots"
on public.live_stage_snapshots
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.stages
    where stages.id = live_stage_snapshots.stage_id
      and stages.deleted_at is null
      and stages.status <> 'cancelled'
  )
);

alter table public.live_stage_snapshots replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'live_stage_snapshots'
     ) then
    execute 'alter publication supabase_realtime add table public.live_stage_snapshots';
  end if;
end;
$$;

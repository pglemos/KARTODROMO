create table if not exists public.kartodromo_campeonato_inscricoes (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  campeonato_id text,
  evento text not null,
  modalidade text not null default 'equipe' check (modalidade in ('equipe', 'individual')),
  status text not null default 'pendente' check (status in ('pendente', 'em_analise', 'confirmada', 'recusada', 'cancelada')),
  nome_equipe text,
  nome_chefe text,
  nome_completo text,
  cpf text,
  data_nascimento text,
  idade integer,
  peso_kg numeric(6,2),
  email text,
  telefone text,
  cidade text,
  experiencia text,
  nivel_atual text,
  disponibilidade text,
  participacao_desejada text,
  interesse_ranking text,
  janelas_preferidas text,
  equipamento text,
  equipamento_detalhes text,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  restricoes_medicas text,
  alergias text,
  medicamentos text,
  objetivos text,
  observacoes text,
  quantidade_karts integer,
  pilotos jsonb not null default '[]'::jsonb,
  pagamento text,
  aceites jsonb not null default '{}'::jsonb,
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kartodromo_campeonato_inscricoes enable row level security;

create index if not exists idx_kartodromo_campeonato_inscricoes_created_at
  on public.kartodromo_campeonato_inscricoes (created_at desc);

create index if not exists idx_kartodromo_campeonato_inscricoes_status
  on public.kartodromo_campeonato_inscricoes (status);

create index if not exists idx_kartodromo_campeonato_inscricoes_evento
  on public.kartodromo_campeonato_inscricoes (evento);

create or replace function public.set_kartodromo_campeonato_inscricoes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kartodromo_campeonato_inscricoes_updated_at on public.kartodromo_campeonato_inscricoes;

create trigger trg_kartodromo_campeonato_inscricoes_updated_at
before update on public.kartodromo_campeonato_inscricoes
for each row execute function public.set_kartodromo_campeonato_inscricoes_updated_at();

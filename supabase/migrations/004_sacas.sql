create table if not exists public.sacas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  descricao text,
  status text not null default 'aberta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sacas_created on public.sacas(created_at desc);
create index if not exists idx_sacas_status on public.sacas(status);

alter table public.sacas enable row level security;

create policy "Publico MVP - sacas select" on public.sacas for select using (true);
create policy "Publico MVP - sacas insert" on public.sacas for insert with check (true);
create policy "Publico MVP - sacas update" on public.sacas for update using (true) with check (true);
create policy "Publico MVP - sacas delete" on public.sacas for delete using (true);

alter table public.pacotes_lidos
  add column if not exists saca_id uuid references public.sacas(id) on delete set null;

create index if not exists idx_pacotes_saca on public.pacotes_lidos(saca_id);

create extension if not exists "uuid-ossp";

create table if not exists public.pacotes_lidos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  codigo_pacote text not null,
  tipo text,
  origem text not null default 'camera',
  metadados jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pacotes_created on public.pacotes_lidos(created_at desc);
create index if not exists idx_pacotes_codigo on public.pacotes_lidos(codigo_pacote);
create index if not exists idx_pacotes_user on public.pacotes_lidos(user_id);

alter table public.pacotes_lidos enable row level security;

create policy "Publico MVP - pacotes select" on public.pacotes_lidos for select using (true);
create policy "Publico MVP - pacotes insert" on public.pacotes_lidos for insert with check (true);
create policy "Publico MVP - pacotes update" on public.pacotes_lidos for update using (true) with check (true);
create policy "Publico MVP - pacotes delete" on public.pacotes_lidos for delete using (true);

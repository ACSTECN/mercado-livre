create table if not exists public.entregadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

alter table public.entregadores enable row level security;

drop policy if exists "entregadores_select_any" on public.entregadores;
drop policy if exists "entregadores_insert_any" on public.entregadores;
drop policy if exists "entregadores_update_any" on public.entregadores;
drop policy if exists "entregadores_delete_any" on public.entregadores;

create policy "entregadores_select_any" on public.entregadores for select using (true);
create policy "entregadores_insert_any" on public.entregadores for insert with check (true);
create policy "entregadores_update_any" on public.entregadores for update using (true) with check (true);
create policy "entregadores_delete_any" on public.entregadores for delete using (true);

create unique index if not exists idx_entregadores_nome_unico on public.entregadores (lower(trim(nome)));
create index if not exists idx_entregadores_created_at on public.entregadores (created_at desc);

alter table public.entregadores replica identity full;

alter publication supabase_realtime add table public.entregadores;

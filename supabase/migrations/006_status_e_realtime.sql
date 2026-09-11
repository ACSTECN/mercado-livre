alter table public.pacotes_lidos
  add column if not exists status text null;

comment on column public.pacotes_lidos.status is 'Status opcional do pacote: atualmente so permite "retorno"';

create index if not exists idx_pacotes_lidos_status on public.pacotes_lidos (status) where status is not null;

alter publication supabase_realtime add table public.pacotes_lidos;
alter publication supabase_realtime add table public.sacas;

drop policy if exists "pacotes_lidos_insert_any" on public.pacotes_lidos;
drop policy if exists "pacotes_lidos_update_any" on public.pacotes_lidos;
drop policy if exists "pacotes_lidos_delete_any" on public.pacotes_lidos;
drop policy if exists "pacotes_lidos_select_any" on public.pacotes_lidos;

create policy "pacotes_lidos_select_any" on public.pacotes_lidos
  for select using (true);

create policy "pacotes_lidos_insert_any" on public.pacotes_lidos
  for insert with check (true);

create policy "pacotes_lidos_update_any" on public.pacotes_lidos
  for update using (true) with check (true);

create policy "pacotes_lidos_delete_any" on public.pacotes_lidos
  for delete using (true);

drop policy if exists "sacas_select_any" on public.sacas;
drop policy if exists "sacas_insert_any" on public.sacas;
drop policy if exists "sacas_update_any" on public.sacas;
drop policy if exists "sacas_delete_any" on public.sacas;

create policy "sacas_select_any" on public.sacas
  for select using (true);

create policy "sacas_insert_any" on public.sacas
  for insert with check (true);

create policy "sacas_update_any" on public.sacas
  for update using (true) with check (true);

create policy "sacas_delete_any" on public.sacas
  for delete using (true);

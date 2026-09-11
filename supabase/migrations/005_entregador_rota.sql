alter table public.pacotes_lidos
  add column if not exists entregador text;

create index if not exists idx_pacotes_entregador on public.pacotes_lidos(entregador);

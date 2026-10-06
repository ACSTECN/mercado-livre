alter table pacotes_lidos add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_pacotes_lidos_updated_at on pacotes_lidos;
create trigger set_pacotes_lidos_updated_at
before update on pacotes_lidos
for each row execute function public.set_updated_at();

alter table sacas add column if not exists updated_at timestamptz default now();

drop trigger if exists set_sacas_updated_at on sacas;
create trigger set_sacas_updated_at
before update on sacas
for each row execute function public.set_updated_at();

alter table entregadores add column if not exists updated_at timestamptz default now();

drop trigger if exists set_entregadores_updated_at on entregadores;
create trigger set_entregadores_updated_at
before update on entregadores
for each row execute function public.set_updated_at();

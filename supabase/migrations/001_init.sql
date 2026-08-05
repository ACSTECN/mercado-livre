-- Enable UUID
create extension if not exists "uuid-ossp";

-- =============================================
-- TABELA: planilhas
-- =============================================
create table if not exists public.planilhas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  nome_arquivo text not null,
  hash_arquivo text not null unique,
  total_registros int not null default 0,
  colunas jsonb not null default '{}'::jsonb,
  mapeamento_colunas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planilhas_user on public.planilhas(user_id);

-- =============================================
-- TABELA: enderecos_planilha
-- =============================================
create table if not exists public.enderecos_planilha (
  id uuid primary key default uuid_generate_v4(),
  planilha_id uuid not null references public.planilhas(id) on delete cascade,
  codigo text not null,
  endereco_completo text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  endereco_normalizado text,
  linha_original jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_enderecos_planilha on public.enderecos_planilha(planilha_id);
create index if not exists idx_enderecos_normalizado on public.enderecos_planilha(endereco_normalizado);
create index if not exists idx_enderecos_cep on public.enderecos_planilha(cep);

-- =============================================
-- TABELA: historico_consultas
-- =============================================
create table if not exists public.historico_consultas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  planilha_id uuid references public.planilhas(id) on delete set null,
  imagem_url text,
  texto_ocr text,
  endereco_estruturado jsonb,
  endereco_encontrado_id uuid references public.enderecos_planilha(id) on delete set null,
  codigo_encontrado text,
  confianca numeric(5,2),
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_user on public.historico_consultas(user_id);
create index if not exists idx_historico_created on public.historico_consultas(created_at desc);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
alter table public.planilhas enable row level security;
alter table public.enderecos_planilha enable row level security;
alter table public.historico_consultas enable row level security;

-- Politicas: por enquanto, deixar aberto (MVP). Ajustar quando auth estiver ativo.
create policy "Publico MVP - planilhas" on public.planilhas for all using (true) with check (true);
create policy "Publico MVP - enderecos" on public.enderecos_planilha for all using (true) with check (true);
create policy "Publico MVP - historico" on public.historico_consultas for all using (true) with check (true);

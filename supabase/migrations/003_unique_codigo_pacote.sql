alter table public.pacotes_lidos
  add constraint pacotes_lidos_codigo_pacote_key
  unique (codigo_pacote);

-- Rodar no SQL Editor do Supabase
alter table produtos add column if not exists oferta boolean default false;
alter table produtos add column if not exists frete_gratis boolean default false;
alter table produtos add column if not exists entrega_24h boolean default false;

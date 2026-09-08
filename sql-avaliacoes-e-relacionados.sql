-- Rodar no SQL Editor do Supabase

-- 1. Colunas novas na tabela produtos
alter table produtos add column if not exists relacionados_ids integer[] default '{}';
alter table produtos add column if not exists cores jsonb default '[]';

-- 2. Tabela de avaliações
create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id integer references produtos(id) on delete cascade not null,
  usuario_id uuid references auth.users(id) on delete cascade not null,
  nota integer check (nota between 1 and 5) not null,
  texto text,
  created_at timestamp with time zone default now(),
  unique(produto_id, usuario_id) -- 1 avaliação por usuário por produto
);

-- Índice
create index if not exists avaliacoes_produto_id_idx on avaliacoes(produto_id);

-- RLS
alter table avaliacoes enable row level security;

-- Qualquer um pode ler avaliações
create policy "avaliacoes_leitura" on avaliacoes
  for select using (true);

-- Só o próprio usuário pode inserir/editar
create policy "avaliacoes_insert" on avaliacoes
  for insert with check (auth.uid() = usuario_id);

create policy "avaliacoes_update" on avaliacoes
  for update using (auth.uid() = usuario_id);

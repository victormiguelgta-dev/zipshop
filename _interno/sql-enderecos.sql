-- Rodar no SQL Editor do Supabase
-- Tabela de endereços salvos por usuário

create table if not exists enderecos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade not null,
  apelido text default 'Endereço',
  rua text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  referencia text,
  favorito boolean default false,
  created_at timestamp with time zone default now()
);

-- Índice para busca por usuário
create index if not exists enderecos_usuario_id_idx on enderecos(usuario_id);

-- RLS: cada usuário só vê e altera os próprios endereços
alter table enderecos enable row level security;

create policy "usuarios_proprios_enderecos" on enderecos
  for all using (auth.uid() = usuario_id);

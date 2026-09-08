-- Rodar no SQL Editor do Supabase

-- Tabela principal de cupons
create table if not exists cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  descricao text,
  tipo text check (tipo in ('percentual', 'fixo', 'frete_gratis')) not null,
  valor numeric default 0, -- % ou R$ (ignorado em frete_gratis)
  pedido_minimo numeric default 0,
  uso_maximo integer, -- null = ilimitado
  uso_atual integer default 0,
  uso_unico_por_usuario boolean default true,
  publico boolean default true, -- false = só para usuario_id específico
  usuario_id uuid references auth.users(id), -- null = todos
  valido_ate timestamp with time zone,
  ativo boolean default true,
  created_at timestamp with time zone default now()
);

-- Tabela de usos (histórico)
create table if not exists cupons_usos (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid references cupons(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  pedido_id uuid,
  created_at timestamp with time zone default now()
);

-- Colunas extras na tabela pedidos
alter table pedidos add column if not exists cupom_codigo text;
alter table pedidos add column if not exists cupom_desconto numeric default 0;

-- RLS cupons: todos podem ver cupons públicos ativos
alter table cupons enable row level security;
create policy "cupons_leitura_publica" on cupons for select using (ativo = true);
create policy "cupons_admin_total" on cupons for all using (true); -- admin bypassa via service key

-- RLS cupons_usos
alter table cupons_usos enable row level security;
create policy "usos_proprios" on cupons_usos for select using (auth.uid() = usuario_id);
create policy "usos_insert" on cupons_usos for insert with check (auth.uid() = usuario_id);

-- Função para incrementar uso (chamada após pedido confirmado)
create or replace function incrementar_uso_cupom(cupom_id_param uuid)
returns void language plpgsql security definer as $$
begin
  update cupons set uso_atual = uso_atual + 1 where id = cupom_id_param;
end;
$$;

-- Exemplos de cupons para testar
insert into cupons (codigo, descricao, tipo, valor, publico, ativo) values
  ('BEMVINDO10', '10% de desconto para novos clientes', 'percentual', 10, true, true),
  ('FRETEGRATIS', 'Frete grátis sem mínimo', 'frete_gratis', 0, true, true),
  ('ZIP5', 'R$ 5 de desconto', 'fixo', 5, true, true)
on conflict (codigo) do nothing;

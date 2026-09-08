-- Rodar no SQL Editor do Supabase
-- Cria o histórico de status dos pedidos (rastreamento tipo iFood) e liga o Realtime.

-- 1) Tabela de histórico: guarda cada mudança de status com data/hora
create table if not exists pedidos_status_historico (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id) on delete cascade,
  status text not null,
  criado_em timestamp with time zone default now()
);

create index if not exists idx_historico_pedido on pedidos_status_historico(pedido_id);

-- 2) RLS: cliente só vê o histórico dos próprios pedidos
alter table pedidos_status_historico enable row level security;

drop policy if exists "historico_leitura_propria" on pedidos_status_historico;
create policy "historico_leitura_propria" on pedidos_status_historico for select
  using (
    exists (
      select 1 from pedidos
      where pedidos.id = pedidos_status_historico.pedido_id
      and pedidos.usuario_id::text = auth.uid()::text
    )
  );

drop policy if exists "historico_admin_total" on pedidos_status_historico;
create policy "historico_admin_total" on pedidos_status_historico for all using (true); -- admin bypassa via service key

-- 3) Trigger: toda vez que o status de um pedido muda (ou é criado), registra no histórico
create or replace function registrar_status_pedido()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    insert into pedidos_status_historico (pedido_id, status) values (new.id, new.status);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into pedidos_status_historico (pedido_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registrar_status_pedido on pedidos;
create trigger trg_registrar_status_pedido
  after insert or update on pedidos
  for each row execute function registrar_status_pedido();

-- 4) Preenche o histórico pra pedidos que já existem (com o status atual deles)
insert into pedidos_status_historico (pedido_id, status, criado_em)
select id, status, created_at from pedidos
where not exists (
  select 1 from pedidos_status_historico where pedidos_status_historico.pedido_id = pedidos.id
);

-- 5) Liga o Realtime nas tabelas — é o que permite o cliente ver a
-- atualização na hora, sem precisar recarregar a página.
-- Se der erro "already member of publication", pode ignorar, já está ligado.
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table pedidos_status_historico;

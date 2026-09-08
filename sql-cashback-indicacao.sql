-- ============================================================
-- CASHBACK + INDICAÇÃO (AFILIAÇÃO) POR PRODUTO
-- Rodar no SQL Editor do Supabase.
-- ============================================================

-- 1) Configuração por produto: % de cashback pra quem compra e
-- % de comissão pra quem indicou a compra.
alter table produtos add column if not exists cashback_percentual numeric default 0;
alter table produtos add column if not exists indicacao_percentual numeric default 0;

-- 2) Código de indicação pessoal de cada cliente (curto, fácil de
-- compartilhar por WhatsApp: ex. "IND-A1B2C3")
alter table usuarios add column if not exists codigo_indicacao text unique;

update usuarios set codigo_indicacao = upper(substr(md5(id::text || random()::text || clock_timestamp()::text), 1, 6))
where codigo_indicacao is null;

create or replace function gerar_codigo_indicacao()
returns trigger language plpgsql as $$
begin
  if new.codigo_indicacao is null then
    new.codigo_indicacao := upper(substr(md5(new.id::text || random()::text || clock_timestamp()::text), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gerar_codigo_indicacao on usuarios;
create trigger trg_gerar_codigo_indicacao before insert on usuarios
  for each row execute function gerar_codigo_indicacao();

-- 3) O pedido guarda qual código de indicação foi usado (se houver) e
-- quem é o indicador, além de quanto saldo o cliente resgatou nele.
alter table pedidos add column if not exists codigo_indicacao_usado text;
alter table pedidos add column if not exists indicador_id uuid references auth.users(id);
alter table pedidos add column if not exists saldo_usado numeric default 0;

-- 4) Extrato/carteira de saldo — todo crédito (cashback, indicação) e
-- resgate (uso do saldo pra abater numa compra) fica registrado aqui,
-- assim o saldo do cliente é sempre a soma dessa tabela.
create table if not exists saldo_extrato (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade not null,
  pedido_id uuid references pedidos(id) on delete set null,
  tipo text not null check (tipo in ('cashback','indicacao','resgate')),
  valor numeric not null, -- resgate entra negativo
  descricao text,
  criado_em timestamp with time zone default now()
);
create index if not exists idx_saldo_usuario on saldo_extrato(usuario_id);

alter table saldo_extrato enable row level security;

drop policy if exists "saldo_leitura_propria" on saldo_extrato;
create policy "saldo_leitura_propria" on saldo_extrato for select
  using (usuario_id::text = auth.uid()::text);

drop policy if exists "saldo_admin_total" on saldo_extrato;
create policy "saldo_admin_total" on saldo_extrato for all using (true); -- admin bypassa via service key

-- 5) O CORAÇÃO DO SISTEMA: quando um pedido é marcado como "entregue",
-- credita automaticamente o cashback de cada item pro comprador, e a
-- comissão de indicação pro indicador (se houver). Só credita uma vez
-- por pedido, mesmo que o status mude pra lá e pra cá.
create or replace function creditar_cashback_indicacao()
returns trigger language plpgsql security definer as $$
declare
  item jsonb;
  produto_row produtos%rowtype;
  valor_item numeric;
  valor_cashback numeric;
  valor_indicacao numeric;
begin
  if (tg_op = 'UPDATE' and new.status = 'entregue' and old.status is distinct from 'entregue') then

    if exists (select 1 from saldo_extrato where pedido_id = new.id and tipo in ('cashback','indicacao')) then
      return new; -- já creditado antes, evita duplicar
    end if;

    for item in select * from jsonb_array_elements(new.itens)
    loop
      select * into produto_row from produtos where id = (item->>'produto_id')::int;
      if produto_row.id is null then continue; end if;

      valor_item := coalesce((item->>'preco')::numeric, 0) * coalesce((item->>'quantidade')::numeric, 1);

      if coalesce(produto_row.cashback_percentual, 0) > 0 then
        valor_cashback := round(valor_item * produto_row.cashback_percentual / 100, 2);
        if valor_cashback > 0 then
          insert into saldo_extrato (usuario_id, pedido_id, tipo, valor, descricao)
          values (new.usuario_id, new.id, 'cashback', valor_cashback, 'Cashback: ' || produto_row.name);
        end if;
      end if;

      if new.indicador_id is not null and coalesce(produto_row.indicacao_percentual, 0) > 0 then
        valor_indicacao := round(valor_item * produto_row.indicacao_percentual / 100, 2);
        if valor_indicacao > 0 then
          insert into saldo_extrato (usuario_id, pedido_id, tipo, valor, descricao)
          values (new.indicador_id, new.id, 'indicacao', valor_indicacao, 'Indicação: ' || produto_row.name);
        end if;
      end if;
    end loop;

  end if;
  return new;
end;
$$;

drop trigger if exists trg_creditar_cashback_indicacao on pedidos;
create trigger trg_creditar_cashback_indicacao
  after update on pedidos
  for each row execute function creditar_cashback_indicacao();

-- ============================================================
-- FIM. Avisos de "already exists" podem ser ignorados.
-- ============================================================

-- 1) Uma avaliação por COMPRA (antes: uma por produto, para sempre).
--    Cada avaliação fica ligada ao pedido entregue que ela avalia; quem
--    compra o mesmo produto de novo pode avaliar de novo, e cada avaliação
--    aprovada dá o bônus de saldo.
-- Roda depois de _interno/sql-avaliacoes-atualizar-nota.sql.

-- ── 1. Avaliação por compra ──────────────────────────────────────────
alter table avaliacoes add column if not exists pedido_id uuid references pedidos(id) on delete set null;

-- Avaliações antigas: liga à primeira compra entregue daquele produto
update avaliacoes a set pedido_id = (
  select p.id from pedidos p
  where p.usuario_id = a.usuario_id::text and p.status = 'entregue'
    and p.itens @> jsonb_build_array(jsonb_build_object('produto_id', a.produto_id))
  order by p.created_at limit 1)
where a.pedido_id is null;

alter table avaliacoes drop constraint if exists avaliacoes_produto_id_usuario_id_key;
alter table avaliacoes add constraint avaliacoes_pedido_produto_key unique (pedido_id, produto_id);
create index if not exists avaliacoes_usuario_idx on avaliacoes (usuario_id);

-- Cliente só avalia (ou reenvia) um pedido SEU, já entregue, que tenha o produto
drop policy if exists avaliacoes_insert on avaliacoes;
create policy avaliacoes_insert on avaliacoes for insert to authenticated
with check (
  (select auth.uid()) = usuario_id and exists (
    select 1 from pedidos p
    where p.id = avaliacoes.pedido_id
      and p.usuario_id = (select auth.uid())::text
      and p.status = 'entregue'
      and p.itens @> jsonb_build_array(jsonb_build_object('produto_id', avaliacoes.produto_id))));

drop policy if exists avaliacoes_update on avaliacoes;
create policy avaliacoes_update on avaliacoes for update to authenticated
using ((select auth.uid()) = usuario_id)
with check (
  (select auth.uid()) = usuario_id and exists (
    select 1 from pedidos p
    where p.id = avaliacoes.pedido_id
      and p.usuario_id = (select auth.uid())::text
      and p.status = 'entregue'
      and p.itens @> jsonb_build_array(jsonb_build_object('produto_id', avaliacoes.produto_id))));

-- Moderação: cliente não troca o pedido nem o produto ao reenviar
create or replace function public.avaliacoes_moderacao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prefixo text;
  v_url text;
begin
  if is_admin() then
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      new.moderado_em := now();
    end if;
    return new;
  end if;

  new.status := 'pendente';
  new.motivo_reprovacao := null;
  new.moderado_em := null;
  if tg_op = 'UPDATE' then
    new.usuario_id := old.usuario_id;
    new.produto_id := old.produto_id;
    new.pedido_id  := old.pedido_id;
  elsif new.pedido_id is null then
    raise exception 'Avaliação precisa estar ligada a uma compra';
  end if;

  v_prefixo := 'https://kkliwdphrdbguclsvxcw.supabase.co/storage/v1/object/public/avaliacoes/'
               || new.usuario_id::text || '/';
  foreach v_url in array (new.fotos || new.videos) loop
    if left(v_url, length(v_prefixo)) <> v_prefixo then
      raise exception 'Arquivo de avaliação inválido';
    end if;
  end loop;

  return new;
end;
$function$;

-- Bônus: um por avaliação aprovada (agora pode haver uma por compra)
update saldo_extrato s set pedido_id = a.pedido_id
from avaliacoes a
where s.tipo = 'avaliacao' and s.pedido_id is null
  and s.usuario_id = a.usuario_id and s.produto_id = a.produto_id and a.pedido_id is not null;

drop index if exists idx_saldo_bonus_avaliacao_unico;
create unique index idx_saldo_bonus_avaliacao_unico
  on saldo_extrato (usuario_id, produto_id, pedido_id) where tipo = 'avaliacao';

create or replace function public.creditar_bonus_avaliacao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_min_caracteres constant int := 100;
  v_bonus_simples  constant numeric := 0.50;
  v_bonus_completo constant numeric := 1.00;
  v_bonus numeric;
  v_nome text;
begin
  if new.status <> 'aprovada' or (tg_op = 'UPDATE' and old.status = 'aprovada') then
    return new;
  end if;

  v_bonus := case
    when char_length(trim(coalesce(new.texto, ''))) >= v_min_caracteres
     and cardinality(new.fotos) >= 1
     and cardinality(new.videos) >= 1
    then v_bonus_completo else v_bonus_simples end;

  select name into v_nome from produtos where id = new.produto_id;

  insert into saldo_extrato (usuario_id, produto_id, pedido_id, tipo, valor, descricao)
  values (new.usuario_id, new.produto_id, new.pedido_id, 'avaliacao', v_bonus,
          'Avaliação: ' || coalesce(v_nome, 'produto #' || new.produto_id))
  on conflict (usuario_id, produto_id, pedido_id) where tipo = 'avaliacao'
  do update set valor = greatest(saldo_extrato.valor, excluded.valor);

  return new;
end;
$function$;

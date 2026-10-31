-- 1) Seções da Home: as faixas de produtos da página inicial ("Chega
--    amanhã", "Em alta"...) passam a ser criadas/editadas no painel
--    (admin/secoes.html). Sem nenhuma seção ativa, a home volta às faixas fixas.
-- 2) Motivo do cancelamento: o cliente escolhe um motivo ao cancelar e o
--    admin vê em Pedidos.
-- 3) Pagamento em dinheiro na entrega desligado (o site já esconde a opção;
--    aqui o banco também recusa). Pra religar: drop trigger trg_sem_dinheiro on pedidos;
-- 4) Vídeo na avaliação desligado por enquanto: o botão aparece como "em
--    breve" e o banco recusa vídeo novo. Pra religar:
--    drop trigger trg_avaliacao_sem_video on avaliacoes;

-- ── 1. Seções da Home ────────────────────────────────────────────────
create table if not exists secoes_home (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 40),
  icone text check (icone is null or icone ~ '^[a-zA-Z]{1,30}$'),
  tipo text not null default 'ofertas'
    check (tipo in ('ofertas', 'entrega_24h', 'frete_gratis', 'categoria', 'manual', 'todos')),
  categoria text,
  produtos_ids integer[] not null default '{}',
  limite integer not null default 8 check (limite between 2 and 40),
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table secoes_home enable row level security;

drop policy if exists secoes_home_ler on secoes_home;
create policy secoes_home_ler on secoes_home for select using (ativo or is_admin());
drop policy if exists secoes_home_admin on secoes_home;
create policy secoes_home_admin on secoes_home for all to authenticated
  using (is_admin()) with check (is_admin());

-- Começa igual à home de hoje
insert into secoes_home (titulo, icone, tipo, limite, ordem)
select * from (values ('CHEGA AMANHÃ', 'raio', 'ofertas', 20, 1), ('EM ALTA', null, 'todos', 8, 2)) v(titulo, icone, tipo, limite, ordem)
where not exists (select 1 from secoes_home);

-- ── 2. Motivo do cancelamento ────────────────────────────────────────
alter table pedidos add column if not exists motivo_cancelamento text
  check (motivo_cancelamento is null or char_length(motivo_cancelamento) <= 400);

drop function if exists public.cancelar_meu_pedido(uuid);
create or replace function public.cancelar_meu_pedido(p_pedido_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Faça login para cancelar o pedido.';
  end if;

  select status into v_status
    from pedidos
   where id = p_pedido_id and usuario_id = auth.uid()::text
   for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_status <> 'pendente' then
    raise exception 'Este pedido não pode mais ser cancelado.';
  end if;

  update pedidos
     set status = 'cancelado',
         motivo_cancelamento = nullif(left(regexp_replace(trim(coalesce(p_motivo, '')), '[<>]', '', 'g'), 400), '')
   where id = p_pedido_id;
end;
$function$;

revoke execute on function public.cancelar_meu_pedido(uuid, text) from public, anon;
grant execute on function public.cancelar_meu_pedido(uuid, text) to authenticated;

-- ── 3. Sem pagamento em dinheiro na entrega ──────────────────────────
create or replace function public.recusar_pagamento_dinheiro()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.pagamento = 'dinheiro' then
    raise exception 'Pagamento na entrega não está disponível. Use PIX ou cartão.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sem_dinheiro on pedidos;
create trigger trg_sem_dinheiro before insert on pedidos
for each row execute function recusar_pagamento_dinheiro();

-- ── 4. Avaliação sem vídeo (por enquanto) ────────────────────────────
create or replace function public.recusar_video_avaliacao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if is_admin() then
    return new;
  end if;
  if cardinality(coalesce(new.videos, '{}')) > 0
     and (tg_op = 'INSERT' or new.videos is distinct from old.videos) then
    raise exception 'Envio de vídeo na avaliação ainda não está disponível.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_avaliacao_sem_video on avaliacoes;
create trigger trg_avaliacao_sem_video before insert or update on avaliacoes
for each row execute function recusar_video_avaliacao();

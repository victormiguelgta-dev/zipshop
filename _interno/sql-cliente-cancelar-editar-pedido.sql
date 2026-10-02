-- =====================================================================
-- Cliente cancelar / editar o próprio pedido
-- ---------------------------------------------------------------------
-- A tabela "pedidos" não tem política de UPDATE para o cliente (só admin),
-- então o update direto do site era ignorado em silêncio pelo RLS e o
-- botão mostrava "Pedido cancelado" sem cancelar nada.
-- Em vez de abrir UPDATE geral (o cliente poderia mexer em total, status
-- etc.), usamos funções que só fazem a ação permitida, no pedido do
-- próprio usuário e apenas enquanto ele está "pendente" (Recebido).
-- =====================================================================

create or replace function public.cancelar_meu_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  update pedidos set status = 'cancelado' where id = p_pedido_id;
end;
$$;

create or replace function public.editar_dados_meu_pedido(
  p_pedido_id uuid,
  p_nome text,
  p_telefone text,
  p_bairro text,
  p_endereco text,
  p_referencia text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_nome text := left(btrim(coalesce(p_nome, '')), 100);
  v_tel text := left(btrim(coalesce(p_telefone, '')), 30);
begin
  if auth.uid() is null then
    raise exception 'Faça login para editar o pedido.';
  end if;

  select status into v_status
    from pedidos
   where id = p_pedido_id and usuario_id = auth.uid()::text
   for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_status <> 'pendente' then
    raise exception 'Este pedido não pode mais ser editado.';
  end if;

  update pedidos
     set endereco = coalesce(endereco, '{}'::jsonb) || jsonb_build_object(
           'nome', v_nome,
           'telefone', v_tel,
           'bairro', left(btrim(coalesce(p_bairro, '')), 100),
           'endereco', left(btrim(coalesce(p_endereco, '')), 200),
           'referencia', left(btrim(coalesce(p_referencia, '')), 200)
         ),
         usuario_nome = v_nome,
         usuario_telefone = v_tel
   where id = p_pedido_id;
end;
$$;

revoke all on function public.cancelar_meu_pedido(uuid) from public, anon;
grant execute on function public.cancelar_meu_pedido(uuid) to authenticated;
revoke all on function public.editar_dados_meu_pedido(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.editar_dados_meu_pedido(uuid, text, text, text, text, text) to authenticated;

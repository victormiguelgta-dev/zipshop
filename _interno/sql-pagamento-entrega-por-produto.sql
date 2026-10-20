-- ============================================================
-- "ACEITA PAGAMENTO NA ENTREGA" EM CADA PRODUTO
-- Rodar no SQL Editor do Supabase (já aplicado no projeto Zipshop).
--
--  * produtos.aceita_pagamento_entrega: marcado no cadastro do produto.
--    Padrão: sim para produtos da loja, não para os do fornecedor.
--  * Se o pedido tiver qualquer produto que não aceita, o banco recusa
--    pagamento 'dinheiro' (o checkout já esconde a opção).
-- ============================================================

alter table produtos add column if not exists aceita_pagamento_entrega boolean not null default true;
update produtos set aceita_pagamento_entrega = false where tipo_estoque = 'dropshipping';

do $mig$
declare def text;
begin
  def := pg_get_functiondef('public.validar_pedido_antes_de_inserir'::regproc);
  if position('aceita_pagamento_entrega' in def) > 0 then
    return; -- já aplicado
  end if;
  if position('  new.itens := itens_validados;' in def) = 0 then
    raise exception 'validar_pedido_antes_de_inserir mudou; revisar migração';
  end if;
  def := replace(def, '  new.itens := itens_validados;', $$  new.itens := itens_validados;
  -- Produto que não aceita pagamento na entrega (opção do cadastro)
  if new.pagamento = 'dinheiro' and exists (
    select 1 from jsonb_array_elements(new.itens) e
    join produtos pr on pr.id = (e->>'produto_id')::int
    where pr.aceita_pagamento_entrega = false
  ) then
    raise exception 'PAGAMENTO_INVALIDO: um dos produtos não aceita pagamento na entrega. Pague por PIX ou cartão.';
  end if;$$);
  execute def;
end
$mig$;

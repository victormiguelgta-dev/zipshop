-- =====================================================================
-- Entrega "fornecedor" (produtos de dropshipping, 5 a 15 dias)
-- ---------------------------------------------------------------------
-- O checkout oferecia Rota (24-48h) e Exclusiva para produto que vem do
-- fornecedor. Agora:
--   * tipo_entrega aceita 'fornecedor';
--   * se o pedido tem QUALQUER item com tipo_estoque = 'dropshipping',
--     o banco força tipo_entrega = 'fornecedor' (frete na regra da rota);
--   * pedido sem item de fornecedor não pode usar 'fornecedor' (vira rota);
--   * pagamento na entrega (dinheiro) não é aceito para fornecedor.
-- Aplicado editando as funções existentes com replace() para não
-- reescrever o resto da lógica delas.
-- =====================================================================
do $mig$
declare def text;
begin
  -- 1) Lista branca do tipo de entrega
  def := pg_get_functiondef('public.blindar_campos_pedido'::regproc);
  if position($$('rota', 'exclusiva')$$ in def) = 0 then
    raise exception 'blindar_campos_pedido mudou; revisar migração';
  end if;
  def := replace(def, $$('rota', 'exclusiva')$$, $$('rota', 'exclusiva', 'fornecedor')$$);
  execute def;

  -- 2) Validação: decide o tipo pelo estoque real dos itens
  def := pg_get_functiondef('public.validar_pedido_antes_de_inserir'::regproc);
  if position('  qtd_pedida numeric;' in def) = 0
     or position('    subtotal_real := subtotal_real + (preco_item * qtd_pedida);' in def) = 0
     or position('  new.itens := itens_validados;' in def) = 0 then
    raise exception 'validar_pedido_antes_de_inserir mudou; revisar migração';
  end if;
  def := replace(def, '  qtd_pedida numeric;', $$  qtd_pedida numeric;
  tem_fornecedor boolean := false;$$);
  def := replace(def, '    subtotal_real := subtotal_real + (preco_item * qtd_pedida);', $$    if produto_row.tipo_estoque = 'dropshipping' then
      tem_fornecedor := true;
    end if;
    subtotal_real := subtotal_real + (preco_item * qtd_pedida);$$);
  def := replace(def, '  new.itens := itens_validados;', $$  new.itens := itens_validados;

  -- Produto do fornecedor: o pedido todo vai como "fornecedor" (5 a 15 dias)
  if tem_fornecedor then
    new.tipo_entrega := 'fornecedor';
    if new.pagamento = 'dinheiro' then
      raise exception 'PAGAMENTO_INVALIDO: produtos enviados pelo fornecedor precisam ser pagos por PIX ou cartão';
    end if;
  elsif new.tipo_entrega = 'fornecedor' then
    new.tipo_entrega := 'rota';
  end if;$$);
  execute def;
end
$mig$;

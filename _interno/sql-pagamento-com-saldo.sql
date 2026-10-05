-- =====================================================================
-- Pedido pago 100% com saldo (ou saldo + cupom)
-- ---------------------------------------------------------------------
-- Antes, quando o saldo cobria tudo, o pedido ficava gravado com a forma
-- escolhida (ex.: "dinheiro") e a loja podia cobrar o cliente sem precisar.
-- Agora:
--   * pagamento aceita 'saldo';
--   * se o total calculado pelo banco der zero, o banco grava
--     pagamento = 'saldo' (vale qualquer forma enviada pelo navegador);
--   * 'saldo' com total maior que zero é recusado.
-- O status continua 'pendente' (Recebido), igual aos outros pedidos.
-- =====================================================================
do $mig$
declare def text;
begin
  def := pg_get_functiondef('public.blindar_campos_pedido'::regproc);
  if position($$('pix', 'cartao', 'dinheiro')$$ in def) = 0 then
    raise exception 'blindar_campos_pedido mudou; revisar migração';
  end if;
  def := replace(def, $$('pix', 'cartao', 'dinheiro')$$, $$('pix', 'cartao', 'dinheiro', 'saldo')$$);
  execute def;

  def := pg_get_functiondef('public.validar_pedido_antes_de_inserir'::regproc);
  if position('  new.total := subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete;' in def) = 0 then
    raise exception 'validar_pedido_antes_de_inserir mudou; revisar migração';
  end if;
  def := replace(def, '  new.total := subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete;', $$  new.total := subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete;

  -- Saldo/cupom cobriram tudo: nada a cobrar (nem no app, nem na entrega)
  if new.total <= 0 then
    new.total := 0;
    new.pagamento := 'saldo';
  elsif new.pagamento = 'saldo' then
    raise exception 'SALDO_INSUFICIENTE: o saldo não cobre o total do pedido';
  end if;$$);
  execute def;
end
$mig$;

-- Corrige o pedido #6EE5DCAE (pago 100% com saldo, gravado como dinheiro)
update pedidos set pagamento = 'saldo'
 where id::text like '6ee5dcae%' and total = 0 and saldo_usado > 0 and pagamento = 'dinheiro';

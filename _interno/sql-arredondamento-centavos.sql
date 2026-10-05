-- =====================================================================
-- Arredondamento em centavos (bug do "R$ 0,01" com PIX + saldo)
-- ---------------------------------------------------------------------
-- O banco arredondava o desconto PIX (69,90 x 0,95 = 66,405 -> 66,41),
-- mas aceitava o saldo usado com 3 casas (66,405) vindo do navegador.
-- Sobrava R$ 0,005 e o pedido ficava "aguardando pagamento" de R$ 0,01.
-- Agora saldo disponível, saldo usado e total ficam sempre em centavos,
-- e total abaixo de R$ 0,01 conta como zero (pago com saldo).
-- =====================================================================
do $mig$
declare def text;
begin
  def := pg_get_functiondef('public.validar_pedido_antes_de_inserir'::regproc);
  if position('select coalesce(sum(valor),0) into saldo_real' in def) = 0
     or position('new.saldo_usado := greatest(least(new.saldo_usado, saldo_real, subtotal_real - new.cupom_desconto), 0);' in def) = 0
     or position('  new.total := subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete;' in def) = 0
     or position('  if new.total <= 0 then' in def) = 0 then
    raise exception 'validar_pedido_antes_de_inserir mudou; revisar migração';
  end if;
  def := replace(def, 'select coalesce(sum(valor),0) into saldo_real',
                      'select round(coalesce(sum(valor),0)::numeric, 2) into saldo_real');
  def := replace(def, 'new.saldo_usado := greatest(least(new.saldo_usado, saldo_real, subtotal_real - new.cupom_desconto), 0);',
                      'new.saldo_usado := round(greatest(least(new.saldo_usado, saldo_real, subtotal_real - new.cupom_desconto), 0)::numeric, 2);');
  def := replace(def, '  new.total := subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete;',
                      '  new.total := round((subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete)::numeric, 2);');
  def := replace(def, '  if new.total <= 0 then', '  if new.total < 0.01 then');
  execute def;
end
$mig$;

-- ============================================================
-- VARIAÇÕES / KITS COM PREÇO E ESTOQUE PRÓPRIOS (estilo Shopee)
-- Rodar no SQL Editor do Supabase (já aplicado no projeto Zipshop).
--
-- produtos.variacoes = lista de opções que o cliente escolhe:
--   [{ "id": "v1", "nome": "Kit 2 unidades", "preco": 49.90, "estoque": 5 }, ...]
--   preco   vazio (null) = usa o preço do produto
--   estoque vazio (null) = sem controle de estoque nessa opção
-- Produto com variações: o estoque do produto é ignorado, vale o de cada opção.
--
-- Pedido:
--   * cada item pode trazer "variacao_id" (produto com variações: obrigatório)
--     ou "cor" (produtos só com a lista de cores antiga)
--   * o banco confere preço e estoque da variação, baixa o estoque dela e
--     guarda o nome da variação/cor no item (antes a cor se perdia aqui)
--   * cancelou: o estoque volta pra variação certa
-- ============================================================

alter table produtos add column if not exists variacoes jsonb not null default '[]';

-- 1) Limpeza dos textos das variações (mesma ideia das cores)
create or replace function public.sanitizar_produto()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.name        := regexp_replace(coalesce(new.name, ''), '[<>]', '', 'g');
  new.brand       := regexp_replace(new.brand, '[<>]', '', 'g');
  new.category    := regexp_replace(new.category, '[<>]', '', 'g');
  new.emoji       := regexp_replace(new.emoji, '[<>"''`&]', '', 'g');
  new.description := regexp_replace(new.description, '[<>]', '', 'g');
  new.garantia    := regexp_replace(new.garantia, '[<>]', '', 'g');
  -- Em JSON: tira < > e aspas escapadas dentro dos valores (\"), sem quebrar a estrutura
  new.specs     := regexp_replace(regexp_replace(new.specs::text, '[<>]', '', 'g'), '\\"', '', 'g')::jsonb;
  new.cores     := regexp_replace(regexp_replace(new.cores::text, '[<>]', '', 'g'), '\\"', '', 'g')::jsonb;
  new.imagens   := regexp_replace(regexp_replace(new.imagens::text, '[<>]', '', 'g'), '\\"', '', 'g')::jsonb;
  new.variacoes := regexp_replace(regexp_replace(coalesce(new.variacoes, '[]'::jsonb)::text, '[<>]', '', 'g'), '\\"', '', 'g')::jsonb;
  if jsonb_typeof(new.variacoes) <> 'array' then
    raise exception 'variacoes precisa ser uma lista';
  end if;
  if new.image_url is not null and new.image_url !~* '^https://[^"''<>\s]+$' then
    raise exception 'image_url precisa ser um link https válido';
  end if;
  if new.image_thumb_url is not null and new.image_thumb_url !~* '^https://[^"''<>\s]+$' then
    raise exception 'image_thumb_url precisa ser um link https válido';
  end if;
  return new;
end; $function$;

-- 2) Validação do pedido com variações
create or replace function public.validar_pedido_antes_de_inserir()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  item jsonb;
  produto_row produtos%rowtype;
  variacao jsonb;
  var_id text;
  cor_txt text;
  preco_item numeric;
  nome_item text;
  estoque_var numeric;
  subtotal_real numeric := 0;
  itens_validados jsonb := '[]'::jsonb;
  item_validado jsonb;
  cupom_row cupons%rowtype;
  ja_usou_cupom boolean;
  saldo_real numeric := 0;
  frete_real numeric := 0;
  cupom_valido boolean := false;
  qtd_pedida numeric;
begin
  for item in select * from jsonb_array_elements(new.itens)
  loop
    -- "for update" trava a linha até o fim da transação, evitando
    -- que dois pedidos ao mesmo tempo vendam a mesma unidade.
    select * into produto_row from produtos where id = (item->>'produto_id')::int for update;
    if produto_row.id is null then
      raise exception 'Produto % não encontrado', item->>'produto_id';
    end if;

    qtd_pedida := greatest(floor(coalesce((item->>'quantidade')::numeric,1)),1);
    preco_item := produto_row.price;
    nome_item := produto_row.name;
    variacao := null;
    var_id := nullif(item->>'variacao_id', '');
    cor_txt := nullif(left(regexp_replace(coalesce(item->>'cor', ''), '[<>"''`&]', '', 'g'), 60), '');

    if jsonb_array_length(coalesce(produto_row.variacoes, '[]'::jsonb)) > 0 then
      -- Produto com variações: precisa dizer qual
      select v into variacao
      from jsonb_array_elements(produto_row.variacoes) v
      where v->>'id' = var_id
      limit 1;
      if variacao is null then
        raise exception 'VARIACAO_INVALIDA: escolha uma opção de %', produto_row.name;
      end if;

      if nullif(variacao->>'preco', '') is not null then
        preco_item := (variacao->>'preco')::numeric;
      end if;
      nome_item := produto_row.name || ' — ' || (variacao->>'nome');

      estoque_var := nullif(variacao->>'estoque', '')::numeric;
      if estoque_var is not null then
        if estoque_var < qtd_pedida then
          raise exception 'ESTOQUE_INSUFICIENTE: % — disponível: %', nome_item, estoque_var;
        end if;
        update produtos set variacoes = (
          select jsonb_agg(
                   case when v->>'id' = var_id
                     then jsonb_set(v, '{estoque}', to_jsonb(estoque_var - qtd_pedida))
                     else v end
                   order by ord)
          from jsonb_array_elements(produto_row.variacoes) with ordinality as x(v, ord)
        ) where id = produto_row.id;
        -- a mesma variação pode vir em 2 itens: relê a linha já atualizada
        select * into produto_row from produtos where id = produto_row.id;
      end if;
    else
      -- Produto sem variações: estoque do produto
      if produto_row.stock is not null and produto_row.stock < qtd_pedida then
        raise exception 'ESTOQUE_INSUFICIENTE: % — disponível: %', produto_row.name, produto_row.stock;
      end if;
      if produto_row.stock is not null then
        update produtos set stock = stock - qtd_pedida where id = produto_row.id;
      end if;
      if cor_txt is not null then
        nome_item := produto_row.name || ' — ' || cor_txt;
      end if;
    end if;

    subtotal_real := subtotal_real + (preco_item * qtd_pedida);
    item_validado := jsonb_build_object(
      'produto_id', produto_row.id,
      'nome', nome_item,
      'preco', preco_item,
      'quantidade', qtd_pedida,
      'emoji', coalesce(item->>'emoji','📦')
    );
    if variacao is not null then
      item_validado := item_validado || jsonb_build_object('variacao_id', var_id, 'variacao', variacao->>'nome');
    elsif cor_txt is not null then
      item_validado := item_validado || jsonb_build_object('cor', cor_txt);
    end if;
    itens_validados := itens_validados || item_validado;
  end loop;
  new.itens := itens_validados;

  if new.pagamento = 'pix' then
    subtotal_real := round(subtotal_real * 0.95, 2);
  end if;

  new.cupom_desconto := 0;
  if new.cupom_codigo is not null then
    select * into cupom_row from cupons where codigo = new.cupom_codigo and ativo = true for update;
    if cupom_row.id is not null
       and (cupom_row.valido_ate is null or cupom_row.valido_ate >= now())
       and (cupom_row.uso_maximo is null or cupom_row.uso_atual < cupom_row.uso_maximo)
       and (cupom_row.pedido_minimo is null or subtotal_real >= cupom_row.pedido_minimo)
       and (cupom_row.publico = true or cupom_row.usuario_id::text = new.usuario_id)
    then
      ja_usou_cupom := false;
      if cupom_row.uso_unico_por_usuario then
        select exists(select 1 from cupons_usos where cupom_id = cupom_row.id and usuario_id::text = new.usuario_id) into ja_usou_cupom;
      end if;
      if not ja_usou_cupom then
        cupom_valido := true;
        if cupom_row.tipo = 'percentual' then
          new.cupom_desconto := round(subtotal_real * cupom_row.valor / 100, 2);
        elsif cupom_row.tipo = 'fixo' then
          new.cupom_desconto := least(cupom_row.valor, subtotal_real);
        end if;
      end if;
    end if;
    if not cupom_valido then
      new.cupom_codigo := null;
    end if;
  end if;

  if new.tipo_entrega = 'exclusiva' then
    frete_real := 9.90;
  elsif cupom_valido and cupom_row.tipo = 'frete_gratis' then
    frete_real := 0;
  elsif subtotal_real >= 14.90 then
    frete_real := 0;
  else
    frete_real := 2.90;
  end if;
  new.frete := frete_real;

  if new.saldo_usado is not null and new.saldo_usado > 0 then
    select coalesce(sum(valor),0) into saldo_real from saldo_extrato where usuario_id::text = new.usuario_id;
    new.saldo_usado := greatest(least(new.saldo_usado, saldo_real, subtotal_real - new.cupom_desconto), 0);
  else
    new.saldo_usado := 0;
  end if;

  if new.indicador_id is not null and new.indicador_id::text = new.usuario_id then
    new.indicador_id := null;
    new.codigo_indicacao_usado := null;
  end if;

  new.subtotal := subtotal_real;
  new.total := subtotal_real - new.cupom_desconto - new.saldo_usado + new.frete;

  return new;
end;
$function$;

-- 3) Cancelou: devolve o estoque pra variação certa (ou pro produto)
create or replace function public.devolver_estoque_ao_cancelar()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  item jsonb;
  qtd numeric;
  var_id text;
begin
  if (tg_op = 'UPDATE' and new.status = 'cancelado' and old.status is distinct from 'cancelado') then
    for item in select * from jsonb_array_elements(new.itens)
    loop
      qtd := coalesce((item->>'quantidade')::numeric, 1);
      var_id := nullif(item->>'variacao_id', '');
      if var_id is not null then
        update produtos set variacoes = (
          select jsonb_agg(
                   case when v->>'id' = var_id and nullif(v->>'estoque', '') is not null
                     then jsonb_set(v, '{estoque}', to_jsonb((v->>'estoque')::numeric + qtd))
                     else v end
                   order by ord)
          from jsonb_array_elements(variacoes) with ordinality as x(v, ord)
        )
        where id = (item->>'produto_id')::int
          and jsonb_array_length(variacoes) > 0;
      else
        update produtos set stock = stock + qtd
        where id = (item->>'produto_id')::int and stock is not null;
      end if;
    end loop;
  end if;
  return new;
end;
$function$;

-- ============================================================
-- FIM.
-- ============================================================

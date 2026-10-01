-- ============================================================
-- MARCA E CATEGORIA SEM ESPAÇOS SOBRANDO (já aplicado no Zipshop)
-- "ZipShop", "ZipShop " e " ZipShop " viravam 3 marcas diferentes
-- nos filtros. Agora o banco tira os espaços ao salvar, e as marcas
-- repetidas que já existiam foram juntadas.
-- ============================================================

create or replace function public.sanitizar_produto()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.name        := regexp_replace(coalesce(new.name, ''), '[<>]', '', 'g');
  new.brand       := btrim(regexp_replace(regexp_replace(coalesce(new.brand, ''), '[<>]', '', 'g'), '\s+', ' ', 'g'));
  new.category    := btrim(regexp_replace(regexp_replace(new.category, '[<>]', '', 'g'), '\s+', ' ', 'g'));
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

-- Junta as marcas repetidas (a trigger acima tira os espaços)
update produtos set brand = brand where brand is distinct from btrim(regexp_replace(coalesce(brand, ''), '\s+', ' ', 'g'));
update produtos set brand = 'ZipShop' where lower(brand) = 'zipshop';

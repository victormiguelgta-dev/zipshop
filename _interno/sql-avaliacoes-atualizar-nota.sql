-- Nota média e quantidade de avaliações do produto se atualizam sozinhas.
-- Antes produtos.rating/reviews nunca mudavam: todo produto mostrava 5.0 e
-- "(0 avaliações)" mesmo com avaliação aprovada. Agora, sempre que uma
-- avaliação é aprovada, reprovada, editada ou apagada, o banco recalcula
-- usando só as aprovadas. Produto sem avaliação fica com reviews = 0 (o site
-- esconde a nota nesse caso).

-- A média pode ter casa decimal (ex: 4.5)
alter table produtos alter column rating type numeric(2,1) using rating::numeric(2,1);

create or replace function public.recalcular_nota_produto(p_produto_id bigint)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update produtos p set
    reviews = coalesce(a.qtd, 0),
    rating  = coalesce(a.media, 5)
  from (
    select count(*)::int qtd, round(avg(nota)::numeric, 1) media
    from avaliacoes where produto_id = p_produto_id and status = 'aprovada'
  ) a
  where p.id = p_produto_id;
$$;

create or replace function public.trg_recalcular_nota_produto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform recalcular_nota_produto(old.produto_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.produto_id is distinct from old.produto_id) then
    perform recalcular_nota_produto(new.produto_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.recalcular_nota_produto(bigint) from public, anon, authenticated;
revoke execute on function public.trg_recalcular_nota_produto() from public, anon, authenticated;

drop trigger if exists trg_nota_produto on avaliacoes;
create trigger trg_nota_produto
after insert or update or delete on avaliacoes
for each row execute function trg_recalcular_nota_produto();

-- Acerta os produtos que já existem
update produtos p set
  reviews = coalesce(a.qtd, 0),
  rating  = coalesce(a.media, 5)
from (
  select pr.id, count(av.id)::int qtd, round(avg(av.nota)::numeric, 1) media
  from produtos pr
  left join avaliacoes av on av.produto_id = pr.id and av.status = 'aprovada'
  group by pr.id
) a
where p.id = a.id;

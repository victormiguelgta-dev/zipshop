-- Nome do autor gravado na própria avaliação (aplicado em 2026-10-12).
-- O site não consegue fazer o "join" avaliacoes -> usuarios (não há chave
-- estrangeira entre elas), o que quebrava a lista no admin e na página do produto.
alter table public.avaliacoes add column if not exists autor_nome text;

create or replace function public.avaliacao_preencher_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select nullif(split_part(trim(coalesce(u.nome, '')), ' ', 1), '') into new.autor_nome
    from usuarios u where u.id = new.usuario_id::text;
  new.autor_nome := coalesce(new.autor_nome, 'Cliente');
  return new;
end; $$;

drop trigger if exists trg_avaliacao_autor on public.avaliacoes;
create trigger trg_avaliacao_autor before insert on public.avaliacoes
  for each row execute function public.avaliacao_preencher_autor();

update public.avaliacoes a
   set autor_nome = coalesce((select nullif(split_part(trim(coalesce(u.nome,'')),' ',1),'')
                                from public.usuarios u where u.id = a.usuario_id::text), 'Cliente')
 where a.autor_nome is null;

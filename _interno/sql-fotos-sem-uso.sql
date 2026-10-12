-- Lista fotos do bucket "Produtos" que nada mais usa (aplicado em 2026-10-12).
-- O painel (js/admin-guard.js) chama e apaga essas fotos pela Storage API.
-- Só considera arquivos com mais de 1h (cadastro em andamento fica protegido).
create or replace function public.fotos_sem_uso(p_min_horas int default 1)
returns setof text language plpgsql security definer set search_path = public, storage stable as $$
declare v_txt text;
begin
  if not is_admin() then raise exception 'Acesso restrito ao admin.'; end if;
  select string_agg(t, ' ') into v_txt from (
    select p::text t from produtos p union all select b::text from banners b
    union all select c::text from categorias c union all select x::text from textos_site x
    union all select pe.itens::text from pedidos pe union all select ca::text from carrinhos_ativos ca
    union all select u::text from usuarios u) s;
  -- Trava de segurança: sem produtos cadastrados, não apaga nada
  if v_txt is null or not exists (select 1 from produtos where image_url is not null) then return; end if;
  return query select o.name from storage.objects o
   where o.bucket_id = 'Produtos'
     and o.created_at < now() - make_interval(hours => greatest(p_min_horas, 1))
     and position(o.name in v_txt) = 0
   limit 100;
end; $$;
revoke all on function public.fotos_sem_uso(int) from public, anon;
grant execute on function public.fotos_sem_uso(int) to authenticated;

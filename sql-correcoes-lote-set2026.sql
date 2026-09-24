-- ============================================================
-- ZIPSHOP — lote de correções (set/2026). JÁ RODADO no Supabase.
-- Guardado aqui só como registro. Seguro rodar de novo.
-- ============================================================

-- 0) Quem é admin, do lado do banco (mesmos e-mails do js/main.js)
create or replace function public.eh_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in ('admin@zipshop.com', 'victormiguelgta@gmail.com'),
    false
  );
$$;

-- 1) Produtos de estoque próprio (Cadastrar com IA)
alter table produtos add column if not exists custo numeric(10,2);
alter table produtos add column if not exists tipo_estoque text default 'proprio';
update produtos set tipo_estoque = 'dropshipping'
  where link_shopee is not null and tipo_estoque = 'proprio';
update produtos set custo = custo_shopee
  where custo is null and custo_shopee is not null;
alter table produtos drop constraint if exists produtos_tipo_estoque_check;
alter table produtos add constraint produtos_tipo_estoque_check
  check (tipo_estoque in ('proprio', 'dropshipping'));

-- 2) Título e subtítulo do banner editáveis no admin
alter table banners add column if not exists titulo text;
alter table banners add column if not exists subtitulo text;

-- 3) Foto de perfil
alter table usuarios add column if not exists avatar_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatares_ver_propria_pasta" on storage.objects;
create policy "avatares_ver_propria_pasta" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "avatares_enviar_propria_pasta" on storage.objects;
create policy "avatares_enviar_propria_pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "avatares_trocar_propria_pasta" on storage.objects;
create policy "avatares_trocar_propria_pasta" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "avatares_apagar_propria_pasta" on storage.objects;
create policy "avatares_apagar_propria_pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- 4) Textos do site: só o admin edita (antes: qualquer cliente logado)
drop policy if exists "Escrita autenticada textos_site" on textos_site;
drop policy if exists "Escrita admin textos_site" on textos_site;
create policy "Escrita admin textos_site" on textos_site
  for all using (public.eh_admin()) with check (public.eh_admin());

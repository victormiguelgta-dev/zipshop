-- Vídeo no produto (anúncio): o admin envia no painel (até 50 MB) e ele
-- aparece primeiro na galeria do produto. Os vídeos ficam na pasta
-- "produtos-videos" do Storage e ocupam o espaço grátis do Supabase (1 GB
-- somando fotos e vídeos).

alter table produtos add column if not exists video_url text;
alter table produtos drop constraint if exists produtos_video_url_https;
alter table produtos add constraint produtos_video_url_https
  check (video_url is null or video_url ~* '^https://[^"''<>\s]+$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-videos', 'produtos-videos', true, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin envia videos de produtos" on storage.objects;
create policy "Admin envia videos de produtos" on storage.objects for insert to authenticated
with check (bucket_id = 'produtos-videos' and is_admin());
drop policy if exists "Admin troca videos de produtos" on storage.objects;
create policy "Admin troca videos de produtos" on storage.objects for update to authenticated
using (bucket_id = 'produtos-videos' and is_admin());
drop policy if exists "Admin apaga videos de produtos" on storage.objects;
create policy "Admin apaga videos de produtos" on storage.objects for delete to authenticated
using (bucket_id = 'produtos-videos' and is_admin());

-- ============================================================
-- AVALIAÇÕES COM FOTO/VÍDEO + APROVAÇÃO PELO ADMIN
-- Rodar no SQL Editor do Supabase (já aplicado no projeto Zipshop).
--
--  * Toda avaliação nasce 'pendente' e só aparece no site depois que o
--    admin aprova (painel → Avaliações). O cliente vê a própria enquanto
--    espera.
--  * Até 5 fotos e 1 vídeo, guardados no bucket 'avaliacoes', na pasta
--    do próprio cliente.
--  * Bônus sai na APROVAÇÃO (antes saía ao enviar):
--      R$ 1,00 se tiver 100+ caracteres, 1+ foto e 1 vídeo
--      R$ 0,50 nos outros casos
--    Continua 1 bônus por cliente por produto. Se ele editar depois e
--    passar a merecer R$ 1,00, o bônus sobe pra R$ 1,00 (nunca duplica).
--  * Cliente editou a avaliação? Volta pra 'pendente' e passa de novo
--    pela aprovação.
-- ============================================================

-- 1) Colunas novas
alter table avaliacoes add column if not exists status text not null default 'pendente';
alter table avaliacoes add column if not exists fotos text[] not null default '{}';
alter table avaliacoes add column if not exists videos text[] not null default '{}';
alter table avaliacoes add column if not exists motivo_reprovacao text;
alter table avaliacoes add column if not exists moderado_em timestamptz;

alter table avaliacoes drop constraint if exists avaliacoes_status_check;
alter table avaliacoes add constraint avaliacoes_status_check
  check (status in ('pendente', 'aprovada', 'reprovada'));

alter table avaliacoes drop constraint if exists avaliacoes_midia_limite;
alter table avaliacoes add constraint avaliacoes_midia_limite
  check (cardinality(fotos) <= 5 and cardinality(videos) <= 1);

create index if not exists avaliacoes_status_idx on avaliacoes(status);

-- 2) Cliente não escolhe o status, e só pode anexar arquivos da própria
--    pasta no bucket 'avaliacoes'. Admin aprova/reprova.
create or replace function avaliacoes_moderacao()
returns trigger language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_prefixo text;
  v_url text;
begin
  if is_admin() then
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      new.moderado_em := now();
    end if;
    return new;
  end if;

  -- cliente: sempre volta pra fila de aprovação
  new.status := 'pendente';
  new.motivo_reprovacao := null;
  new.moderado_em := null;
  if tg_op = 'UPDATE' then
    new.usuario_id := old.usuario_id;
    new.produto_id := old.produto_id;
  end if;

  v_prefixo := 'https://kkliwdphrdbguclsvxcw.supabase.co/storage/v1/object/public/avaliacoes/'
               || new.usuario_id::text || '/';
  foreach v_url in array (new.fotos || new.videos) loop
    if left(v_url, length(v_prefixo)) <> v_prefixo then
      raise exception 'Arquivo de avaliação inválido';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_avaliacoes_moderacao on avaliacoes;
create trigger trg_avaliacoes_moderacao
  before insert or update on avaliacoes
  for each row execute function avaliacoes_moderacao();

-- 3) Quem vê o quê: público só as aprovadas; o cliente vê as dele; admin vê tudo
drop policy if exists avaliacoes_leitura on avaliacoes;
drop policy if exists avaliacoes_select on avaliacoes;
create policy avaliacoes_select on avaliacoes
  for select using (
    status = 'aprovada'
    or usuario_id = (select auth.uid())
    or is_admin()
  );

drop policy if exists avaliacoes_admin_update on avaliacoes;
create policy avaliacoes_admin_update on avaliacoes
  for update using (is_admin()) with check (is_admin());

drop policy if exists avaliacoes_admin_delete on avaliacoes;
create policy avaliacoes_admin_delete on avaliacoes
  for delete using (is_admin());

-- 4) Bônus: sai na aprovação, não mais no envio
drop trigger if exists trg_bonus_avaliacao on avaliacoes;

create or replace function creditar_bonus_avaliacao()
returns trigger language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_min_caracteres constant int := 100;    -- mude aqui se precisar
  v_bonus_simples  constant numeric := 0.50;
  v_bonus_completo constant numeric := 1.00;
  v_bonus numeric;
  v_nome text;
begin
  if new.status <> 'aprovada' or (tg_op = 'UPDATE' and old.status = 'aprovada') then
    return new;
  end if;

  v_bonus := case
    when char_length(trim(coalesce(new.texto, ''))) >= v_min_caracteres
     and cardinality(new.fotos) >= 1
     and cardinality(new.videos) >= 1
    then v_bonus_completo else v_bonus_simples end;

  select name into v_nome from produtos where id = new.produto_id;

  insert into saldo_extrato (usuario_id, produto_id, tipo, valor, descricao)
  values (new.usuario_id, new.produto_id, 'avaliacao', v_bonus,
          'Avaliação: ' || coalesce(v_nome, 'produto #' || new.produto_id))
  on conflict (usuario_id, produto_id) where tipo = 'avaliacao'
  do update set valor = greatest(saldo_extrato.valor, excluded.valor);

  return new;
end;
$$;

drop trigger if exists trg_bonus_avaliacao_aprovada on avaliacoes;
create trigger trg_bonus_avaliacao_aprovada
  after insert or update of status on avaliacoes
  for each row execute function creditar_bonus_avaliacao();

-- 5) Bucket das fotos/vídeos (público pra exibir; 50 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avaliacoes', 'avaliacoes', true, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avaliacoes_enviar_propria_pasta on storage.objects;
create policy avaliacoes_enviar_propria_pasta on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avaliacoes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avaliacoes_apagar_arquivos on storage.objects;
create policy avaliacoes_apagar_arquivos on storage.objects
  for delete to authenticated
  using (bucket_id = 'avaliacoes' and ((storage.foldername(name))[1] = (select auth.uid())::text or is_admin()));

-- ============================================================
-- FIM.
-- ============================================================

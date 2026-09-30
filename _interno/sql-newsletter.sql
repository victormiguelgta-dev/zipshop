-- ============================================================
-- NEWSLETTER ("Fique por dentro" na home)
-- Antes o formulário só mostrava "Inscrito com sucesso!" e o e-mail
-- não ia pra lugar nenhum. Agora fica salvo nesta tabela e o admin
-- vê a lista em Analytics (com botão pra copiar todos).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

create table if not exists newsletter_inscritos (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  criado_em timestamp with time zone default now()
);

-- Mesmo e-mail não entra duas vezes (ignora maiúsculas/minúsculas)
create unique index if not exists idx_newsletter_email_unico
  on newsletter_inscritos (lower(email));

alter table newsletter_inscritos enable row level security;

-- Qualquer visitante pode SE INSCREVER (só inserir, com e-mail válido)...
drop policy if exists "newsletter_inscrever" on newsletter_inscritos;
create policy "newsletter_inscrever" on newsletter_inscritos for insert
  to anon, authenticated
  with check (
    length(email) between 6 and 254
    and email ~* '^[^\s@<>"'']+@[^\s@<>"'']+\.[a-z]{2,}$'
  );

-- ...mas só o admin LÊ ou apaga a lista (ninguém vê o e-mail dos outros)
drop policy if exists "newsletter_admin" on newsletter_inscritos;
create policy "newsletter_admin" on newsletter_inscritos for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- FIM. Avisos de "already exists" podem ser ignorados.
-- ============================================================

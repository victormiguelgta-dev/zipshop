-- Perfil (tabela usuarios) criado pelo próprio banco quando alguém se cadastra
-- (aplicado em 2026-10-12). Antes o site tentava salvar sem estar logado
-- (confirmação de e-mail ligada) e o RLS bloqueava: "erro ao salvar seus dados".
create or replace function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cpf text := nullif(left(btrim(coalesce(new.raw_user_meta_data->>'cpf', '')), 20), '');
begin
  -- CPF já usado por outra conta: cria o perfil sem CPF (o site avisa antes)
  if v_cpf is not null and exists (select 1 from usuarios where cpf = v_cpf) then v_cpf := null; end if;
  begin
    insert into public.usuarios (id, email, nome, cpf, avatar_url)
    values (new.id::text, new.email,
            nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 100), ''),
            v_cpf, new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  exception when others then
    raise warning 'criar_perfil_novo_usuario: %', sqlerrm; -- nunca impede o cadastro
  end;
  return new;
end; $$;
revoke all on function public.criar_perfil_novo_usuario() from public, anon, authenticated;

drop trigger if exists trg_criar_perfil on auth.users;
create trigger trg_criar_perfil after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

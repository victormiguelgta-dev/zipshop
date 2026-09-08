-- ============================================================
-- CPF único por conta + trava no backend contra pedido sem
-- CPF válido / telefone confirmado.
-- Rodar no SQL Editor do Supabase.
-- ============================================================

-- 1) Normaliza os CPFs já salvos para conter só dígitos, senão
--    "123.456.789-00" e "12345678900" contariam como diferentes
--    e o índice único do passo 2 não pegaria duplicidade.
update usuarios
set cpf = regexp_replace(cpf, '\D', '', 'g')
where cpf is not null;

-- 2) Garante, a partir de agora, que o mesmo CPF não possa existir
--    em duas contas. O índice ignora linhas com cpf nulo, então
--    quem ainda não preencheu o CPF não é bloqueado por isso.
--    OBS: se o passo acima encontrar CPFs duplicados de verdade
--    (contas antigas que já burlaram isso), este comando vai falhar
--    avisando qual CPF está repetido — nesse caso decida manualmente
--    qual conta mantém o CPF antes de rodar de novo.
create unique index if not exists usuarios_cpf_unico_idx
  on usuarios (cpf)
  where cpf is not null;

-- 3) Valida CPF de verdade (mesmo algoritmo usado no front-end, em
--    js/validadores.js), pra o backend não confiar só no "tem 11
--    dígitos".
create or replace function validar_cpf(cpf_input text)
returns boolean
language plpgsql
immutable
as $$
declare
  c text := regexp_replace(coalesce(cpf_input, ''), '\D', '', 'g');
  soma int;
  resto int;
  i int;
begin
  if length(c) <> 11 then
    return false;
  end if;

  if c ~ '^(\d)\1{10}$' then
    return false;
  end if;

  soma := 0;
  for i in 0..8 loop
    soma := soma + substring(c from i + 1 for 1)::int * (10 - i);
  end loop;
  resto := (soma * 10) % 11;
  if resto in (10, 11) then resto := 0; end if;
  if resto <> substring(c from 10 for 1)::int then
    return false;
  end if;

  soma := 0;
  for i in 0..9 loop
    soma := soma + substring(c from i + 1 for 1)::int * (11 - i);
  end loop;
  resto := (soma * 10) % 11;
  if resto in (10, 11) then resto := 0; end if;

  return resto = substring(c from 11 for 1)::int;
end;
$$;

-- 4) Função que o front-end chama ANTES de criar a conta / salvar o
--    CPF, pra avisar o usuário na hora se o número já está em uso
--    por outra conta. SECURITY DEFINER: enxerga a tabela toda mesmo
--    com RLS ativo, mas só devolve true/false — nunca expõe de quem
--    é o CPF.
create or replace function cpf_disponivel(cpf_input text, usuario_atual uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from usuarios
    where cpf = regexp_replace(cpf_input, '\D', '', 'g')
      and (usuario_atual is null or id <> usuario_atual)
  );
$$;

revoke all on function cpf_disponivel(text, uuid) from public;
grant execute on function cpf_disponivel(text, uuid) to anon, authenticated;
grant execute on function validar_cpf(text) to anon, authenticated;

-- 5) Trava de verdade no backend: mesmo se alguém pular a tela e
--    chamar a API do Supabase direto, não consegue criar um pedido
--    sem CPF válido nem sem telefone confirmado por SMS de verdade
--    (phone_confirmed_at só é escrito pelo Supabase Auth quando o
--    OTP é verificado — o cliente não consegue forjar isso).
create or replace function checar_perfil_completo_para_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cpf_usuario text;
  telefone_confirmado timestamptz;
begin
  select u.cpf, au.phone_confirmed_at
    into cpf_usuario, telefone_confirmado
  from usuarios u
  join auth.users au on au.id = u.id
  where u.id = new.usuario_id;

  if not validar_cpf(cpf_usuario) then
    raise exception 'Cadastro incompleto: CPF válido é obrigatório para finalizar a compra.';
  end if;

  if telefone_confirmado is null then
    raise exception 'Cadastro incompleto: telefone precisa ser confirmado por SMS para finalizar a compra.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checar_perfil_completo_pedido on pedidos;
create trigger trg_checar_perfil_completo_pedido
  before insert on pedidos
  for each row execute function checar_perfil_completo_para_pedido();

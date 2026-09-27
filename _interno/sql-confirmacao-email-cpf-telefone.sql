-- ============================================================
-- Confirmação por e-mail para edição de CPF/telefone
-- + remove a exigência de telefone confirmado por SMS (o cliente
--   decidiu não pagar o Twilio) da trava de pedido.
-- Rodar no SQL Editor do Supabase, DEPOIS do
-- sql-cpf-unico-e-pedidos-seguros.sql
-- ============================================================

-- 1) Tabela onde ficam guardados, temporariamente, os códigos de
--    confirmação de troca de CPF/telefone. Só as Netlify Functions
--    (com a service role key) leem/escrevem aqui — nunca o cliente
--    direto, senão dava pra "adivinhar" o código.
create table if not exists confirmacoes_pendentes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade not null,
  campo text not null check (campo in ('cpf', 'telefone')),
  valor_novo text not null,
  codigo text not null,
  tentativas int not null default 0,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists confirmacoes_pendentes_usuario_campo_idx
  on confirmacoes_pendentes (usuario_id, campo);

alter table confirmacoes_pendentes enable row level security;
revoke all on confirmacoes_pendentes from anon, authenticated;

-- 2) Validação real de telefone no banco (mesma regra do front-end,
--    em js/validadores.js): 10 ou 11 dígitos e DDD de verdade.
create or replace function validar_telefone(telefone_input text)
returns boolean
language plpgsql
immutable
as $$
declare
  t text := regexp_replace(coalesce(telefone_input, ''), '\D', '', 'g');
  ddd int;
  ddds_validos int[] := array[
    11,12,13,14,15,16,17,18,19,
    21,22,24,27,28,
    31,32,33,34,35,37,38,
    41,42,43,44,45,46,47,48,49,
    51,53,54,55,
    61,62,63,64,65,66,67,68,69,
    71,73,74,75,77,79,
    81,82,83,84,85,86,87,88,89,
    91,92,93,94,95,96,97,98,99
  ];
begin
  if length(t) <> 10 and length(t) <> 11 then return false; end if;
  if t ~ '^(\d)\1+$' then return false; end if;

  ddd := substring(t from 1 for 2)::int;
  if not (ddd = any(ddds_validos)) then return false; end if;

  if length(t) = 11 and substring(t from 3 for 1) <> '9' then return false; end if;

  return true;
end;
$$;

grant execute on function validar_telefone(text) to anon, authenticated;

-- 3) Atualiza a trava de pedido: agora exige CPF válido e telefone
--    válido (formato real), mas NÃO exige mais confirmação por SMS
--    (o negócio decidiu não pagar por isso). A confirmação de
--    identidade desses dados passa a acontecer por e-mail sempre que
--    o cliente edita CPF ou telefone (ver função confirmar_alteracao_cadastro).
create or replace function checar_perfil_completo_para_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cpf_usuario text;
  telefone_usuario text;
begin
  select u.cpf, u.telefone
    into cpf_usuario, telefone_usuario
  from usuarios u
  where u.id = new.usuario_id;

  if not validar_cpf(cpf_usuario) then
    raise exception 'Cadastro incompleto: CPF válido é obrigatório para finalizar a compra.';
  end if;

  if not validar_telefone(telefone_usuario) then
    raise exception 'Cadastro incompleto: telefone válido é obrigatório para finalizar a compra.';
  end if;

  return new;
end;
$$;

-- (o trigger em si já existe, criado no script anterior; só troca a
--  função que ele chama, então não precisa recriar o trigger)

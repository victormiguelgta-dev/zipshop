-- Rodar no SQL Editor do Supabase
--
-- NÃO criamos uma coluna "telefone_confirmado" na tabela usuarios porque
-- ela seria editável pelo cliente (via upsert com a chave pública) e
-- qualquer pessoa poderia marcar como confirmado sem nunca ter recebido o
-- SMS. Em vez disso, usamos o campo phone_confirmed_at que o próprio
-- Supabase Auth escreve no servidor — só é preenchido quando o código OTP
-- é verificado de verdade (supabase.auth.verifyOtp). O cliente não tem
-- como forjar esse valor.
--
-- Esta view é só uma conveniência para o admin ver, numa consulta só,
-- o cadastro + se o telefone daquele usuário está realmente confirmado.

create or replace view usuarios_com_status_telefone as
select
  u.*,
  au.phone as auth_telefone,
  au.phone_confirmed_at,
  (au.phone_confirmed_at is not null) as telefone_confirmado
from usuarios u
join auth.users au on au.id = u.id;

-- Acesso restrito: só o service role (usado nas Netlify functions e no
-- admin autenticado) deve conseguir ler esta view, nunca o público.
revoke all on usuarios_com_status_telefone from anon, authenticated;

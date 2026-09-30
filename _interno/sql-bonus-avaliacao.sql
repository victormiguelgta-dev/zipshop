-- ============================================================
-- BÔNUS DE SALDO POR AVALIAÇÃO
-- Cada avaliação de produto credita R$ 0,50 no saldo do cliente.
-- Rodar no SQL Editor do Supabase.
--
-- Regras de segurança:
--  * Quem pode avaliar já é controlado pela política da tabela
--    avaliacoes: só quem tem pedido ENTREGUE com aquele produto.
--  * O crédito é dado pelo banco (trigger), nunca pelo navegador.
--  * Só 1 bônus por cliente por produto, para sempre: mesmo que a
--    avaliação seja apagada e feita de novo, não credita outra vez
--    (índice único em saldo_extrato).
--  * Editar a avaliação não gera bônus (só o INSERT).
-- ============================================================

-- 1) Novo tipo no extrato: 'avaliacao'
alter table saldo_extrato drop constraint if exists saldo_extrato_tipo_check;
alter table saldo_extrato add constraint saldo_extrato_tipo_check
  check (tipo in ('cashback', 'indicacao', 'resgate', 'reembolso', 'avaliacao'));

-- 2) O extrato passa a guardar qual produto gerou o bônus
alter table saldo_extrato add column if not exists produto_id int;

-- 3) Trava: 1 bônus de avaliação por cliente por produto
create unique index if not exists idx_saldo_bonus_avaliacao_unico
  on saldo_extrato (usuario_id, produto_id)
  where tipo = 'avaliacao';

-- 4) Credita o bônus quando a avaliação é criada
create or replace function creditar_bonus_avaliacao()
returns trigger language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_bonus constant numeric := 0.50;   -- valor do bônus (mude aqui se precisar)
  v_nome text;
begin
  select name into v_nome from produtos where id = new.produto_id;

  insert into saldo_extrato (usuario_id, produto_id, tipo, valor, descricao)
  values (new.usuario_id, new.produto_id, 'avaliacao', v_bonus,
          'Avaliação: ' || coalesce(v_nome, 'produto #' || new.produto_id))
  on conflict (usuario_id, produto_id) where tipo = 'avaliacao' do nothing;

  return new;
end;
$$;

drop trigger if exists trg_bonus_avaliacao on avaliacoes;
create trigger trg_bonus_avaliacao
  after insert on avaliacoes
  for each row execute function creditar_bonus_avaliacao();

-- ============================================================
-- FIM. Avisos de "already exists" podem ser ignorados.
-- ============================================================

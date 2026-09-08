-- ============================================================
-- CAMPOS SHOPEE (dropshipping)
-- ============================================================
-- Rode este SQL no Supabase (SQL Editor).
--
-- Adiciona na tabela "produtos" os campos necessários pro fluxo
-- de revenda: link do produto na Shopee, quanto custa lá, a
-- margem de lucro do lojista e o prazo de entrega.
--
-- Usa "add column if not exists", então é seguro rodar mais de
-- uma vez e não mexe em nenhum dado que já existe.
-- ============================================================

alter table produtos add column if not exists link_shopee text;
alter table produtos add column if not exists custo_shopee numeric(10,2);
alter table produtos add column if not exists margem_percent numeric(5,2) default 30;
alter table produtos add column if not exists prazo_entrega_dias integer default 15;

comment on column produtos.link_shopee is 'Link do produto na Shopee — usado pelo admin pra comprar quando alguém pedir. Nunca aparece pro cliente final.';
comment on column produtos.custo_shopee is 'Quanto o produto custa na Shopee (preço de compra).';
comment on column produtos.margem_percent is 'Percentual de lucro aplicado sobre o custo pra chegar no preço de venda.';
comment on column produtos.prazo_entrega_dias is 'Prazo de entrega em dias que aparece pro cliente.';

-- ============================================================
-- Índice pra facilitar achar os produtos que vieram da Shopee
-- ============================================================
create index if not exists idx_produtos_link_shopee
  on produtos (link_shopee)
  where link_shopee is not null;

-- Rodar no SQL Editor do Supabase
-- Código de confirmação de entrega (estilo iFood): o cliente informa esse
-- código pro entregador na hora da entrega, e o admin digita no painel
-- pra confirmar. Serve de respaldo pra loja provar que a entrega aconteceu.

alter table pedidos add column if not exists codigo_confirmacao text;

-- Preenche um código pros pedidos que já existem e ainda não têm
update pedidos set codigo_confirmacao = lpad(floor(random() * 10000)::text, 4, '0')
where codigo_confirmacao is null;

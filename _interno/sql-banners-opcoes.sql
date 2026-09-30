-- ============================================================
-- BANNERS: opções do botão e do escurecimento
-- Rodar no SQL Editor do Supabase ANTES do deploy (o painel de
-- banners passa a salvar essas colunas).
-- ============================================================

-- Mostrar ou esconder o botão sobre o banner (padrão: mostra, como antes)
alter table banners add column if not exists mostrar_botao boolean default true;

-- Texto do botão (antes era sempre "Ver Produtos")
alter table banners add column if not exists texto_botao text default 'Ver Produtos';

-- Faixa escura atrás do texto. Padrão: DESLIGADA — banners feitos com
-- o texto já na arte não precisam dela.
alter table banners add column if not exists escurecer boolean default false;

-- ============================================================
-- FIM. Avisos de "already exists" podem ser ignorados.
-- ============================================================

-- ============================================================
-- SINÔNIMOS DE CATEGORIA (pra busca entender "celular" = Smartphones)
-- ============================================================
-- Rode este SQL no Supabase (SQL Editor), depois do sql-textos-site.sql.
--
-- Problema que resolve: cliente digita "celular" na busca, mas nenhum
-- produto tem essa palavra escrita (só tem "Smartphones" na categoria
-- e nomes tipo "iPhone 15 Pro Max"). Essa tabela ensina o site que
-- "celular" deve trazer produtos da categoria "Smartphones" também.
-- ============================================================

CREATE TABLE IF NOT EXISTS categoria_sinonimos (
  id BIGSERIAL PRIMARY KEY,
  termo TEXT NOT NULL,        -- o que a pessoa digita (ex: celular)
  categoria TEXT NOT NULL,    -- categoria real do produto (ex: Smartphones)
  UNIQUE(termo, categoria)
);

ALTER TABLE categoria_sinonimos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica categoria_sinonimos" ON categoria_sinonimos;
CREATE POLICY "Leitura publica categoria_sinonimos"
  ON categoria_sinonimos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Escrita autenticada categoria_sinonimos" ON categoria_sinonimos;
CREATE POLICY "Escrita autenticada categoria_sinonimos"
  ON categoria_sinonimos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- SEED: sinônimos comuns em português pras categorias que já
-- existem no site (Smartphones, Notebooks, Headphones, Smart TVs,
-- Games, Acessorios). Ajuste/adicione o quanto quiser depois.
-- ============================================================
INSERT INTO categoria_sinonimos (termo, categoria) VALUES
  ('celular', 'Smartphones'),
  ('smartphone', 'Smartphones'),
  ('telefone', 'Smartphones'),
  ('aparelho', 'Smartphones'),
  ('iphone', 'Smartphones'),
  ('android', 'Smartphones'),
  ('notebook', 'Notebooks'),
  ('laptop', 'Notebooks'),
  ('computador', 'Notebooks'),
  ('pc', 'Notebooks'),
  ('fone', 'Headphones'),
  ('fones', 'Headphones'),
  ('headset', 'Headphones'),
  ('ouvido', 'Headphones'),
  ('tv', 'Smart TVs'),
  ('televisao', 'Smart TVs'),
  ('televisão', 'Smart TVs'),
  ('videogame', 'Games'),
  ('video game', 'Games'),
  ('console', 'Games'),
  ('jogo', 'Games'),
  ('jogos', 'Games'),
  ('acessorio', 'Acessorios'),
  ('acessório', 'Acessorios'),
  ('carregador', 'Acessorios'),
  ('cabo', 'Acessorios'),
  ('capinha', 'Acessorios')
ON CONFLICT (termo, categoria) DO NOTHING;

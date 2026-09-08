-- ============================================================
-- TEXTOS DO SITE (CMS de textos/emojis/títulos)
-- ============================================================
-- Rode este SQL no Supabase (SQL Editor).
-- Cria a tabela "textos_site" que vai guardar todo texto/emoji/
-- título que o admin puder editar pelo painel, sem mexer em código.
--
-- Cada linha é um "texto" identificado por uma "chave" única.
-- Ex: chave = 'home_titulo_ofertas', valor = '⚡ Ofertas do Dia'
-- ============================================================

CREATE TABLE IF NOT EXISTS textos_site (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT UNIQUE NOT NULL,       -- identificador único (ex: home_titulo_ofertas)
  valor TEXT NOT NULL DEFAULT '',   -- o texto/emoji que aparece no site
  secao TEXT DEFAULT 'geral',       -- agrupamento: home, navbar, footer, login, geral...
  descricao TEXT DEFAULT '',        -- explicação pro admin entender o que é esse texto
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Atualiza a data automaticamente sempre que o texto for editado
CREATE OR REPLACE FUNCTION atualizar_textos_site_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_textos_site_timestamp ON textos_site;
CREATE TRIGGER trg_textos_site_timestamp
  BEFORE UPDATE ON textos_site
  FOR EACH ROW EXECUTE FUNCTION atualizar_textos_site_timestamp();

-- Segurança: todo mundo pode LER os textos (o site precisa exibir pra visitante)
-- mas só admin autenticado pode EDITAR (a lista de admins já existe em admin-guard.js,
-- então aqui liberamos escrita pra qualquer usuário autenticado — o admin-guard.js
-- já barra o acesso ao painel antes de chegar aqui).
ALTER TABLE textos_site ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica textos_site" ON textos_site;
CREATE POLICY "Leitura publica textos_site"
  ON textos_site FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Escrita autenticada textos_site" ON textos_site;
CREATE POLICY "Escrita autenticada textos_site"
  ON textos_site FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- SEED: textos que já existem hoje espalhados pelo HTML.
-- Isso só CRIA os registros no banco — ainda não muda nada
-- visível no site até os arquivos HTML serem ligados a eles.
-- ============================================================
INSERT INTO textos_site (chave, valor, secao, descricao) VALUES
  ('home_titulo_categorias',      'Categorias',                                     'home', 'Título da seção de categorias na home'),
  ('home_titulo_ofertas',         '⚡ Ofertas do Dia',                              'home', 'Título da seção de produtos em destaque'),
  ('home_titulo_mais_vendidos',   'Mais Vendidos',                                  'home', 'Título da seção com todos os produtos'),
  ('home_newsletter_titulo',      'Não perca nenhuma oferta!',                      'home', 'Título da caixa de newsletter'),
  ('home_newsletter_texto',       'Cadastre seu e-mail e receba as melhores promoções em primeira mão.', 'home', 'Texto da caixa de newsletter'),
  ('feature_seguranca_emoji',     '🔒',                                             'home', 'Emoji do bloco Compra Segura'),
  ('feature_seguranca_titulo',    'Compra Segura',                                  'home', 'Título do bloco Compra Segura'),
  ('feature_seguranca_sub',       'Pagamento 100% protegido',                       'home', 'Texto do bloco Compra Segura'),
  ('feature_pagamento_emoji',     '💳',                                             'home', 'Emoji do bloco PIX e Cartão'),
  ('feature_pagamento_titulo',    'PIX e Cartão',                                   'home', 'Título do bloco PIX e Cartão'),
  ('feature_pagamento_sub',       'Parcele em até 12x sem juros',                   'home', 'Texto do bloco PIX e Cartão'),
  ('feature_qualidade_emoji',     '📦',                                             'home', 'Emoji do bloco Ótima Qualidade'),
  ('feature_qualidade_titulo',    'Ótima Qualidade',                                'home', 'Título do bloco Ótima Qualidade'),
  ('feature_qualidade_sub',       'Selecionados com cuidado',                       'home', 'Texto do bloco Ótima Qualidade')
ON CONFLICT (chave) DO NOTHING;

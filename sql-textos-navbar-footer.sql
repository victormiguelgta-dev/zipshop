-- ============================================================
-- TEXTOS DO SITE — NAVBAR E FOOTER
-- ============================================================
-- Rode DEPOIS do sql-textos-site.sql (que cria a tabela).
-- Este arquivo só adiciona as chaves novas.
--
-- A navbar e o footer aparecem em TODAS as páginas do site, então
-- editar aqui muda o site inteiro de uma vez.
--
-- ON CONFLICT DO NOTHING: se você rodar duas vezes, não duplica e
-- não sobrescreve nada que o cliente já tenha editado no painel.
-- ============================================================

INSERT INTO textos_site (chave, valor, secao, descricao) VALUES
  -- NAVBAR (topo do site)
  ('navbar_busca_placeholder', 'Buscar produtos, marcas e categorias...', 'navbar', 'Texto cinza dentro do campo de busca (vale pro desktop e pro celular)'),
  ('navbar_btn_entrar',        '👤 Entrar',                               'navbar', 'Botão de login, aparece só pra quem não está logado'),
  ('navbar_cat_1',             'Smartphones',                             'navbar', 'Atalho de categoria 1 na barra do topo'),
  ('navbar_cat_2',             'Notebooks',                               'navbar', 'Atalho de categoria 2 na barra do topo'),
  ('navbar_cat_3',             'Headphones',                              'navbar', 'Atalho de categoria 3 na barra do topo'),
  ('navbar_cat_4',             'Smart TVs',                               'navbar', 'Atalho de categoria 4 na barra do topo'),
  ('navbar_cat_5',             'Games',                                   'navbar', 'Atalho de categoria 5 na barra do topo'),
  ('navbar_cat_6',             'Acessórios',                              'navbar', 'Atalho de categoria 6 na barra do topo'),
  ('navbar_cat_ofertas',       '🔥 Ofertas do Dia',                       'navbar', 'Atalho destacado de ofertas na barra do topo'),

  -- FOOTER (rodapé do site)
  ('footer_descricao_1',       'A loja de eletrônicos mais rápida do Brasil.', 'footer', 'Primeira linha da descrição ao lado da logo'),
  ('footer_descricao_2',       'Pra ontem, pra agora, pra você.',              'footer', 'Segunda linha da descrição ao lado da logo'),
  ('footer_col_comprar',       'Comprar',                                 'footer', 'Título da primeira coluna de links'),
  ('footer_col_ajuda',         'Ajuda',                                   'footer', 'Título da segunda coluna de links'),
  ('footer_col_suporte',       'Suporte',                                 'footer', 'Título da terceira coluna de links'),
  ('footer_link_todos',        'Todos os Produtos',                       'footer', 'Link da coluna Comprar'),
  ('footer_link_ofertas',      'Ofertas do Dia',                          'footer', 'Link da coluna Comprar'),
  ('footer_link_smartphones',  'Smartphones',                             'footer', 'Link da coluna Comprar'),
  ('footer_link_notebooks',    'Notebooks',                               'footer', 'Link da coluna Comprar'),
  ('footer_link_conta',        'Minha Conta',                             'footer', 'Link da coluna Ajuda'),
  ('footer_link_rastrear',     'Rastrear Pedido',                         'footer', 'Link da coluna Ajuda'),
  ('footer_link_devolucoes',   'Trocas e Devoluções',                     'footer', 'Link da coluna Ajuda (abre o WhatsApp)'),
  ('footer_link_whatsapp',     'Fale pelo WhatsApp',                      'footer', 'Link da coluna Suporte'),
  ('footer_link_email',        'suporte@zipshop.com',                     'footer', 'E-mail mostrado na coluna Suporte (só o texto: o link mailto continua no código)'),
  ('footer_link_termos',       'Termos de Uso',                           'footer', 'Link da coluna Suporte'),
  ('footer_copyright',         '© 2024 Zipshop. Todos os direitos reservados.', 'footer', 'Linha de copyright no rodapé — dá pra atualizar o ano por aqui')
ON CONFLICT (chave) DO NOTHING;

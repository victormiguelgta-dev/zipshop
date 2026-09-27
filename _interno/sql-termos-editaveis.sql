-- ============================================================
-- TERMOS DE USO EDITÁVEIS
-- Rodar no SQL Editor do Supabase (seguro rodar mais de uma vez).
-- Cria a chave "termos_conteudo" com o texto atual dos termos.
-- Depois é só editar em Admin → Textos do Site.
-- Se a chave já existir, NÃO sobrescreve o que foi editado.
-- ============================================================

insert into textos_site (chave, valor, secao, descricao)
values (
  'termos_conteudo',
  $termos$<h2>1. Quem Somos</h2>
<p>A Zipshop é uma loja virtual de produtos eletrônicos que atende exclusivamente a cidade de <strong>Santa Maria — RS</strong>. Ao realizar uma compra em nosso site, você concorda com os termos descritos abaixo.</p>
<h2>2. Área de Atendimento</h2>
<p>Nossas entregas são realizadas <strong>apenas dentro de Santa Maria — RS</strong>. Clientes de outras cidades ou estados devem entrar em contato via WhatsApp para verificar a possibilidade de envio, que poderá ter condições e prazos diferentes dos descritos aqui.</p>
<h2>3. Cadastro e Conta</h2>
<p>Para realizar compras, é necessário criar uma conta com e-mail válido. Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas em sua conta.</p>
<h2>4. Frete Grátis</h2>
<p>Não há valor mínimo para realizar uma compra. Pedidos a partir de <strong>R$ 14,90</strong> têm direito à entrega por rota gratuita. Abaixo desse valor, é cobrada uma taxa de R$ 2,90.</p>
<h2>5. Tipos de Entrega</h2>
<p><strong>🛵 Entrega por Rota</strong></p>
<ul>
<li>Prazo estimado: 24 a 48 horas</li>
<li>Gratuita para pedidos a partir de R$ 14,90</li>
<li>Taxa de R$ 2,90 para pedidos abaixo desse valor</li>
<li>O cliente escolhe uma janela de horário de 4 horas (manhã, tarde ou noite) como preferência. O horário é uma estimativa e pode variar conforme a rota do dia.</li>
</ul>
<p><strong>⚡ Entrega Exclusiva</strong></p>
<ul>
<li>Motoboy exclusivo para o seu pedido</li>
<li>Prazo estimado: até 3 horas, para pedidos feitos até as 18h. Após esse horário (horário de corte), o pedido entra na primeira rota do dia seguinte e o prazo passa a ser <strong>até 11h do dia seguinte</strong></li>
<li>Taxa fixa de R$ 9,90</li>
<li>Disponível para qualquer produto do catálogo</li>
<li><strong>Pagamento obrigatório pelo aplicativo</strong> (PIX ou Cartão de Crédito via Mercado Pago) — pagamento na entrega (dinheiro) <strong>não está disponível</strong> para esta modalidade</li>
</ul>
<p>📦 Tanto a Entrega por Rota quanto a Entrega Exclusiva são serviços de entrega local <strong>sem rastreamento online</strong>: não existe link ou aplicativo de rastreio, e o acompanhamento do pedido é feito por telefone/WhatsApp.</p>
<h2>6. Formas de Pagamento</h2>
<p>Aceitamos as seguintes formas de pagamento:</p>
<ul>
<li><strong>PIX</strong> — processado via Mercado Pago, com desconto de 5%</li>
<li><strong>Cartão de Crédito</strong> — processado via Mercado Pago, em até 12x</li>
<li><strong>Dinheiro na Entrega</strong> — disponível <strong>apenas para a Entrega por Rota</strong>. Para a Entrega Exclusiva, o pagamento deve ser feito obrigatoriamente pelo aplicativo (PIX ou Cartão)</li>
</ul>
<h2>7. Pagamento na Entrega — Regras de Troco</h2>
<p>Esta seção se aplica apenas a pedidos com <strong>Entrega por Rota</strong> pagos em dinheiro (a Entrega Exclusiva não aceita pagamento na entrega — veja a seção 5). Para pedidos com pagamento na entrega, o cliente deve estar com o <strong>valor exato ou em dinheiro trocado</strong> no momento do recebimento. Caso o entregador não possua troco disponível, a Zipshop se reserva o direito de cobrar uma <strong>taxa adicional</strong> sobre o valor total do pedido para cobrir o custo operacional gerado.</p>
<h2>8. Prazos de Entrega</h2>
<p>Os prazos informados (24-48h para entrega por rota e até 3h — ou até 11h do dia seguinte após o horário de corte das 18h — para entrega exclusiva) são <strong>estimativas</strong> e podem sofrer variações em razão de trânsito, condições climáticas, volume de pedidos ou outros fatores externos. A Zipshop se compromete a manter o cliente informado em caso de atrasos relevantes.</p>
<h2>9. Trocas e Devoluções</h2>
<p>Conforme o Código de Defesa do Consumidor (Art. 49), o cliente tem direito a se arrepender da compra em até <strong>7 dias corridos</strong> após o recebimento do produto, desde que o item esteja em sua embalagem original, sem indícios de uso e acompanhado da nota fiscal. Para solicitar troca ou devolução, entre em contato pelo WhatsApp.</p>
<h2>10. Garantia dos Produtos</h2>
<p>Todos os produtos comercializados possuem garantia conforme especificado em cada anúncio, respeitando no mínimo a garantia legal de 90 dias prevista no Código de Defesa do Consumidor para produtos duráveis.</p>
<h2>11. Privacidade e Proteção de Dados (LGPD)</h2>
<p>Coletamos apenas os dados necessários para processar seu pedido: nome, telefone, e-mail e endereço de entrega. Esses dados não são compartilhados com terceiros, exceto quando necessário para a operação de entrega ou processamento de pagamento (Mercado Pago). Você pode solicitar a exclusão dos seus dados a qualquer momento entrando em contato conosco.</p>
<h2>12. Disponibilidade de Produtos</h2>
<p>Os produtos estão sujeitos à disponibilidade em estoque. Caso um item fique indisponível após a confirmação do pedido, entraremos em contato para oferecer substituição ou reembolso.</p>
<h2>13. Limitação de Responsabilidade</h2>
<p>A Zipshop não se responsabiliza por atrasos causados por informações de endereço incorretas ou incompletas fornecidas pelo cliente, nem pela ausência do cliente no momento da entrega.</p>
<h2>14. Alterações nos Termos</h2>
<p>Estes termos podem ser atualizados a qualquer momento. Recomendamos a revisão periódica desta página. O uso contínuo do site após alterações implica na aceitação dos novos termos.</p>
<h2>15. Contato e Suporte</h2>
<p>Para dúvidas, reclamações ou suporte:</p>
<ul>
<li>📱 WhatsApp: <a href="https://wa.me/5555984566918" target="_blank" rel="noopener">(55) 98456-6918</a></li>
<li>📷 Instagram: <a href="https://www.instagram.com/zipshopsm" target="_blank" rel="noopener">@zipshopsm</a></li>
</ul>
<blockquote><p>Ao finalizar uma compra em nosso site, você declara estar ciente e de acordo com todos os termos descritos acima.</p></blockquote>$termos$,
  'termos',
  'Conteúdo completo da página Termos de Uso (editor com formatação)'
)
on conflict (chave) do nothing;

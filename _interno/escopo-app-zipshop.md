# App ZipShop — escopo para estimar horas

Este arquivo tem duas partes:

- **Parte A**: para copiar e colar em outras IAs (ChatGPT, Gemini etc.). Não tem as minhas horas, pra não influenciar a resposta.
- **Parte B**: a minha estimativa, pra comparar e tirar a média. **Não cole essa parte nas outras IAs.**

---

## PARTE A — copiar daqui até o fim da Parte A

Preciso de uma estimativa de horas de desenvolvimento para o projeto abaixo, feito por **um desenvolvedor júnior trabalhando sozinho, com ajuda de ferramentas de IA para programar**.

Responda numa tabela com: **item, horas mínimas, horas máximas e um comentário curto**. No fim, dê o total de horas e o prazo em meses, considerando cerca de 25 horas de trabalho por semana. Não invente funcionalidades além das listadas.

### Contexto do que já existe

- Loja online (e-commerce) **já pronta e funcionando**, feita em HTML, CSS e JavaScript puro, hospedada no Netlify.
- Banco de dados, login e arquivos no **Supabase** (PostgreSQL com regras de segurança por linha, triggers e funções).
- Funções do servidor no Netlify: criar pagamento, webhook do Mercado Pago, envio de e-mails e expiração de pedidos.
- Pagamento por **Mercado Pago** (Pix e cartão).
- Já existem no site: catálogo, busca, página de produto com galeria, vídeo e variações, carrinho, checkout com tipos de entrega, cupons, saldo/cashback, indicação, avaliações com foto e bônus, conta do cliente, rastreio de pedido e **painel administrativo completo** (produtos, pedidos, clientes, categorias, banners, cupons, avaliações, seções da home).
- **Caminho escolhido para o app**: transformar o site em aplicativo Android e iOS com **Capacitor**, reaproveitando o site. As funções novas são feitas uma vez só e funcionam no site e no app ao mesmo tempo.

### O que precisa ser feito

**1. App nas lojas**
- Empacotar o site com Capacitor para Android e iOS.
- Barra de navegação inferior com 5 áreas: Início, Carteira, Vídeos, Carrinho e Conta.
- Ajustes para o site funcionar bem como app: tela de abertura, ícone, voltar do Android, login com Google e com Apple.
- Notificações na tela do celular sobre os pedidos (pedido pago, saiu para entrega, entregue).
- Publicação na Play Store e na App Store: textos, imagens, política de privacidade e respostas a recusas.
- Uma rodada de ajustes visuais por tela antes do lançamento (cores, tamanhos, posição, textos e ícones).

**2. Carteira**
- Tela reunindo saldo disponível, cashback, cupons e saldo de indicação (os dados já existem).
- Extrato de movimentações: créditos, débitos, origem do saldo e histórico de uso.

**3. Logins da equipe e níveis de acesso no painel**
- Perfis: administrador (acesso total), separador, entregador e atendente.
- O administrador cria, edita, bloqueia e exclui usuários pelo painel e define as permissões.
- O administrador e o separador atribuem pedidos aos entregadores.
- Cada entregador vê só os pedidos atribuídos a ele e confirma a entrega pelo celular, com o código do cliente.
- Regras de segurança no banco para cada perfil, não só esconder botões na tela.

**4. Notificações completas**
- Enviar notificações pelo painel escolhendo o público: todos os clientes, carrinho abandonado, quem comprou um produto específico, membros do Clube, clientes que não compram há X dias.
- Definir título, mensagem, destino (link) e horário de envio (agendamento).
- No app: notificação na tela do celular. No site: sino dentro da conta e e-mail.
- Central de notificações com histórico.

**5. Clube ZipShop (fidelidade gratuita)**
- Missões mensais por valor gasto (ex.: R$ 100, R$ 200, R$ 300), que zeram todo mês.
- Recompensas cumulativas: quem chega numa faixa recebe também as anteriores.
- Recompensas: saldo, cashback extra, cupom, frete grátis ou brinde.
- Só contam pedidos entregues; cancelados e devolvidos não contam.
- Brinde marcado automaticamente no próximo pedido para a equipe separar.
- Tela com o progresso das missões e as recompensas liberadas.
- Painel para criar, editar, ativar e desativar missões, valores, períodos e recompensas.

**6. Feed de vídeos (só no app; no site, aviso para baixar o app)**
- Feed vertical, estilo TikTok.
- Vídeos postados pela loja no painel (sem limite de tempo, até 50 MB) e vídeos das avaliações dos clientes (até 30 segundos), reaproveitando o mesmo arquivo da avaliação, sem novo envio.
- Autorização de uso de imagem no envio da avaliação.
- Vídeo aprovado pelo admin antes de aparecer.
- Cada vídeo ligado a um produto: nome e botão de comprar.
- Curtir, comentar e compartilhar, com denúncia de comentário e moderação no painel.

**7. Atendimento por chat**
- Chat entre o cliente e um atendente da loja, no app e no site.
- Envio de fotos (produto com defeito etc.).
- Consulta dos dados do pedido durante o atendimento.
- Histórico das conversas e aviso de nova resposta.
- Aviso visível de prazo de resposta de até 48 horas.
- Caixa de entrada no painel com todas as conversas.

**8. Menu dos três pontinhos no card do produto**
- "Não gostei": esconde o produto só para aquele cliente.
- "Produto inapropriado": denúncia que chega ao painel.
- "Descobrir similares": mostra produtos parecidos.
- Recomendações simples (sem IA avançada) usando produtos vistos, categorias de interesse e os "Não gostei".

**9. Acessibilidade**
- Compatível com leitores de tela (TalkBack e VoiceOver), contraste, tamanho de fonte e navegação acessível.
- Avaliar a viabilidade do VLibras (não obrigatório).

**10. Central de Tratativas (ocorrências da operação)**
- Entregador e separador abrem ocorrências (cliente ausente, endereço errado, produto avariado, divergência na separação, entrega sem código etc.), com tipo, motivo, observação e fotos.
- Fluxos de aprovação por tipo: separador analisa, aprova, reprova ou encaminha; administrador tem a decisão final.
- Pedido de encerramento de entrega sem código, que só vale depois da aprovação do administrador e fica registrado no histórico do pedido.
- Prazo de 3 dias corridos por tratativa, com cor (verde, amarelo, vermelho), contador de dias e horas e destaque das atrasadas. Trocar o responsável não reinicia o prazo.
- Status: aberta, aguardando análise, em análise, aguardando informações, aguardando aprovação do administrador, aprovada, reprovada, resolvida, encerrada.
- Painel com indicadores, filtros (pedido, número, tipo, entregador, separador, responsável, status, data) e ordenação por prioridade. Pensado principalmente para celular.
- Histórico completo (quem fez o quê, quando e por quê), sem poder apagar registros.
- Notificações aos responsáveis (nova tratativa, encaminhamento, aprovação necessária, prazo vencendo ou vencido).
- Permissões: admin vê tudo, separador vê as da operação dele, entregador vê só as próprias.

**11. Pagaleve (só se a conta for aprovada)**
- Opção de pagamento Pagaleve no checkout do app e do site, pelo fluxo oficial deles, com a confirmação do pagamento atualizando o pedido.

**Fora do escopo:** anúncios com recompensa (estudo futuro), funções não listadas, mudanças depois do lançamento.

### Fim da Parte A

---

## PARTE B — minha estimativa (não colar nas outras IAs)

Estimativa para dev júnior com ajuda de IA, usando Capacitor.

| # | Item | Horas mín. | Horas máx. |
|---|---|---|---|
| 1 | App nas lojas (Capacitor, barra inferior, login Google/Apple, notificação de pedido, publicação, rodada de layout) | 80 | 120 |
| 2 | Carteira com extrato | 10 | 15 |
| 3 | Logins da equipe, níveis de acesso e entregador | 50 | 70 |
| 4 | Notificações completas | 45 | 65 |
| 5 | Clube ZipShop | 60 | 90 |
| 6 | Feed de vídeos | 50 | 75 |
| 7 | Atendimento por chat | 45 | 60 |
| 8 | Menu dos três pontinhos e recomendações | 25 | 35 |
| 9 | Acessibilidade | 20 | 30 |
| 10 | Central de Tratativas | 80 | 120 |
| 11 | Pagaleve | 30 | 45 |
|  | **Total** | **495** | **725** |

Na média, **610 horas**. A 25 horas por semana, dá uns **6 meses**.

### Como fazer a média com as outras IAs

1. Cole a Parte A em cada IA e anote o total mínimo e o máximo de cada uma.
2. Some os mínimos de todas (incluindo o meu) e divida pela quantidade de IAs. Faça o mesmo com os máximos.
3. A média entre esses dois resultados é o número de horas para usar.
4. Multiplique pela sua hora (sugestão de júnior: R$ 35 a R$ 60) para chegar ao valor.
5. Se alguma IA der um número muito diferente das outras (metade ou o dobro), descarte essa antes de fazer a média.

Quando tiver as respostas, me mande que eu comparo item por item e explico de onde vêm as diferenças.

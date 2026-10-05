# Checklist — PDV (frente de caixa) e acessos por cargo

> Lista viva do que falta para o Zipshop ter um caixa de balcão.
> Marque `[x]` quando um item ficar pronto. O Claude mostra este resumo
> no começo de cada sessão (ver `CLAUDE.md`).
>
> Legenda: `[x]` já existe · `[~]` existe em parte · `[ ]` falta

Última revisão: 05/10/2026

---

## 1. Acessos e cargos (prioridade — vem antes do caixa)

Hoje o admin é reconhecido por uma **lista fixa de e-mails** dentro da função
`is_admin()` do banco (`victormiguelgta@gmail.com`, `admin@zipshop.com`). Não
existe cargo: quem é admin pode tudo.

Regra combinada:
- **Dono/Admin** — tudo (configurações, textos, banners, relatórios).
- **Gerente** — login próprio; é o **único** que cadastra/edita produtos,
  preço e estoque; abre/fecha e confere caixa; cancela venda; vê relatórios.
- **Operador de caixa** — login próprio; **só vende** (abre venda, recebe,
  emite comprovante). **Não** edita produto, preço nem estoque.

- [x] Login de cliente (site)
- [x] Login do painel admin (por e-mail fixo)
- [ ] Tabela de funcionários com cargo (`admin` / `gerente` / `caixa`), ligada ao login
- [ ] Trocar `is_admin()` por funções por cargo (`tem_cargo('gerente')` etc.)
- [ ] Regras no banco (RLS): só gerente/admin alteram `produtos`, preço e estoque
- [ ] Tela para o admin criar/desativar funcionários e definir o cargo
- [ ] Painel mostra só os menus permitidos para o cargo de quem entrou
- [ ] Registro de quem fez cada ação (venda, cancelamento, ajuste de estoque)

## 2. Abertura e fechamento de caixa

- [ ] Abrir caixa: operador + valor inicial (troco)
- [ ] Só um caixa aberto por operador/terminal
- [ ] Fechar caixa: contar dinheiro, sistema mostra esperado × contado (sobra/falta)
- [ ] Fechamento conferido/aprovado pelo gerente
- [ ] Sangria (retirada de dinheiro) com motivo
- [ ] Suprimento (colocar troco) com motivo
- [ ] Histórico de caixas (data, operador, totais, diferença)

## 3. Venda no balcão

- [x] Cadastro de produtos com preço, variações e estoque (painel)
- [x] Baixa automática de estoque ao vender (já existe para pedidos do site)
- [ ] Tela de venda rápida (busca por nome, toque para adicionar)
- [ ] Código de barras / SKU no produto + leitor (câmera ou USB)
- [ ] Alterar quantidade e remover item da venda
- [ ] Escolher variação/cor na hora
- [ ] Aviso de estoque insuficiente
- [ ] Vincular cliente (CPF/telefone) — opcional
- [ ] Venda sem cadastro (consumidor final)
- [ ] Atalhos de teclado (agilidade no computador do balcão)

## 4. Pagamento

- [~] PIX e cartão (existem no site via Mercado Pago, não no balcão)
- [ ] Dinheiro com cálculo de troco
- [ ] PIX no balcão (QR na tela ou chave fixa) e confirmação
- [ ] Cartão na maquininha (registro manual de débito/crédito/parcelas)
- [ ] Dividir pagamento em 2+ formas
- [ ] Usar saldo/cashback do cliente no balcão
- [~] Cupom de desconto (existe no site, falta no balcão)
- [ ] Desconto manual (valor ou %) com limite — acima do limite pede senha do gerente

## 5. Pós-venda

- [ ] Comprovante para imprimir (impressora térmica 58/80 mm) ou enviar no WhatsApp
- [ ] Cancelar venda (só gerente) devolvendo estoque e estornando o caixa
- [~] Troca/devolução (existe para pedidos do site, falta no balcão)
- [ ] Reimprimir comprovante

## 6. Estoque (só gerente)

- [x] Editar estoque e preço no painel
- [x] Estoque por variação
- [ ] Entrada de mercadoria (nota/fornecedor, quantidade, custo)
- [ ] Ajuste de estoque com motivo (perda, avaria, contagem)
- [ ] Histórico de movimentações (quem, quando, quanto)
- [ ] Alerta de estoque baixo
- [~] Custo do produto (tabela `produtos_custos` existe — conferir uso)

## 7. Relatórios

- [x] Analytics de visitas/pedidos do site
- [ ] Vendas do dia (balcão + site) por forma de pagamento
- [ ] Ticket médio, nº de vendas, produtos mais vendidos
- [ ] Vendas por operador
- [ ] Lucro (venda − custo)
- [ ] Exportar para planilha

## 8. Fiscal e segurança (decidir com contador)

- [ ] Emissão de NFC-e / cupom fiscal (exige integração com serviço fiscal e certificado)
- [ ] Ficar funcionando sem internet (modo offline) — avaliar necessidade
- [ ] Sair automático do caixa após tempo parado
- [ ] Senha do gerente para ações sensíveis no terminal do caixa

---

## Ordem sugerida

1. Cargos e logins (seção 1) — base para todo o resto
2. Abrir/fechar caixa + venda rápida + dinheiro/PIX/cartão manual (seções 2–4)
3. Comprovante, cancelamento pelo gerente, relatório do dia
4. Movimentações de estoque e relatórios completos
5. Fiscal (NFC-e), quando o contador definir

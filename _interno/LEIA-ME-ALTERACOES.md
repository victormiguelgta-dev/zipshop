# Correções e melhorias aplicadas

Substitua os arquivos abaixo no seu projeto (mesmos caminhos):

- `js/cart.js`
- `cupons.html`
- `carrinho.html`
- `checkout.html`
- `admin/cupons.html`
- `produtos.html`
- `css/style.css`

Nenhuma alteração visual (cores, layout, CSS) foi feita fora do que foi
pedido — o resto é lógica e regras de negócio.

---

## 13. Cupom sumindo / não aplicando ✅

**Causa raiz:** o carrinho (`carrinho.html`) nunca consultava o banco de
cupons de verdade — tinha um código fixo (`"ZIPSHOP10"`) escrito direto
no HTML, sobra de uma versão de teste. Por isso um cupom real (como o
"HEXA"), validado em **Meus Cupons**, "desaparecia" ao chegar no
carrinho: o carrinho nunca soube que ele existia. O checkout sempre
funcionou certo (por isso deu certo no seu print aplicando direto lá).

**Corrigido:**
- O carrinho agora consulta a tabela `cupons` de verdade (mesma lógica
  do checkout): ativo, expirado, limite de usos, uso único por usuário,
  pedido mínimo.
- O cupom aplicado fica salvo e **viaja com você**: aplicado em "Meus
  Cupons" ou no carrinho, já chega aplicado no checkout — sem digitar
  de novo. Dá pra remover a qualquer momento.
- Cupom é limpo sozinho quando o carrinho é esvaziado ou um pedido é
  fechado.

## 14. Aviso de entrega não rastreável ✅
Aviso adicionado no passo "Tipo de Entrega" do checkout e na tela de
pedido confirmado (pagamento na entrega).

## 15. Horário de corte da Entrega Exclusiva ✅
O checkout calcula a hora do cliente e ajusta a mensagem de prazo da
Entrega Exclusiva automaticamente: até as 18h mostra "até 3 horas";
depois das 18h passa a mostrar "até 11h de amanhã" (com aviso
destacado explicando o motivo). O pedido salvo no banco guarda essa
previsão real. A opção continua disponível o tempo todo — só a
promessa de prazo muda; se preferir bloquear a opção fora do horário,
é só avisar.

## 16. Checkout travando em "Salvando pedido..." e tela em branco ao recarregar ✅
Pelos prints, o sinal de internet estava fraco no momento (1 barrinha)
— o mais provável é que o site tenha ficado esperando uma resposta do
banco que nunca chegou. O problema de fundo, que eu corrigi: **não
existia nenhum limite de tempo nem tratamento de erro** nessas
chamadas. Se algo demorasse ou falhasse, a tela simplesmente ficava
travada (ou em branco) pra sempre, sem nenhum aviso.

**Corrigido:**
- Toda chamada crítica do checkout (verificação de perfil, criação do
  pedido, geração do link de pagamento) agora tem um limite de tempo
  (15–20 segundos).
- Se estourar o tempo ou der qualquer erro, aparece uma mensagem clara
  com um botão de "Tentar novamente" — a tela nunca mais fica presa ou
  em branco sem explicação.
- Isso não resolve problema de conexão do lado do cliente (isso é rede,
  não dá pra "corrigir" no código), mas garante que o site sempre avisa
  e deixa a pessoa tentar de novo, em vez de travar.

## 17. Tela "Seus Dados" do checkout redesenhada ✅
Como pedido: a janela inicial agora é menor e mostra os **endereços já
salvos** do cliente como cartões selecionáveis (com ícone por tipo),
mais um cartão "➕ Novo endereço de entrega". Ao criar um endereço novo,
o cliente escolhe entre 3 modalidades fixas — 🏠 **Casa**, 🏢
**Trabalho**, 🎓 **Prédio de estudo** — em vez de digitar um apelido
livre, e pode optar por salvar esse endereço pra próxima compra (usa a
mesma tabela `enderecos` que já existia, então tudo que for salvo
aparece também em "Meus Endereços" na conta, e vice-versa).

Sem endereço salvo ainda: o formulário completo abre direto (like
antes). Com endereço salvo: abre só a lista compacta, e o formulário
completo só aparece se a pessoa clicar em "Novo endereço" ou "Editar".

## 18. Cupom (HEXA) não aparece em "Meus Cupons" ✅ (correção + causa provável)

O "HEXA" valida certinho quando você digita o código manualmente — isso
prova que ele existe e está ativo. Mas a lista de "Meus Cupons" só
mostra cupons marcados como **🌍 Público** ou vinculados diretamente ao
`usuario_id` de quem está logado. Se um cupom está como **🔒 Privado**
e **sem nenhum cliente vinculado**, ele fica "órfão": válido pra quem
souber o código, mas invisível pra sempre na lista — provavelmente foi
isso que aconteceu com o HEXA (o "Público" deve ter ficado desmarcado
na hora de criar).

**O que eu adicionei** no painel admin (`admin/cupons.html`) pra isso
não passar batido de novo:
- Um aviso vermelho aparece automaticamente no card de qualquer cupom
  nessa situação (privado + sem cliente vinculado), com um botão
  **"🌍 Tornar público agora"** que resolve com um clique.
- Uma explicação fixa embaixo do checkbox "Público" no formulário de
  criar/editar cupom, avisando sobre essa armadilha.

**Pra resolver o HEXA agora:** entra no admin → Cupons → você vai ver
o aviso vermelho no card dele → clica em "Tornar público agora" (ou
edita o cupom e marca "Público" manualmente). Depois disso ele aparece
normalmente em "Meus Cupons" pra todo mundo.

## 19. Filtros da página de Produtos — mais compactos e em 2 colunas ✅
O painel de "Filtros" (Categorias e Marcas) tava com pouco espaçamento
aproveitado — cada opção numa linha só, painel grande. Agora:
- Categorias e Marcas aparecem em **grade de 2 colunas**, em vez de uma
  embaixo da outra.
- Espaçamentos, fontes e o painel como um todo ficaram mais compactos.
- Nomes muito longos são cortados com "..." (sem quebrar o layout) —
  passe o mouse/toque e segure pra ver o nome completo, se precisar.

Arquivos alterados: `produtos.html` e `css/style.css`.

---

## Pendências que continuam em aberto

- Confirmação de CPF/telefone por e-mail: segue desativada até vocês
  registrarem domínio próprio no Resend.
- Sugestão antiga: valor mínimo de preço no cadastro de produtos do
  admin, pra evitar cadastrar abaixo do mínimo aceito pelo Mercado
  Pago.

# Zipshop — Deploy automático + verificação real de telefone por SMS

Este guia cobre as duas coisas que faltam configurar do seu lado (exigem
suas próprias contas — eu não posso criar essas contas por você).

---

## 1. Deploy automático (Git → Netlify)

Hoje o deploy provavelmente é manual (arrastar pasta no Netlify). Com Git
conectado, todo `git push` gera um deploy novo sozinho.

### 1.1 Criar o repositório
```bash
cd zipshop-html
git init
git add .
git commit -m "Primeiro commit"
```

### 1.2 Subir pro GitHub
1. Crie uma conta em https://github.com se ainda não tiver.
2. Clique em **New repository** (pode ser privado).
3. Não marque "Add README" (o projeto já tem arquivos).
4. Copie os comandos que o GitHub mostra, algo como:
```bash
git remote add origin https://github.com/SEU-USUARIO/zipshop.git
git branch -M main
git push -u origin main
```

### 1.3 Conectar o Netlify ao repositório
1. No painel da Netlify: **Add new site → Import an existing project**.
2. Escolha **GitHub** e autorize o acesso.
3. Selecione o repositório `zipshop`.
4. Configurações de build (o `netlify.toml` já define a maioria):
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
5. Clique em **Deploy**.

### 1.4 Configurar as variáveis de ambiente no Netlify
Isso é o que resolve a parte de "tirar a env do arquivo perigoso" — as
chaves sensíveis (`SUPABASE_SERVICE_KEY`, `MP_ACCESS_TOKEN`,
`RESEND_API_KEY`) já são lidas via `process.env` no código, mas
**precisam existir** nas variáveis de ambiente do próprio site Netlify
(não em nenhum arquivo do repositório):

Site settings → Environment variables → Add a variable:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (a chave *service role*, NUNCA a publishable — pegue em Supabase → Project Settings → API)
- `MP_ACCESS_TOKEN` (token de produção do Mercado Pago)
- `RESEND_API_KEY`

A partir daqui, **qualquer `git push` na branch `main` dispara um deploy
automático** — sem precisar mexer no Netlify de novo.

> Nota sobre a chave do Supabase que fica em `js/supabase-config.js`
> (`sb_publishable_...`): essa é a chave pública/anônima, feita pra
> ficar visível no navegador — não é um segredo. A proteção de verdade
> vem das políticas de RLS (Row Level Security) configuradas no banco,
> não de esconder essa chave.

---

## 2. Verificação real de telefone por SMS

O código já está pronto em `conta.html` (envia e confere o código) e em
`checkout.html` (só libera a compra se o telefone estiver realmente
confirmado). Falta só configurar o provedor de SMS, que exige conta
própria.

### 2.1 Criar conta na Twilio
1. Crie uma conta em https://www.twilio.com/try-twilio (tem crédito de
   teste grátis).
2. No painel, anote:
   - **Account SID**
   - **Auth Token**
   - Compre ou use o número de teste com capacidade de SMS (**Messaging → Try it out** ou **Phone Numbers**).
3. Enquanto a conta estiver em modo *trial*, a Twilio só envia SMS para
   números que você verificou manualmente no painel. Pra enviar pra
   qualquer cliente de verdade, é preciso fazer upgrade da conta (sair
   do trial) — isso tem custo por SMS enviado.
4. Para números brasileiros em produção, a Twilio pode pedir um cadastro
   adicional (registro de remetente) — se aparecer esse aviso ao tentar
   enviar, siga as instruções na tela deles.

### 2.2 Ligar o Twilio no Supabase
1. No painel do Supabase: **Authentication → Providers → Phone**.
2. Ative o provedor **Phone**.
3. Escolha **Twilio** como SMS provider e cole Account SID, Auth Token e
   o número de origem (ou Messaging Service SID).
4. Em **Authentication → Settings**, confirme que a confirmação de
   telefone está exigida (o nome exato do campo pode variar conforme a
   versão do painel — procure por algo como "Confirm phone changes" ou
   "Secure phone change").

### 2.3 Rodar a migração SQL
Abra o SQL Editor do Supabase e rode o arquivo `sql-status-telefone-admin.sql`
(cria uma *view* só de leitura pro admin ver quem tem telefone confirmado
de verdade — sem criar nenhuma coluna que o cliente possa forjar).

### 2.4 Testar
1. Acesse `conta.html`, logado.
2. Digite um telefone válido → **Enviar código de verificação**.
3. Deve chegar um SMS de verdade no celular.
4. Digite o código de 6 dígitos → **Confirmar código**.
5. Tente finalizar uma compra em `checkout.html` sem confirmar o
   telefone: deve bloquear pedindo "Telefone confirmado por SMS".

---

## Por que essa arquitetura?

- **Quem decide se o telefone está confirmado é o Supabase Auth**
  (`phone_confirmed_at`), não uma coluna qualquer na tabela `usuarios`.
  Isso é importante: se fosse uma coluna comum, qualquer pessoa poderia
  editar os dados pelo próprio navegador (DevTools) e se
  autodeclarar "confirmado" sem nunca ter recebido o SMS. O
  `phone_confirmed_at` só é escrito pelo servidor da Supabase, depois de
  validar o código — o cliente não tem como forjar isso.
- Formato válido (DDD real, 11 dígitos) e "número realmente do cliente"
  são coisas diferentes — a primeira evita erro de digitação, a segunda
  só se garante com um código enviado e confirmado de volta.

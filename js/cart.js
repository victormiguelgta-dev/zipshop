const CART_KEY = 'zipshop_cart';
// CORREÇÃO BUG 13: cupom aplicado precisa "viajar" entre as páginas
// (Meus Cupons → Carrinho → Checkout), então guardamos ele aqui junto
// com o carrinho, num único lugar compartilhado por todo o site.
const CUPOM_KEY = 'zipshop_cupom_aplicado';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}

let _syncCarrinhoTimeout = null;
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  updateFloatCart();

  // Sincroniza com o banco (só se estiver logado) — usado pro sistema
  // de carrinho abandonado e pra manter o carrinho entre aparelhos.
  // Com debounce pra não bater no banco a cada clique de + / -.
  clearTimeout(_syncCarrinhoTimeout);
  _syncCarrinhoTimeout = setTimeout(() => sincronizarCarrinhoAtivo(cart), 1200);
}

async function sincronizarCarrinhoAtivo(cart) {
  try {
    const { supabase } = await import('/js/supabase-config.js');
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    if (!cart.length) {
      await supabase.from('carrinhos_ativos').delete().eq('usuario_id', user.id);
    } else {
      await supabase.from('carrinhos_ativos').upsert({
        usuario_id: user.id,
        usuario_email: user.email,
        usuario_nome: user.user_metadata?.full_name || '',
        itens: cart,
        atualizado_em: new Date().toISOString(),
        lembrete_enviado: false
      });
    }
  } catch (e) { /* nunca deve travar o carrinho por causa disso */ }
}

// Cupom aplicado (persistido): { id, codigo, tipo, valor }
function getCupomAplicado() {
  try { return JSON.parse(localStorage.getItem(CUPOM_KEY) || 'null'); } catch { return null; }
}

function setCupomAplicado(cupom) {
  if (cupom) localStorage.setItem(CUPOM_KEY, JSON.stringify(cupom));
  else localStorage.removeItem(CUPOM_KEY);
}

function clearCupomAplicado() {
  localStorage.removeItem(CUPOM_KEY);
}

// Escapa texto antes de ir pro innerHTML (evita XSS). Global porque
// o cart.js é carregado em todas as páginas.
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Foto que vai pro carrinho: a miniatura leve se existir, senão a
// principal. Antes o carrinho não guardava foto nenhuma e mostrava 📦.
function imagemDoProduto(p) {
  return (p && (p.image_thumb_url || p.image_url)) || null;
}

// HTML da foto de um item do carrinho (usado no carrinho e no checkout).
// Sem foto salva, cai no emoji como antes. "tamanho" em px.
function cartItemImgHTML(item, tamanho = 80) {
  const url = String(item.image || '');
  const fotoValida = /^https:\/\//i.test(url);
  const base = `width:${tamanho}px;height:${tamanho}px;border-radius:10px;flex-shrink:0;overflow:hidden;`;
  if (fotoValida) {
    const src = url.replace(/"/g, '%22');
    return `<div class="cart-item-img" style="${base}background:#fff"><img src="${src}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
  }
  const emoji = String(item.emoji || '📦').replace(/[<>&"']/g, '');
  return `<div class="cart-item-img" style="${base}background:linear-gradient(135deg,#1e3a6e,#2563eb);display:flex;align-items:center;justify-content:center;font-size:${Math.round(tamanho / 2)}px">${emoji}</div>`;
}

// Cada linha do carrinho é produto + variação (cor). Duas cores do mesmo
// produto ficam em linhas separadas em vez de somar numa só.
function chaveItem(item) {
  return item.cor ? `${item.id}|${item.cor}` : String(item.id);
}

// O produto tem cores cadastradas? (mesmo filtro da página do produto)
function temCores(p) {
  return Array.isArray(p?.cores) && p.cores.some(c => String(c?.nome || '').replace(/[\s:—–-]+$/, ''));
}

function addToCart(productId, qty = 1, productData = null, event = null) {
  // Botão "Adicionar" dos cards não tem como escolher a cor: manda pra
  // página do produto, onde o cliente escolhe
  if (temCores(productData) && !productData.cor) {
    showToast('Escolha a cor do produto', 'info');
    setTimeout(() => { window.location.href = `produto.html?id=${encodeURIComponent(productId)}`; }, 600);
    return;
  }
  const cart = getCart();
  const chave = chaveItem({ id: productId, cor: productData?.cor });
  const existing = cart.find(i => chaveItem(i) === chave);
  if (existing) {
    existing.qty += qty;
    // CORREÇÃO BUG 1: atualiza o preço sempre que o produto já está no carrinho
    if (productData?.price !== undefined && productData.price > 0) {
      existing.price = productData.price;
      existing.name  = productData.name  || existing.name;
      existing.emoji = productData.emoji || existing.emoji;
      existing.brand = productData.brand || existing.brand;
      existing.image = imagemDoProduto(productData) || existing.image;
    }
  } else {
    const item = { id: productId, qty };
    if (productData?.cor) item.cor = productData.cor;
    if (productData) {
      item.price = productData.price;
      item.name  = productData.name;
      item.emoji = productData.emoji;
      item.brand = productData.brand;
      item.image = imagemDoProduto(productData);
    }
    cart.push(item);
  }
  saveCart(cart);

  // Analytics: registra sem travar nada (import dinâmico pq este
  // arquivo é script clássico, não módulo)
  import('/js/analytics.js').then(m => m.registrarEvento('adicionar_carrinho', { produtoId: productId })).catch(() => {});

  // Feedback: a foto do produto voa até o carrinho (sem pop-up)
  animarVooCarrinho(event, productData);
  anunciarLeitorTela('Produto adicionado ao carrinho');
}

// "chave" = chaveItem(item): identifica a linha (produto + cor)
function removeFromCart(chave) {
  const cart = getCart().filter(i => chaveItem(i) !== String(chave));
  saveCart(cart);
}

function updateQty(chave, qty) {
  const cart = getCart();
  const item = cart.find(i => chaveItem(i) === String(chave));
  if (item) { item.qty = Math.max(1, qty); saveCart(cart); }
}

function clearCart() {
  saveCart([]);
  // Limpa também o cupom aplicado — não faz sentido ele sobreviver
  // pra um carrinho novo/vazio.
  clearCupomAplicado();
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + ((item.price || 0) * item.qty), 0);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('#cart-count, .cart-float-badge').forEach(el => {
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

// Carrinho flutuante na parte inferior
function updateFloatCart() {
  const count = getCartCount();
  const total = getCartTotal();
  let cart = document.getElementById('cart-float');

  // Não mostra no carrinho, checkout e conta
  const paginasExcluidas = ['carrinho.html', 'checkout.html', 'conta.html', 'login.html', 'cadastro.html'];
  const paginaAtual = window.location.pathname.split('/').pop();
  if (paginasExcluidas.some(p => paginaAtual.includes(p))) {
    if (cart) cart.remove();
    document.body.classList.remove('has-float-cart');
    return;
  }

  if (count === 0) {
    if (cart) { cart.classList.remove('visible'); setTimeout(() => cart?.remove(), 300); }
    document.body.classList.remove('has-float-cart');
    return;
  }

  if (!cart) {
    cart = document.createElement('div');
    cart.id = 'cart-float';
    cart.className = 'cart-float';
    cart.innerHTML = `
      <div class="cart-float-info">
        <div class="cart-float-icon">🛒<span class="cart-float-badge" id="cart-float-badge">${count}</span></div>
        <div>
          <div class="cart-float-text">${count} item(ns)</div>
          <div class="cart-float-total" id="cart-float-total">${total.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</div>
        </div>
      </div>
      <button class="cart-float-btn" onclick="window.location.href='carrinho.html'">
        Ver Carrinho →
      </button>`;
    document.body.appendChild(cart);
    document.body.classList.add('has-float-cart');
    requestAnimationFrame(() => cart.classList.add('visible'));
    // Altura real da barra (muda entre celular e computador): o botão do
    // WhatsApp usa isso pra ficar logo ACIMA dela, sem cobrir o "Ver Carrinho"
    const medir = () => document.documentElement.style.setProperty('--altura-float-cart', cart.offsetHeight + 'px');
    requestAnimationFrame(medir);
    if (!window._medirFloatCart) {
      window._medirFloatCart = true;
      window.addEventListener('resize', () => {
        const c = document.getElementById('cart-float');
        if (c) document.documentElement.style.setProperty('--altura-float-cart', c.offsetHeight + 'px');
      });
    }
  } else {
    const badge = document.getElementById('cart-float-badge');
    const totalEl = document.getElementById('cart-float-total');
    const text = cart.querySelector('.cart-float-text');
    if (badge) badge.textContent = count;
    if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
    if (text) text.textContent = `${count} item(ns)`;
  }
}

// Animação: produto voa até o carrinho
// Pega o carrinho que está visível na tela: o da navbar (fica fixa no
// topo) ou, se não der, a barra flutuante de baixo.
function alvoDoCarrinho() {
  for (const el of [document.querySelector('.cart-btn'), document.getElementById('cart-float')]) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

// Foto do produto voa em arco do botão/card até o carrinho, diminuindo.
// Quando chega, o ícone do carrinho dá um "pulinho".
function animarVooCarrinho(event, productData) {
  const botao = event?.target instanceof Element ? (event.target.closest('button, a') || event.target) : null;
  const alvo = alvoDoCarrinho();
  const menosMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!botao || !alvo || menosMovimento || !Element.prototype.animate) { animarBounce(); return; }

  // Origem: a foto do card, ou a foto grande na página do produto
  const card = botao.closest('.product-card');
  const foto = card ? card.querySelector('.product-card-img img') : document.getElementById('detail-main-img');
  const origem = (foto || botao).getBoundingClientRect();
  const destino = alvo.getBoundingClientRect();

  const TAM = 56;
  const voo = document.createElement('div');
  voo.className = 'voo-carrinho';
  voo.setAttribute('aria-hidden', 'true');
  const src = foto?.currentSrc || foto?.src || productData?.image_thumb_url || productData?.image_url;
  if (src) {
    const img = document.createElement('img');
    img.src = src; img.alt = '';
    voo.appendChild(img);
  } else {
    voo.textContent = productData?.emoji || '📦';
  }

  const x0 = origem.left + origem.width / 2 - TAM / 2;
  const y0 = origem.top + origem.height / 2 - TAM / 2;
  const dx = destino.left + destino.width / 2 - TAM / 2 - x0;
  const dy = destino.top + destino.height / 2 - TAM / 2 - y0;
  voo.style.left = `${x0}px`;
  voo.style.top = `${y0}px`;
  document.body.appendChild(voo);

  // Curva (Bézier quadrática) com o ponto de controle acima do caminho,
  // pra fazer o arco. Vários quadros deixam a curva suave.
  const cx = dx * 0.5, cy = Math.min(0, dy) - 120;
  const quadros = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, u = 1 - t;
    const x = 2 * u * t * cx + t * t * dx;
    const y = 2 * u * t * cy + t * t * dy;
    quadros.push({ transform: `translate(${x}px, ${y}px) scale(${1 - 0.7 * t})`, opacity: t < 0.85 ? 1 : 0.6 });
  }
  const anim = voo.animate(quadros, { duration: 750, easing: 'ease-in' });
  anim.onfinish = anim.oncancel = () => {
    voo.remove();
    alvo.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: 350, easing: 'ease-out' }
    );
    animarBounce();
  };
}

// Sem pop-up na tela, avisa quem usa leitor de tela
function anunciarLeitorTela(msg) {
  let el = document.getElementById('aviso-leitor-tela');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso-leitor-tela';
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    document.body.appendChild(el);
  }
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 50);
}

// Bounce no badge do carrinho
function animarBounce() {
  document.querySelectorAll('#cart-count, .cart-float-badge').forEach(el => {
    if (el) {
      el.classList.remove('bounce');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('bounce'));
      });
      setTimeout(() => el.classList.remove('bounce'), 600);
    }
  });
}

function showToast(msg, type = 'info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 2500);
}

// Contador regressivo do prazo de pagamento (Pix/cartão).
// Qualquer elemento com data-expira="<data ISO>" vira "12:34:56" e se
// atualiza sozinho a cada segundo. Usado em Meus Pedidos e no checkout.
function atualizarContadores() {
  document.querySelectorAll('[data-expira]').forEach(el => {
    const falta = new Date(el.dataset.expira) - Date.now();
    if (isNaN(falta)) return;
    if (falta <= 0) { el.textContent = 'prazo encerrado'; el.style.color = '#ef4444'; return; }
    const s = Math.floor(falta / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = `${hh}:${mm}:${ss}`;
    if (falta < 60 * 60 * 1000) el.style.color = '#ef4444'; // última hora em vermelho
  });
}
setInterval(atualizarContadores, 1000);

// Inicializa o carrinho flutuante quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateFloatCart();
});

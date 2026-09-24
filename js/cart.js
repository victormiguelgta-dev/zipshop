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

function addToCart(productId, qty = 1, productData = null, event = null) {
  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
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

  // Animação ao adicionar
  if (event) {
    animarVooCarrinho(event, productData?.emoji || '📦');
  } else {
    animarBounce();
  }

  showToast('✅ Adicionado ao carrinho!', 'success');
}

function removeFromCart(productId) {
  const cart = getCart().filter(i => i.id !== productId);
  saveCart(cart);
}

function updateQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
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
function animarVooCarrinho(event, emoji) {
  const btn = event?.target || event?.currentTarget;
  if (!btn) { animarBounce(); return; }

  const rect = btn.getBoundingClientRect();
  const cartIcon = document.querySelector('.cart-btn') || document.getElementById('cart-float');
  const cartRect = cartIcon ? cartIcon.getBoundingClientRect() : { left: window.innerWidth - 60, top: 20 };

  const fly = document.createElement('div');
  fly.className = 'fly-item';
  fly.textContent = emoji;
  fly.style.left = `${rect.left + rect.width / 2}px`;
  fly.style.top = `${rect.top + rect.height / 2}px`;
  fly.style.setProperty('--fly-x', `${(cartRect.left - rect.left) * 0.5}px`);
  fly.style.setProperty('--fly-y', `${(cartRect.top - rect.top) * 0.5}px`);
  fly.style.setProperty('--fly-x2', `${cartRect.left - rect.left}px`);
  fly.style.setProperty('--fly-y2', `${cartRect.top - rect.top}px`);
  document.body.appendChild(fly);
  setTimeout(() => fly.remove(), 800);

  // Partículas
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${rect.left + rect.width / 2}px`;
    p.style.top = `${rect.top + rect.height / 2}px`;
    const angle = (i / 6) * 360;
    const dist = 40 + Math.random() * 30;
    p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    p.style.background = i % 2 === 0 ? '#AAEF00' : '#fff';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }

  setTimeout(() => animarBounce(), 600);
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

// Inicializa o carrinho flutuante quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateFloatCart();
});

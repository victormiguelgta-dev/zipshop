const BASE = document.querySelector('meta[name="base"]')?.content || '';

const ADMIN_EMAILS = [
  'victormiguelgta@gmail.com',
  'admin@zipshop.com',
];

function navbarHTML(user, isAdmin = false) {
  const userBtn = user
    ? `<a href="${BASE}/conta.html" class="nav-btn" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        👤 ${(user.user_metadata?.full_name || user.email || '').split(' ')[0].split('@')[0]}
       </a>`
    : `<a href="${BASE}/login.html" class="nav-btn">👤 Entrar</a>`;

  return `
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="${BASE}/index.html" class="logo">
        <img src="${BASE}/img/logo-icon.jpeg" alt="Zipshop" class="logo-img" onerror="this.style.display='none'">
        <span class="logo-text"><span>ZIP</span><span>SHOP</span></span>
      </a>
      <form class="search-form" onsubmit="handleSearch(event)">
        <input type="search" id="search-input" placeholder="Buscar produtos, marcas e categorias..." autocomplete="off">
        <button type="submit">🔍</button>
      </form>
      <div class="nav-actions">
        ${isAdmin ? `<a href="${BASE}/admin/index.html" class="nav-btn" style="background:var(--primary);color:#000;font-weight:900;font-size:12px;padding:6px 12px">⚙️ Admin</a>` : ''}
        ${userBtn}
        <a href="${BASE}/carrinho.html" class="nav-btn cart-btn">
          🛒
          <span class="cart-count" id="cart-count" style="display:none">0</span>
        </a>
      </div>
    </div>
    <div class="nav-categories">
      <div class="nav-categories-inner">
        <a href="${BASE}/produtos.html?cat=Smartphones" class="nav-cat-link">Smartphones</a>
        <a href="${BASE}/produtos.html?cat=Notebooks" class="nav-cat-link">Notebooks</a>
        <a href="${BASE}/produtos.html?cat=Headphones" class="nav-cat-link">Headphones</a>
        <a href="${BASE}/produtos.html?cat=Smart+TVs" class="nav-cat-link">Smart TVs</a>
        <a href="${BASE}/produtos.html?cat=Games" class="nav-cat-link">Games</a>
        <a href="${BASE}/produtos.html?cat=Acessorios" class="nav-cat-link">Acessórios</a>
        <a href="${BASE}/produtos.html?deal=1" class="nav-cat-link highlight">🔥 Ofertas do Dia</a>
      </div>
    </div>
  </nav>`;
}

function footerHTML() {
  return `
  <footer>
    <div class="footer-inner">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">
            <a href="${BASE}/index.html" class="logo">
              <img src="${BASE}/img/logo-icon.jpeg" alt="Zipshop" class="logo-img" style="width:32px;height:32px" onerror="this.style.display='none'">
              <span class="logo-text"><span>ZIP</span><span>SHOP</span></span>
            </a>
          </div>
          <p class="footer-desc">A loja de eletrônicos mais rápida do Brasil.<br>Pra ontem, pra agora, pra você.</p>
          <div style="display:flex;gap:12px;margin-top:16px">
            <a href="https://www.instagram.com/zipshopsm?igsh=bWhwMG1haTZpYzdn" target="_blank" rel="noopener"
              style="width:36px;height:36px;border-radius:50%;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;color:white;text-decoration:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="https://wa.me/5555981159575" target="_blank" rel="noopener"
              style="width:36px;height:36px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;color:white;text-decoration:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.528 5.855L.057 23.928a.5.5 0 00.636.607l6.263-1.643A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.655-.52-5.17-1.427l-.36-.214-3.733.979.997-3.645-.235-.374A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <p class="footer-col-title">Comprar</p>
          <div class="footer-links">
            <a href="${BASE}/produtos.html">Todos os Produtos</a>
            <a href="${BASE}/produtos.html?deal=1">Ofertas do Dia</a>
            <a href="${BASE}/produtos.html?cat=Smartphones">Smartphones</a>
            <a href="${BASE}/produtos.html?cat=Notebooks">Notebooks</a>
          </div>
        </div>
        <div>
          <p class="footer-col-title">Ajuda</p>
          <div class="footer-links">
            <a href="${BASE}/conta.html">Minha Conta</a>
            <a href="${BASE}/conta.html">Rastrear Pedido</a>
            <a href="https://wa.me/5555984566918" target="_blank" rel="noopener">Trocas e Devoluções</a>
          </div>
        </div>
        <div>
          <p class="footer-col-title">Suporte</p>
          <div class="footer-links">
            <a href="https://wa.me/5555984566918" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px">
              <span style="background:#25D366;border-radius:4px;padding:2px 6px;font-size:11px;color:white;font-weight:700">WhatsApp</span>
              Fale pelo WhatsApp
            </a>
            <a href="mailto:suporte@zipshop.com" style="display:flex;align-items:center;gap:6px">
              <span style="background:#ea4335;border-radius:4px;padding:2px 6px;font-size:11px;color:white;font-weight:700">E-mail</span>
              suporte@zipshop.com
            </a>
            <a href="${BASE}/termos.html" style="color:var(--text-muted);font-size:12px">Termos de Uso</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2024 Zipshop. Todos os direitos reservados.</span>
        <div class="footer-pay">
          <img src="${BASE}/img/pix.jpeg" alt="PIX" title="PIX" style="height:24px;border-radius:4px">
          <img src="${BASE}/img/visa.jpeg" alt="Visa" title="Visa" style="height:24px;border-radius:4px">
          <img src="${BASE}/img/marstercard.jpeg" alt="Mastercard" title="Mastercard" style="height:24px;border-radius:4px">
        </div>
      </div>
    </div>
  </footer>`;
}

function handleSearch(e) {
  e.preventDefault();
  const q = document.getElementById('search-input')?.value?.trim();
  if (q) window.location.href = `${BASE}/produtos.html?q=${encodeURIComponent(q)}`;
}

async function initPage() {
  let currentUser = null;
  let isAdmin = false;
  let sb = null;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient('https://kkliwdphrdbguclsvxcw.supabase.co', 'sb_publishable_OMXANLsZK98fPWygp8ZHfA_xzSpWgYb');
    // getSession() lê a sessão salva localmente (sem depender de uma
    // chamada de rede terminar a tempo). getUser() faz essa chamada
    // de rede pra revalidar no servidor — se ela falhar ou demorar,
    // cai no catch e mostra "Entrar" mesmo com o usuário logado,
    // que era o bug do cabeçalho mostrando "Entrar" na tela de conta.
    const { data: { session } } = await sb.auth.getSession();
    currentUser = session?.user || null;
    isAdmin = !!(currentUser && ADMIN_EMAILS.includes(currentUser.email));
  } catch(e) {}

  const navEl = document.getElementById('navbar');
  if (navEl) navEl.innerHTML = navbarHTML(currentUser, isAdmin);
  const footEl = document.getElementById('footer');
  if (footEl) footEl.innerHTML = footerHTML();
  updateCartBadge();

  // Se a sessão mudar depois (login, logout, token renovado) em
  // qualquer aba, atualiza o cabeçalho sem precisar recarregar a página.
  if (sb) {
    sb.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      const admin = !!(user && ADMIN_EMAILS.includes(user.email));
      if (navEl) navEl.innerHTML = navbarHTML(user, admin);
    });
  }
}

document.addEventListener('DOMContentLoaded', initPage);

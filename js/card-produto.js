// Card de produto compacto (modelo do cliente): selos em cima da foto,
// nota numa linha, preço + preço riscado + parcela na mesma linha.
// Usado na home, na lista de produtos e nos favoritos.
//
// cardProdutoHTML(p, { fav, onFav, onAdd, esgotado, desconto, preco })
//   preco(v)  → texto em R$ (formatPrice da página)
//   onFav     → JS do clique no coração (ex: "toggleFavoritoCard(5, this)")
//   onAdd     → JS do clique em Adicionar
(function () {
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  window.cardProdutoHTML = function (p, o) {
    const preco = o.preco;
    const fotoSrc = p.image_thumb_url || p.image_url;
    const selos = [];
    // Com o selo do fornecedor junto, "Frete grátis" vira só "Grátis" pra caber
    if (p.frete_gratis) selos.push(`<span class="pc-selo pc-selo-frete">${icone('caminhao', 13)} ${p.tipo_estoque === 'dropshipping' ? 'Grátis' : 'Frete grátis'}</span>`);
    if (p.tipo_estoque === 'dropshipping') selos.push(`<span class="pc-selo pc-selo-drop">${icone('relogio', 13)} 5-15 dias</span>`);
    else if (p.entrega_24h) selos.push(`<span class="pc-selo pc-selo-24h">${icone('raio', 13)} 24h</span>`);
    const antigo = Number(p.oldPrice ?? p.old_price) > Number(p.price) ? Number(p.oldPrice ?? p.old_price) : 0;
    const nota = Number(p.rating) || 5;
    const qtdAval = Number(p.reviews) || 0;
    // Outras fotos do produto (as miniaturas quando tem), pras fotos
    // passarem sozinhas no card (ligarFotosPassando)
    const fotos = [fotoSrc];
    (Array.isArray(p.imagens) ? p.imagens : []).forEach(item => {
      const u = typeof item === 'string' ? item : (item?.thumb || item?.url);
      const grande = typeof item === 'string' ? item : item?.url;
      if (u && grande !== p.image_url && !fotos.includes(u) && /^https:\/\//.test(u)) fotos.push(u);
    });
    const fotosAttr = fotoSrc && fotos.length > 1 ? ` data-fotos="${esc(JSON.stringify(fotos.slice(0, 5)))}"` : '';

    return `
    <a href="produto.html?id=${p.id}" class="product-card pc${o.esgotado ? ' esgotado' : ''}">
      <div class="product-card-img">
        ${o.desconto ? `<span class="selo-desconto">-${o.desconto}%</span>` : ''}
        ${o.esgotado ? '<div class="esgotado-badge">Esgotado</div>' : ''}
        <button onclick="event.preventDefault(); ${o.onFav}" class="fav-btn" data-fav="${o.fav ? '1' : '0'}" aria-label="${o.fav ? 'Remover dos favoritos' : 'Favoritar'}">${iconeFav(o.fav)}</button>
        ${fotoSrc ? `<img src="${esc(fotoSrc)}" alt="" loading="lazy" decoding="async"${fotosAttr}>` : `<span class="pc-sem-foto">${icone('caixa', 48)}</span>`}
        ${selos.length ? `<div class="pc-selos">${selos.join('')}</div>` : ''}
      </div>
      <div class="product-card-body">
        <div class="product-brand">${esc(p.brand)}</div>
        <div class="product-name">${esc(p.name)}</div>
        ${qtdAval ? `<div class="pc-nota"><span class="pc-estrela">${icone('coracao', 13)}</span> ${nota.toFixed(1)} <span class="pc-qtd">(${qtdAval >= 1000 ? (qtdAval / 1000).toFixed(1).replace('.', ',') + ' mil' : qtdAval})</span></div>` : ''}
        <div class="pc-precos">
          <span class="product-price">${p.temVariacoes ? '<small>a partir de </small>' : ''}${preco(p.price)}</span>
          ${antigo ? `<s class="pc-antigo">${preco(antigo)}</s>` : ''}
          <span class="pc-parcela">10x ${preco(p.price / 10)}</span>
        </div>
      </div>
      <div class="product-card-footer">
        ${o.esgotado
          ? '<button class="btn btn-outline btn-full btn-sm" disabled onclick="event.preventDefault()">Sem estoque</button>'
          : `<button class="btn btn-primary btn-full btn-sm pc-add" onclick="event.preventDefault(); ${o.onAdd}">${icone('carrinho', 17)} Adicionar</button>`}
      </div>
    </a>`;
  };

  // Fotos passando sozinhas nos cards que estão na tela (como vídeo que
  // toca sem clicar). Só troca nos cards visíveis; saiu da tela, para e
  // volta pra primeira foto.
  const TEMPO_FOTO = 1800;
  let observador = null;
  function parar(img) {
    clearInterval(img._timerFotos); img._timerFotos = null;
    const fotos = JSON.parse(img.dataset.fotos);
    if (img.getAttribute('src') !== fotos[0]) img.src = fotos[0];
    img._fotoIdx = 0;
  }
  function comecar(img) {
    if (img._timerFotos) return;
    const fotos = JSON.parse(img.dataset.fotos);
    fotos.slice(1).forEach(u => { const pre = new Image(); pre.src = u; });
    img._fotoIdx = 0;
    img._timerFotos = setInterval(() => {
      if (!img.isConnected) { clearInterval(img._timerFotos); observador.unobserve(img); return; }
      if (document.hidden) return;
      img._fotoIdx = (img._fotoIdx + 1) % fotos.length;
      img.src = fotos[img._fotoIdx];
    }, TEMPO_FOTO);
  }
  window.ligarFotosPassando = function (raiz) {
    if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    observador = observador || new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.target.isConnected) return;
        if (e.isIntersecting) comecar(e.target); else if (e.target._timerFotos) parar(e.target);
      });
    }, { threshold: 0.7 });
    (raiz || document).querySelectorAll('.pc img[data-fotos]').forEach(img => {
      if (img._fotosLigadas) return;
      img._fotosLigadas = true;
      img.addEventListener('error', () => { const f = JSON.parse(img.dataset.fotos); if (img.getAttribute('src') !== f[0]) img.src = f[0]; });
      observador.observe(img);
    });
  };
})();

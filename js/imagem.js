/**
 * imagem.js — otimização de imagens no navegador, ANTES do upload.
 *
 * Usado pelo admin (produtos, importar, banners, categorias) e pela
 * foto de perfil em conta.html. Script clássico: as funções ficam
 * globais (window.otimizarImagem), então tanto <script> normal quanto
 * <script type="module"> conseguem chamar.
 *
 * Por que existe: foto de celular vem com 3–8 MB e em qualquer formato
 * (retrato, paisagem, com borda...). Aqui tudo sai num tamanho padrão
 * e leve, o que deixa os cards alinhados e o site rápido no 4G.
 */

// Descobre uma vez se o navegador sabe GERAR WebP pelo canvas.
// O Safari antigo "aceita" o pedido mas devolve PNG (que é enorme),
// então testamos de verdade em vez de confiar.
let _suportaWebp = null;
function suportaWebp() {
  if (_suportaWebp === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      _suportaWebp = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch (e) {
      _suportaWebp = false;
    }
  }
  return _suportaWebp;
}

/**
 * otimizarImagem(file, opcoes) → Promise<File>
 *
 * opcoes:
 *   lado      tamanho máximo do maior lado, em px (padrão 1600)
 *   quadrado  true = corta pelo centro e entrega lado×lado exato
 *   qualidade 0 a 1 (padrão 0.82)
 *   fundo     cor pintada atrás (PNG transparente vira preto em JPEG
 *             sem isso). Padrão branco.
 *
 * GIF volta intacto (senão perde a animação). Se qualquer coisa der
 * errado, devolve o arquivo original em vez de travar o upload.
 */
async function otimizarImagem(file, opcoes = {}) {
  const { lado = 1600, quadrado = false, qualidade = 0.82, fundo = '#ffffff' } = opcoes;
  if (!file || file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const w = bitmap.width, h = bitmap.height;

    // Recorte na imagem original (sx, sy, sw, sh)
    let sx = 0, sy = 0, sw = w, sh = h;
    if (quadrado) {
      const menor = Math.min(w, h);
      sx = Math.round((w - menor) / 2);
      sy = Math.round((h - menor) / 2);
      sw = sh = menor;
    }

    // Tamanho final — nunca aumenta uma imagem pequena
    const escala = Math.min(1, lado / Math.max(sw, sh));
    const dw = Math.max(1, Math.round(sw * escala));
    const dh = Math.max(1, Math.round(sh * escala));

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, dw, dh);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
    bitmap.close?.();

    const tipo = suportaWebp() ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise(r => canvas.toBlob(r, tipo, qualidade));
    if (!blob) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const nomeBase = (file.name || 'imagem').replace(/\.[^.]+$/, '');
    return new File([blob], `${nomeBase}.${ext}`, { type: blob.type });
  } catch (e) {
    console.warn('Não consegui otimizar a imagem, enviando a original:', e);
    return file;
  }
}

// Extensão certa a partir do tipo do arquivo (para montar o nome no Storage)
function extensaoImagem(file) {
  const t = file?.type || '';
  if (t === 'image/webp') return 'webp';
  if (t === 'image/png') return 'png';
  if (t === 'image/gif') return 'gif';
  return 'jpg';
}

// Presets usados no site — mudar aqui muda em todo lugar
const PRESET_IMAGEM = {
  produto:   { lado: 1000, quadrado: true, qualidade: 0.82, proporcao: 1 },
  miniatura: { lado: 480,  quadrado: true, qualidade: 0.75 },
  banner:    { lado: 1920, quadrado: false, qualidade: 0.8, fundo: '#0a0a0a', proporcao: 1920 / 800 },
  categoria: { lado: 400,  quadrado: true, qualidade: 0.8, proporcao: 1 },
  avatar:    { lado: 256,  quadrado: true, qualidade: 0.8, proporcao: 1, redondo: true },
};

/**
 * recortarImagem(file, opcoes) → Promise<File | null>
 *
 * Abre uma janela pra pessoa AJUSTAR a foto antes de enviar: arrastar
 * pra posicionar e dar zoom (barra, pinça no celular ou rodinha do
 * mouse). Diminuindo o zoom ao máximo, a foto aparece inteira com fundo.
 * Devolve o arquivo já recortado no tamanho final, ou null se cancelar.
 *
 * opcoes:
 *   proporcao  largura ÷ altura do recorte (1 = quadrado, 2.4 = banner)
 *   lado       largura final em px
 *   redondo    true = mostra a máscara redonda (foto de perfil)
 *   fundo      cor que preenche as sobras quando a foto fica menor
 *   qualidade  0 a 1
 *   titulo     texto do topo da janela
 */
function _estiloRecorte() {
  if (document.getElementById('recorte-estilo')) return;
  const st = document.createElement('style');
  st.id = 'recorte-estilo';
  st.textContent = `
    .recorte-fundo { position: fixed; inset: 0; background: rgba(0,0,0,.8); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .recorte-caixa { background: var(--bg-card, #1a1a1a); border: 1px solid var(--primary, #AAEF00); border-radius: 20px; padding: 20px; width: 100%; max-width: 520px; max-height: 100%; overflow-y: auto; color: var(--text, #f0f0f0); }
    .recorte-titulo { font-weight: 900; font-size: 16px; margin-bottom: 4px; }
    .recorte-dica { font-size: 12px; color: var(--text-muted, #888); margin-bottom: 14px; }
    .recorte-moldura { position: relative; width: 100%; overflow: hidden; border-radius: 12px; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
    .recorte-moldura:active { cursor: grabbing; }
    .recorte-moldura img { position: absolute; top: 0; left: 0; max-width: none; pointer-events: none; transform-origin: 0 0; }
    .recorte-moldura.redondo::after { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 999px rgba(0,0,0,.55); pointer-events: none; }
    .recorte-zoom { display: flex; align-items: center; gap: 10px; margin: 14px 0 18px; font-size: 18px; }
    .recorte-zoom input { flex: 1; accent-color: var(--primary, #AAEF00); }
    .recorte-botoes { display: flex; gap: 10px; }
    .recorte-botoes .btn { flex: 1; }
  `;
  document.head.appendChild(st);
}

function recortarImagem(file, opcoes = {}) {
  const { proporcao = 1, lado = 1000, redondo = false, fundo = '#ffffff', qualidade = 0.85,
          titulo = 'Ajustar imagem' } = opcoes;
  if (!file || file.type === 'image/gif') return Promise.resolve(file);
  _estiloRecorte();

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const fundoEl = document.createElement('div');
    fundoEl.className = 'recorte-fundo';
    fundoEl.innerHTML = `
      <div class="recorte-caixa" role="dialog" aria-modal="true" aria-labelledby="recorte-titulo">
        <p class="recorte-titulo" id="recorte-titulo"></p>
        <p class="recorte-dica">Arraste pra posicionar. Use a barra (ou dois dedos) pra dar zoom — no mínimo, a foto aparece inteira.</p>
        <div class="recorte-moldura${redondo ? ' redondo' : ''}"><img alt=""></div>
        <label class="recorte-zoom"><span aria-hidden="true">➖</span>
          <input type="range" min="0" max="1000" value="0" aria-label="Zoom"><span aria-hidden="true">➕</span></label>
        <div class="recorte-botoes">
          <button type="button" class="btn btn-outline" data-acao="cancelar">Cancelar</button>
          <button type="button" class="btn btn-primary" data-acao="usar">Usar esta foto</button>
        </div>
      </div>`;
    fundoEl.querySelector('.recorte-titulo').textContent = titulo;
    const moldura = fundoEl.querySelector('.recorte-moldura');
    const img = fundoEl.querySelector('img');
    const zoom = fundoEl.querySelector('input[type="range"]');
    moldura.style.aspectRatio = String(proporcao);
    moldura.style.background = fundo;
    document.body.appendChild(fundoEl);

    let iw = 0, ih = 0;        // tamanho natural da foto
    let sMin = 1, sMax = 1;    // escala mínima (inteira) e máxima
    let s = 1, ox = 0, oy = 0; // escala atual e deslocamento do centro (px da moldura)

    const tamMoldura = () => moldura.getBoundingClientRect();
    function limitar() {
      const { width: fw, height: fh } = tamMoldura();
      const lx = Math.abs(iw * s - fw) / 2, ly = Math.abs(ih * s - fh) / 2;
      ox = Math.max(-lx, Math.min(lx, ox));
      oy = Math.max(-ly, Math.min(ly, oy));
    }
    function desenhar() {
      const { width: fw, height: fh } = tamMoldura();
      limitar();
      const x = fw / 2 + ox - (iw * s) / 2, y = fh / 2 + oy - (ih * s) / 2;
      img.style.width = iw + 'px';
      img.style.height = ih + 'px';
      img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }
    // barra 0–1000 em escala logarítmica (zoom fica suave)
    const escalaDaBarra = v => sMin * Math.pow(sMax / sMin, v / 1000);
    const barraDaEscala = e => Math.round(1000 * Math.log(e / sMin) / Math.log(sMax / sMin));
    function mudarEscala(nova) {
      s = Math.max(sMin, Math.min(sMax, nova));
      zoom.value = barraDaEscala(s);
      desenhar();
    }

    img.onload = () => {
      iw = img.naturalWidth; ih = img.naturalHeight;
      const { width: fw, height: fh } = tamMoldura();
      sMin = Math.min(fw / iw, fh / ih);           // foto inteira
      const cobrir = Math.max(fw / iw, fh / ih);   // preenche a moldura
      sMax = Math.max(cobrir * 4, sMin * 1.01);
      mudarEscala(cobrir);                         // começa preenchendo
      fundoEl.querySelector('[data-acao="usar"]').focus();
    };
    img.onerror = () => { fechar(); resolve(file); }; // formato que o navegador não mostra: segue sem recorte
    img.src = url;

    zoom.addEventListener('input', () => { s = escalaDaBarra(Number(zoom.value)); desenhar(); });
    moldura.addEventListener('wheel', (e) => { e.preventDefault(); mudarEscala(s * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });

    // Arrastar (1 dedo/mouse) e pinça (2 dedos)
    const toques = new Map();
    let distInicial = 0, escalaInicial = 1;
    moldura.addEventListener('pointerdown', (e) => {
      moldura.setPointerCapture(e.pointerId);
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) {
        const [a, b] = [...toques.values()];
        distInicial = Math.hypot(a.x - b.x, a.y - b.y); escalaInicial = s;
      }
    });
    moldura.addEventListener('pointermove', (e) => {
      const antes = toques.get(e.pointerId);
      if (!antes) return;
      const agora = { x: e.clientX, y: e.clientY };
      toques.set(e.pointerId, agora);
      if (toques.size === 1) {
        ox += agora.x - antes.x; oy += agora.y - antes.y; desenhar();
      } else if (toques.size === 2 && distInicial) {
        const [a, b] = [...toques.values()];
        mudarEscala(escalaInicial * Math.hypot(a.x - b.x, a.y - b.y) / distInicial);
      }
    });
    const soltar = (e) => { toques.delete(e.pointerId); if (toques.size < 2) distInicial = 0; };
    moldura.addEventListener('pointerup', soltar);
    moldura.addEventListener('pointercancel', soltar);

    function fechar() {
      document.removeEventListener('keydown', teclado);
      fundoEl.remove();
      URL.revokeObjectURL(url);
    }
    function teclado(e) { if (e.key === 'Escape') { fechar(); resolve(null); } }
    document.addEventListener('keydown', teclado);

    fundoEl.querySelector('[data-acao="cancelar"]').onclick = () => { fechar(); resolve(null); };
    fundoEl.querySelector('[data-acao="usar"]').onclick = async () => {
      const { width: fw, height: fh } = tamMoldura();
      const W = Math.round(lado), H = Math.round(lado / proporcao);
      const k = W / fw;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = fundo;
      ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingQuality = 'high';
      const x = fw / 2 + ox - (iw * s) / 2, y = fh / 2 + oy - (ih * s) / 2;
      ctx.drawImage(img, x * k, y * k, iw * s * k, ih * s * k);
      const tipo = suportaWebp() ? 'image/webp' : 'image/jpeg';
      const blob = await new Promise(r => canvas.toBlob(r, tipo, qualidade));
      fechar();
      if (!blob) { resolve(file); return; }
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const nomeBase = (file.name || 'imagem').replace(/\.[^.]+$/, '');
      resolve(new File([blob], `${nomeBase}.${ext}`, { type: blob.type }));
    };
  });
}

window.recortarImagem = recortarImagem;
window.otimizarImagem = otimizarImagem;
window.extensaoImagem = extensaoImagem;
window.PRESET_IMAGEM = PRESET_IMAGEM;

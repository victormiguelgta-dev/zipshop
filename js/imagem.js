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
  produto:   { lado: 1000, quadrado: true, qualidade: 0.82 },
  miniatura: { lado: 480,  quadrado: true, qualidade: 0.75 },
  banner:    { lado: 1920, quadrado: false, qualidade: 0.8, fundo: '#0a0a0a' },
  categoria: { lado: 400,  quadrado: true, qualidade: 0.8 },
  avatar:    { lado: 256,  quadrado: true, qualidade: 0.8 },
};

window.otimizarImagem = otimizarImagem;
window.extensaoImagem = extensaoImagem;
window.PRESET_IMAGEM = PRESET_IMAGEM;

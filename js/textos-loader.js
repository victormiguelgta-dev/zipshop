/**
 * textos-loader.js
 *
 * Aplica nos elementos da página os textos/emojis que o admin edita
 * no painel (admin/textos.html -> tabela "textos_site" no Supabase).
 *
 * COMO MARCAR UM TEXTO NO HTML:
 *
 *   <h2 data-texto="home_titulo_ofertas">⚡ Ofertas do Dia</h2>
 *
 * O texto que já está escrito no HTML é o valor de fallback: aparece
 * na hora, sem esperar o banco, e continua aparecendo se o Supabase
 * cair. Quando o Supabase responde, é trocado pelo valor salvo.
 *
 * PARA ESCREVER NUM ATRIBUTO EM VEZ DO CONTEÚDO:
 *
 *   <input placeholder="Buscar..." data-texto="navbar_busca_placeholder"
 *          data-texto-attr="placeholder">
 *
 * PARA UM BLOCO COM FORMATAÇÃO (títulos, negrito, listas, links):
 *
 *   <div data-texto="termos_conteudo" data-texto-html> ...HTML padrão... </div>
 *
 * O valor salvo é HTML e SEMPRE passa pelo DOMPurify antes de entrar
 * na página: qualquer <script>, onclick="..." ou javascript: é removido.
 *
 * PARA MOSTRAR A DATA DA ÚLTIMA EDIÇÃO DE UMA CHAVE:
 *
 *   <p data-texto-data="termos_conteudo" data-texto-prefixo="Última atualização: ">...</p>
 *
 * Usado hoje em: index.html (seção "home"), termos.html e na
 * navbar/footer, que são geradas pelo js/main.js e valem para o site inteiro.
 */

import { supabase } from './supabase-config.js';

// Cache do mapa de textos. A navbar, o footer e o corpo da página são
// aplicados em momentos diferentes, então sem cache seriam 3 consultas
// ao Supabase por página. A tabela é pequena, então buscamos tudo de
// uma vez e reaproveitamos.
let cacheTextos = null;
let cacheDatas = {};
let buscaEmAndamento = null;

async function carregarTextos() {
  if (cacheTextos) return cacheTextos;
  if (buscaEmAndamento) return buscaEmAndamento;

  buscaEmAndamento = (async () => {
    const { data, error } = await supabase
      .from('textos_site')
      .select('chave, valor, atualizado_em');

    // Se der erro, guarda um mapa vazio: cada elemento mantém o texto
    // padrão que já está no HTML.
    cacheTextos = (error || !data)
      ? {}
      : Object.fromEntries(data.map(t => [t.chave, t.valor]));
    cacheDatas = (error || !data)
      ? {}
      : Object.fromEntries(data.map(t => [t.chave, t.atualizado_em]));

    buscaEmAndamento = null;
    return cacheTextos;
  })();

  return buscaEmAndamento;
}

// DOMPurify só é baixado se a página tiver algum bloco HTML editável
let purifyPromise = null;
function carregarPurify() {
  if (!purifyPromise) {
    purifyPromise = import('https://cdn.jsdelivr.net/npm/dompurify@3.2.4/+esm')
      .then(m => {
        const DOMPurify = m.default;
        // Links que abrem em outra aba ganham rel="noopener" (segurança)
        DOMPurify.addHook('afterSanitizeAttributes', node => {
          if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
            node.setAttribute('rel', 'noopener noreferrer');
          }
        });
        return DOMPurify;
      });
  }
  return purifyPromise;
}

// Só as tags de texto que o editor do admin gera — nada de imagem,
// iframe, formulário, style ou script.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['h2', 'h3', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target'],
};

async function aplicarHtml(el, valor) {
  try {
    const DOMPurify = await carregarPurify();
    el.innerHTML = DOMPurify.sanitize(valor, PURIFY_CONFIG);
  } catch (e) {
    // Sem DOMPurify não arrisca: mantém o conteúdo padrão do HTML
  }
}

function aplicarData(el) {
  const iso = cacheDatas[el.getAttribute('data-texto-data')];
  if (!iso) return; // chave não cadastrada: mantém a data escrita no HTML
  const data = new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  el.textContent = (el.getAttribute('data-texto-prefixo') || '') + data;
}

function aplicarEm(el, mapa) {
  const chave = el.getAttribute('data-texto');
  const valor = mapa[chave];
  if (valor === undefined || valor === '') return; // mantém o fallback do HTML

  const atributo = el.getAttribute('data-texto-attr');
  if (el.hasAttribute('data-texto-html')) {
    aplicarHtml(el, valor);
  } else if (atributo) {
    el.setAttribute(atributo, valor);
  } else {
    el.textContent = valor;
  }
}

/**
 * Aplica os textos dentro de "raiz".
 *
 * Sem argumento, varre a página inteira. Passando um elemento, varre só
 * ele — é assim que o main.js aplica na navbar logo depois de injetá-la,
 * e de novo quando ela é recriada no login.
 */
export async function aplicarTextosSite(raiz = document) {
  const elementos = [...raiz.querySelectorAll('[data-texto]')];

  // Se a própria raiz for um elemento marcado, ela não entra no
  // querySelectorAll — então incluímos na mão.
  if (raiz.nodeType === 1 && raiz.hasAttribute?.('data-texto')) {
    elementos.push(raiz);
  }

  const datas = [...raiz.querySelectorAll('[data-texto-data]')];

  if (elementos.length === 0 && datas.length === 0) return;

  const mapa = await carregarTextos();
  elementos.forEach(el => aplicarEm(el, mapa));
  datas.forEach(aplicarData);
}

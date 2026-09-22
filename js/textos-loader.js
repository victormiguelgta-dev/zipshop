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
 * Usado hoje em: index.html (seção "home") e na navbar/footer, que são
 * geradas pelo js/main.js e valem para o site inteiro.
 */

import { supabase } from './supabase-config.js';

// Cache do mapa de textos. A navbar, o footer e o corpo da página são
// aplicados em momentos diferentes, então sem cache seriam 3 consultas
// ao Supabase por página. A tabela é pequena, então buscamos tudo de
// uma vez e reaproveitamos.
let cacheTextos = null;
let buscaEmAndamento = null;

async function carregarTextos() {
  if (cacheTextos) return cacheTextos;
  if (buscaEmAndamento) return buscaEmAndamento;

  buscaEmAndamento = (async () => {
    const { data, error } = await supabase
      .from('textos_site')
      .select('chave, valor');

    // Se der erro, guarda um mapa vazio: cada elemento mantém o texto
    // padrão que já está no HTML.
    cacheTextos = (error || !data)
      ? {}
      : Object.fromEntries(data.map(t => [t.chave, t.valor]));

    buscaEmAndamento = null;
    return cacheTextos;
  })();

  return buscaEmAndamento;
}

function aplicarEm(el, mapa) {
  const chave = el.getAttribute('data-texto');
  const valor = mapa[chave];
  if (valor === undefined || valor === '') return; // mantém o fallback do HTML

  const atributo = el.getAttribute('data-texto-attr');
  if (atributo) {
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

  if (elementos.length === 0) return;

  const mapa = await carregarTextos();
  elementos.forEach(el => aplicarEm(el, mapa));
}

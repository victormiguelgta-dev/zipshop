/**
 * textos-loader.js
 *
 * Este arquivo AINDA NÃO é usado em nenhuma página do site.
 * Ele só entra em ação quando for importado + quando os elementos do
 * HTML tiverem o atributo data-texto="chave_do_texto".
 *
 * Ou seja: colocar esse arquivo na pasta /js não muda nada visualmente
 * no site. Ele só passa a funcionar depois que eu (Claude) marcar,
 * com sua autorização, os textos correspondentes no index.html,
 * navbar, footer etc.
 *
 * COMO FUNCIONARIA (exemplo, ainda não aplicado):
 *   <h2 data-texto="home_titulo_ofertas">⚡ Ofertas do Dia</h2>
 *
 * O texto "⚡ Ofertas do Dia" already escrito no HTML funciona como
 * valor de fallback (aparece imediatamente, sem esperar carregar o
 * banco, e continua funcionando mesmo se o Supabase cair).
 * Quando o Supabase responde, ele troca pelo valor salvo no painel admin.
 */

import { supabase } from './supabase-config.js';

export async function aplicarTextosSite() {
  const elementos = document.querySelectorAll('[data-texto]');
  if (elementos.length === 0) return; // nada marcado nesta página, não faz nada

  const chaves = [...new Set([...elementos].map(el => el.getAttribute('data-texto')))];

  const { data, error } = await supabase
    .from('textos_site')
    .select('chave, valor')
    .in('chave', chaves);

  if (error || !data) return; // se der erro, mantém o texto padrão que já está no HTML

  const mapa = Object.fromEntries(data.map(t => [t.chave, t.valor]));

  elementos.forEach(el => {
    const chave = el.getAttribute('data-texto');
    if (mapa[chave] !== undefined && mapa[chave] !== '') {
      el.textContent = mapa[chave];
    }
  });
}

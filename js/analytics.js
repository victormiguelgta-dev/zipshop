// js/analytics.js
// Registra eventos de uso do site (visualizações, carrinho, compras,
// buscas) pra alimentar o painel de Analytics do admin. Nunca trava
// a experiência do usuário — se falhar, só não registra, e pronto.
import { supabase } from './supabase-config.js';

function getSessaoId() {
  let id = sessionStorage.getItem('zipshop_sessao_id');
  if (!id) {
    id = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('zipshop_sessao_id', id);
  }
  return id;
}

export async function registrarEvento(tipo, { produtoId = null, termoBusca = null, meta = null } = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('eventos_analytics').insert({
      tipo,
      produto_id: produtoId,
      usuario_id: session?.user?.id || null,
      sessao_id: getSessaoId(),
      termo_busca: termoBusca,
      meta
    });
  } catch (e) { /* silencioso — analytics nunca deve quebrar o site */ }
}

// js/favoritos.js
// Funções compartilhadas de "Lista de Desejos" — usadas na vitrine,
// na página do produto e em "Meus Favoritos".
import { supabase } from './supabase-config.js';

let _cacheFavoritos = null; // Set de produto_id, carregado uma vez por página

export async function getFavoritosIds() {
  if (_cacheFavoritos) return _cacheFavoritos;
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;
  if (!user) { _cacheFavoritos = new Set(); return _cacheFavoritos; }
  const { data } = await supabase.from('favoritos').select('produto_id').eq('usuario_id', user.id);
  _cacheFavoritos = new Set((data || []).map(f => f.produto_id));
  return _cacheFavoritos;
}

export async function toggleFavorito(produtoId) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;
  if (!user) return { ok: false, precisaLogin: true };

  const favoritos = await getFavoritosIds();
  const jaFavoritado = favoritos.has(produtoId);

  if (jaFavoritado) {
    await supabase.from('favoritos').delete().eq('usuario_id', user.id).eq('produto_id', produtoId);
    favoritos.delete(produtoId);
    return { ok: true, favoritado: false };
  } else {
    await supabase.from('favoritos').insert({ usuario_id: user.id, produto_id: produtoId });
    favoritos.add(produtoId);
    return { ok: true, favoritado: true };
  }
}

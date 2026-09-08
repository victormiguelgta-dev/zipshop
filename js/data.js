// =====================================================
// data.js — produtos vindo do Supabase
// =====================================================
import { supabase } from './supabase-config.js';

// Cache local para não buscar toda hora
let PRODUCTS = [];
let CATEGORIES = [];

// Busca produtos do Supabase
async function loadProducts() {
  if (PRODUCTS.length > 0) return PRODUCTS; // já carregou

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('id');

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    return [];
  }

  // Mapeia para o formato que o site já usa.
  // CORREÇÃO: antes só uma lista fixa de campos passava adiante, então
  // cores, garantia, relacionados_ids e outros campos configurados no
  // admin nunca chegavam até a página do produto. Agora mantém tudo
  // (...p) e só sobrescreve os campos que precisam de conversão.
  PRODUCTS = data.map(p => ({
    ...p,
    price: parseFloat(p.price),
    oldPrice: p.old_price ? parseFloat(p.old_price) : null,
    discount: p.discount || 0,
    rating: p.rating || 5,
    reviews: p.reviews || 0,
    emoji: p.emoji || '📦',
    icon: p.emoji || '📦',
    image_url: p.image_url || null,
    desc: p.description || '',
    specs: p.specs || {}
  }));

  // Monta categorias únicas
  CATEGORIES = [...new Set(PRODUCTS.map(p => p.category))]
    .map(name => ({
      name,
      icon: PRODUCTS.find(p => p.category === name)?.emoji || '📦'
    }));

  return PRODUCTS;
}

// Busca um produto pelo ID — sempre do Supabase para ter dados atualizados
async function getProduct(id) {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  // CORREÇÃO: mesmo problema do loadProducts — mantém todos os campos
  // (...data) em vez de uma lista fixa, senão cores/garantia/relacionados
  // ficam sempre undefined nessa página.
  return {
    ...data,
    price: parseFloat(data.price),
    oldPrice: data.old_price ? parseFloat(data.old_price) : null,
    discount: data.discount || 0,
    rating: data.rating || 5,
    reviews: data.reviews || 0,
    emoji: data.emoji || '📦',
    icon: data.emoji || '📦',
    image_url: data.image_url || null,
    desc: data.description || '',
    specs: data.specs || {}
  };
}

function formatPrice(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function starsHTML(rating, max = 5) {
  let s = '';
  for (let i = 1; i <= max; i++) s += i <= rating ? '★' : '☆';
  return s;
}

// Busca os sinônimos de categoria (ex: "celular" -> "Smartphones"),
// pra busca entender termos que não estão escritos literalmente nos
// produtos. Se a tabela ainda não existir no Supabase, retorna vazio
// em vez de quebrar a página.
let SINONIMOS = null;
async function loadSinonimos() {
  if (SINONIMOS) return SINONIMOS;
  try {
    const { data, error } = await supabase.from('categoria_sinonimos').select('termo, categoria');
    SINONIMOS = error ? [] : (data || []);
  } catch (e) {
    SINONIMOS = [];
  }
  return SINONIMOS;
}

export { loadProducts, getProduct, formatPrice, starsHTML, loadSinonimos, PRODUCTS, CATEGORIES };

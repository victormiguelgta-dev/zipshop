// =====================================================
// data.js — produtos vindo do Supabase
// =====================================================
import { supabase } from './supabase-config.js';

// Cache local para não buscar toda hora
let PRODUCTS = [];
let CATEGORIES = [];

// Variações/kits (produtos.variacoes): cada uma com preço e estoque próprios.
// preco vazio = preço do produto; estoque vazio = sem controle.
function variacoesDe(p) {
  return (Array.isArray(p?.variacoes) ? p.variacoes : []).filter(v => v && v.id && v.nome);
}
function precoVariacao(p, v) {
  const n = parseFloat(v?.preco);
  return isNaN(n) || n <= 0 ? parseFloat(p.precoBase ?? p.price) : n;
}
function variacaoDisponivel(v) {
  return v.estoque === null || v.estoque === undefined || v.estoque === '' || Number(v.estoque) > 0;
}
// Com variações, o card mostra o menor preço ("a partir de")
function comPrecoDasVariacoes(p) {
  const vars = variacoesDe(p);
  if (!vars.length) return p;
  const precos = vars.map(v => precoVariacao(p, v));
  return { ...p, precoBase: p.price, price: Math.min(...precos), temVariacoes: true };
}

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
  PRODUCTS = data.map(p => comPrecoDasVariacoes({
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
  return comPrecoDasVariacoes({
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
  });
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

// Produto esgotado: só quando o estoque é controlado (stock preenchido) e chegou a 0.
// Mesma regra usada em produto.html. stock vazio = sem controle de estoque.
// Com variações: esgotado só quando nenhuma variação tem estoque.
function estaEsgotado(p) {
  const vars = variacoesDe(p);
  if (vars.length) return !vars.some(variacaoDisponivel);
  return p.stock !== null && p.stock !== undefined && p.stock <= 0;
}

// Coloca os esgotados no fim da lista, mantendo a ordem dos demais
function esgotadosNoFim(lista) {
  return [...lista].sort((a, b) => estaEsgotado(a) - estaEsgotado(b));
}

export { variacoesDe, precoVariacao, variacaoDisponivel, loadProducts, getProduct, formatPrice, starsHTML, loadSinonimos, estaEsgotado, esgotadosNoFim, PRODUCTS, CATEGORIES };

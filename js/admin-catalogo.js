// Categorias e marcas do painel, num lugar só (admin/produtos.html e
// admin/importar.html).
//
// Antes a lista de categorias era fixa no HTML (Smartphones, Notebooks...)
// e não acompanhava o que era criado em Painel → Categorias. E a marca era
// texto livre: "ZipShop", "ZipShop " e " zipshop" viravam marcas diferentes.

// Preenche um <select> com as categorias do painel. Se o produto estiver
// numa categoria que não existe mais, ela aparece marcada como "(antiga)"
// pra não sumir sem querer ao salvar.
export async function preencherCategorias(supabase, select, atual = '') {
  const { data } = await supabase.from('categorias').select('name, ativo').order('name');
  const cats = (data || []).filter(c => c.name);
  const esc = (t) => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  let html = '<option value="">Escolha a categoria</option>' +
    cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}${c.ativo === false ? ' (desativada)' : ''}</option>`).join('');
  if (atual && !cats.some(c => c.name === atual)) {
    html += `<option value="${esc(atual)}">${esc(atual)} (antiga — troque)</option>`;
  }
  select.innerHTML = html;
  select.value = atual || '';
  return cats.map(c => c.name);
}

// Marcas já usadas, sem repetir (ignora espaços e maiúsculas)
export async function carregarMarcas(supabase) {
  const { data } = await supabase.from('produtos').select('brand');
  const porChave = new Map();
  (data || []).forEach(p => {
    const m = limparMarca(p.brand);
    if (m && !porChave.has(m.toLowerCase())) porChave.set(m.toLowerCase(), m);
  });
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Liga um <datalist> de sugestões ao campo de marca
export function sugerirMarcas(input, marcas) {
  let lista = document.getElementById(input.id + '-lista');
  if (!lista) {
    lista = document.createElement('datalist');
    lista.id = input.id + '-lista';
    input.after(lista);
    input.setAttribute('list', lista.id);
    input.setAttribute('autocomplete', 'off');
  }
  lista.innerHTML = '';
  marcas.forEach(m => { const o = document.createElement('option'); o.value = m; lista.appendChild(o); });
}

function limparMarca(m) {
  return String(m || '').replace(/\s+/g, ' ').trim();
}

// "zipshop " → "ZipShop" se já existir assim; senão só tira os espaços sobrando
export function normalizarMarca(digitada, marcas) {
  const m = limparMarca(digitada);
  if (!m) return '';
  return marcas.find(x => x.toLowerCase() === m.toLowerCase()) || m;
}

/**
 * analisar-produto.js
 *
 * Cadastro de produto de ESTOQUE PRÓPRIO com ajuda da IA.
 * Recebe um texto sobre o produto (copiado do site do fabricante ou
 * fornecedor, de um catálogo, da caixa, ou escrito pelo próprio admin)
 * e devolve os dados organizados (nome, marca, categoria, descrição...).
 *
 * A chave do Gemini fica só aqui no servidor (variável de ambiente
 * GEMINI_API_KEY no Netlify) — nunca vai pro navegador.
 *
 * Só o admin usa essa função, a partir da tela admin/importar.html
 * ("Cadastrar com IA").
 */

const https = require('https');

function adminEmails() {
  return (process.env.ADMIN_EMAILS || 'admin@zipshop.com,victormiguelgta@gmail.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
function getUser(token) {
  return new Promise((resolve) => {
    if (!token) return resolve(null);
    const url = new URL(`${process.env.SUPABASE_URL}/auth/v1/user`);
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'GET',
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` } }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { const u = JSON.parse(b); resolve(u && u.id ? u : null); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

const CATEGORIAS_VALIDAS = [
  'Smartphones', 'Notebooks', 'Headphones', 'Smart TVs', 'Games', 'Acessorios'
];

function chamarGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,        // baixo = mais previsível, menos "criativo"
        responseMimeType: 'application/json'
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Resposta inválida da API do Gemini'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Method Not Allowed' }) };
  }

  // Só admin usa a importação por IA (evita queimar a cota do Gemini)
  const _h = event.headers || {};
  const _token = (_h.authorization || _h.Authorization || '').replace(/^Bearer /i, '');
  const _user = await getUser(_token);
  if (!_user || !adminEmails().includes(String(_user.email || '').toLowerCase())) {
    return { statusCode: 403, body: JSON.stringify({ erro: 'Acesso restrito ao admin.' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'GEMINI_API_KEY não configurada no Netlify. Veja o passo a passo de configuração.' })
    };
  }

  try {
    const { texto } = JSON.parse(event.body || '{}');

    if (!texto || texto.trim().length < 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({ erro: 'Cole ou escreva as informações do produto (parece muito curto ou vazio).' })
      };
    }

    // Corta textos gigantes — página inteira copiada pode vir com
    // menu, rodapé, comentários e tudo mais. O começo costuma ter
    // o que interessa, e isso segura o custo/tempo da chamada.
    const textoLimitado = texto.slice(0, 12000);

    const prompt = `Você recebe um texto sobre UM produto que uma loja de eletrônicos brasileira vai cadastrar no próprio estoque. O texto pode ter sido copiado de um site (fabricante, fornecedor, marketplace), de um catálogo, da caixa do produto, ou escrito à mão pelo dono da loja. Pode vir bagunçado, com menus, avaliações e outras informações misturadas.

Extraia APENAS as informações do produto principal e devolva um JSON com exatamente estas chaves:

{
  "name": "nome do produto, limpo e sem emojis de propaganda, no máximo 80 caracteres",
  "brand": "marca do produto, ou string vazia se não identificar",
  "category": "uma destas opções exatas: ${CATEGORIAS_VALIDAS.join(' | ')}",
  "custo": número decimal do preço que aparece no texto, sem R$ e sem separador de milhar (ex: 1299.90). Se houver faixa de preço, use o MENOR valor. Se não houver preço no texto, use 0,
  "description": "descrição do produto em português, clara e vendedora, 2 a 4 frases. Reescreva com suas palavras, não copie literalmente",
  "emoji": "um único emoji que represente o produto",
  "cores": ["lista de variações de cor mencionadas, ou lista vazia"]
}

Regras:
- Responda SOMENTE o JSON, sem markdown, sem crases, sem explicação
- Se um campo não for identificável, use string vazia, 0 ou lista vazia conforme o tipo
- A categoria DEVE ser uma das opções listadas. Escolha a mais próxima
- Não invente especificações que não estejam no texto
- Não mencione nomes de lojas ou marketplaces (Shopee, Mercado Livre, Amazon etc.) no nome nem na descrição

TEXTO SOBRE O PRODUTO:
${textoLimitado}`;

    const resposta = await chamarGemini(prompt, apiKey);

    if (resposta.error) {
      return {
        statusCode: 502,
        body: JSON.stringify({ erro: 'A IA nao conseguiu processar agora. Tente de novo.' })
      };
    }

    const textoResposta = resposta?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) {
      return {
        statusCode: 502,
        body: JSON.stringify({ erro: 'Gemini não retornou conteúdo. Tente colar o texto novamente.' })
      };
    }

    // Limpa possíveis crases de markdown que o modelo às vezes coloca
    const limpo = textoResposta.replace(/```json/gi, '').replace(/```/g, '').trim();

    let dados;
    try {
      dados = JSON.parse(limpo);
    } catch (e) {
      return {
        statusCode: 502,
        body: JSON.stringify({ erro: 'Não consegui interpretar a resposta da IA. Tente de novo ou preencha manualmente.' })
      };
    }

    // Garante que a categoria é uma das válidas
    if (!CATEGORIAS_VALIDAS.includes(dados.category)) {
      dados.category = 'Acessorios';
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': 'https://zipshop01.netlify.app' },
      body: JSON.stringify({
        name: String(dados.name || '').slice(0, 120),
        brand: String(dados.brand || ''),
        category: dados.category,
        custo: parseFloat(dados.custo) || 0,
        description: String(dados.description || ''),
        emoji: String(dados.emoji || '📦').slice(0, 4),
        cores: Array.isArray(dados.cores) ? dados.cores.slice(0, 12) : []
      })
    };

  } catch (err) {
    console.error('Erro ao analisar produto:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'Erro interno ao analisar o produto. Tente novamente.' })
    };
  }
};

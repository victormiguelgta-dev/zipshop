// Limpa espaços, quebras de linha e aspas coladas sem querer nas variáveis
// do Netlify (uma chave com quebra de linha derruba a função: "Invalid character in header")
['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'RESEND_API_KEY',
 'GEMINI_API_KEY', 'INTERNAL_SECRET', 'SITE_URL', 'ADMIN_EMAILS'].forEach(k => {
  if (process.env[k]) process.env[k] = process.env[k].replace(/[\s"'\u200B-\u200D\uFEFF]+/g, '');
});

// Endereço da loja: configurado no Netlify (SITE_URL); troque lá ao mudar de domínio
const SITE_URL = process.env.SITE_URL || 'https://zipshop.netlify.app';

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

// As categorias vêm do painel (o navegador manda a lista da tabela
// categorias). Limpa tudo antes de colocar no prompt.
function categoriasDoPedido(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map(c => String(c || '').replace(/[\r\n"|`]/g, ' ').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 40);
}

// Modelo principal e reservas: se um estiver sobrecarregado (503), no limite
// (429), fora do ar (500) ou não existir mais (404), tenta o próximo
const MODELOS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
const TENTAR_OUTRO = [404, 429, 500, 503];

// O Netlify corta a função em ~10s: paramos antes pra devolver uma
// mensagem clara em vez de uma página de erro que o painel não lê
// Prazo total (contado desde o início da função), não por chamada:
// assim as tentativas extras nunca passam do limite do Netlify
const LIMITE_MS = 9000;

async function chamarGeminiComReserva(prompt, apiKey, prazoFinal) {
  let resposta;
  for (const modelo of MODELOS) {
    resposta = await chamarGemini(prompt, apiKey, modelo, true, prazoFinal);
    // Modelo que não aceita o ajuste de "pensamento": tenta sem ele
    if (resposta.error && resposta.error.code === 400 && /thinking/i.test(resposta.error.message || '')) {
      resposta = await chamarGemini(prompt, apiKey, modelo, false, prazoFinal);
    }
    if (!(resposta.error && TENTAR_OUTRO.includes(resposta.error.code))) break;
    console.warn(`Gemini ${modelo} respondeu ${resposta.error.code}; tentando o próximo modelo`);
  }
  return resposta;
}

function chamarGemini(prompt, apiKey, modelo, pensarPouco, prazoFinal) {
  return new Promise((resolve) => {
    const restante = prazoFinal - Date.now();
    if (restante < 1500) {
      return resolve({ error: { code: 'tempo', message: 'A IA demorou demais para responder.' } });
    }
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,        // baixo = mais previsível, menos "criativo"
        responseMimeType: 'application/json',
        ...(pensarPouco ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) // pensa pouco = responde rápido
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelo}:generateContent`,
      method: 'POST',
      headers: {
        // Chave no cabeçalho: funciona com as chaves antigas (AIza...) e as
        // novas do Google (AQ....), que podem ser recusadas no endereço (?key=)
        'x-goog-api-key': apiKey,
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
          resolve({ error: { code: res.statusCode, message: 'Resposta inválida da API do Gemini: ' + data.slice(0, 120) } });
        }
      });
    });
    const relogio = setTimeout(() => {
      req.destroy();
      resolve({ error: { code: 'tempo', message: 'A IA demorou demais para responder.' } });
    }, restante);
    req.on('close', () => clearTimeout(relogio));
    req.on('error', (e) => resolve({ error: { code: 'rede', message: e.message } }));
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const prazoFinal = Date.now() + LIMITE_MS;
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Method Not Allowed' }) };
  }

  // Chave com caractere que não pode (ex.: "…" de uma chave copiada cortada)
  // derruba a função sem explicação — avisa qual variável corrigir
  for (const nome of ['SUPABASE_SERVICE_KEY', 'GEMINI_API_KEY']) {
    if (/[^\x21-\x7e]/.test(process.env[nome] || '')) {
      return { statusCode: 500, body: JSON.stringify({ erro: `A variável ${nome} no Netlify tem um caractere inválido (ex.: "…" ou acento). Copie a chave de novo pelo botão de copiar e cole no Netlify.` }) };
    }
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
    const { texto, categorias } = JSON.parse(event.body || '{}');
    const CATEGORIAS_VALIDAS = categoriasDoPedido(categorias);

    if (!texto || texto.trim().length < 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({ erro: 'Cole ou escreva as informações do produto (parece muito curto ou vazio).' })
      };
    }

    // Corta textos gigantes — página inteira copiada pode vir com
    // menu, rodapé, comentários e tudo mais. O começo costuma ter
    // o que interessa, e isso segura o custo/tempo da chamada.
    const textoLimitado = texto.slice(0, 8000); // menos texto = resposta mais rápida

    const prompt = `Você recebe um texto sobre UM produto que uma loja de eletrônicos brasileira vai cadastrar no próprio estoque. O texto pode ter sido copiado de um site (fabricante, fornecedor, marketplace), de um catálogo, da caixa do produto, ou escrito à mão pelo dono da loja. Pode vir bagunçado, com menus, avaliações e outras informações misturadas.

Extraia APENAS as informações do produto principal e devolva um JSON com exatamente estas chaves:

{
  "name": "nome do produto, limpo e sem emojis de propaganda, no máximo 80 caracteres",
  "brand": "marca do produto, ou string vazia se não identificar",
  "category": "${CATEGORIAS_VALIDAS.length ? 'uma destas opções exatas: ' + CATEGORIAS_VALIDAS.join(' | ') : 'string vazia'}",
  "custo": número decimal do preço que aparece no texto, sem R$ e sem separador de milhar (ex: 1299.90). Se houver faixa de preço, use o MENOR valor. Se não houver preço no texto, use 0,
  "description": "descrição do produto em português, clara e vendedora, 2 a 4 frases. Reescreva com suas palavras, não copie literalmente",
  "emoji": "um único emoji que represente o produto",
  "cores": ["lista de variações de cor mencionadas, ou lista vazia"],
  "especificacoes": [{ "nome": "nome curto da característica (ex: Bateria)", "valor": "valor (ex: 5000 mAh)" }]
}

Regras:
- Responda SOMENTE o JSON, sem markdown, sem crases, sem explicação
- Se um campo não for identificável, use string vazia, 0 ou lista vazia conforme o tipo
- A categoria DEVE ser uma das opções listadas. Escolha a mais próxima
- Não invente especificações que não estejam no texto
- Em "especificacoes", liste até 12 características técnicas que aparecem no texto (dimensões, peso, bateria, conexão, material, voltagem, capacidade...). Se não houver, use lista vazia
- Não mencione nomes de lojas ou marketplaces (Shopee, Mercado Livre, Amazon etc.) no nome nem na descrição

TEXTO SOBRE O PRODUTO:
${textoLimitado}`;

    const resposta = await chamarGeminiComReserva(prompt, apiKey, prazoFinal);

    if (resposta.error) {
      // Mostra o motivo real pro admin (chave inválida, limite de uso...)
      const e = resposta.error;
      console.error('Erro do Gemini:', JSON.stringify(e));
      const motivos = {
        400: 'pedido inválido ou chave do Gemini em formato não aceito',
        401: 'chave do Gemini inválida ou sem permissão',
        403: 'chave do Gemini sem permissão para a API Generative Language',
        404: 'modelo do Gemini não encontrado',
        429: 'limite de uso do Gemini atingido — aguarde e tente de novo',
        500: 'instabilidade no Gemini — tente de novo em instantes',
        503: 'Gemini sobrecarregado — tente de novo em instantes',
        tempo: 'a IA demorou demais — tente de novo ou cole um texto menor',
        rede: 'não consegui falar com o Gemini — tente de novo'
      };
      const motivo = motivos[e.code] || 'erro desconhecido';
      return {
        statusCode: 502,
        body: JSON.stringify({ erro: `A IA não conseguiu processar (${e.code || '?'}: ${motivo}). Detalhe: ${String(e.message || '').slice(0, 200)}` })
      };
    }

    // Junta os pedaços de texto da resposta (ignora os de "pensamento")
    const textoResposta = (resposta?.candidates?.[0]?.content?.parts || [])
      .filter(pt => pt && typeof pt.text === 'string' && !pt.thought)
      .map(pt => pt.text).join('');
    if (!textoResposta) {
      return {
        statusCode: 502,
        body: JSON.stringify({ erro: `Gemini não retornou conteúdo (${resposta?.candidates?.[0]?.finishReason || resposta?.promptFeedback?.blockReason || 'sem motivo'}). Tente colar o texto novamente.` })
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
      dados.category = '';
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': SITE_URL },
      body: JSON.stringify({
        name: String(dados.name || '').slice(0, 120),
        brand: String(dados.brand || ''),
        category: dados.category,
        custo: parseFloat(dados.custo) || 0,
        description: String(dados.description || ''),
        emoji: String(dados.emoji || '📦').slice(0, 4),
        cores: Array.isArray(dados.cores) ? dados.cores.slice(0, 12) : [],
        especificacoes: (Array.isArray(dados.especificacoes) ? dados.especificacoes : [])
          .filter(e => e && e.nome)
          .slice(0, 15)
          .map(e => ({ nome: String(e.nome).slice(0, 60), valor: String(e.valor || '').slice(0, 200) }))
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

const https = require('https');

// Busca produto real no Supabase pelo ID (preço confiável, não vem do navegador)
function buscarProduto(produtoId) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const url = new URL(`${supabaseUrl}/rest/v1/produtos?id=eq.${produtoId}&select=id,name,price`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const arr = JSON.parse(body);
          resolve(arr[0] || null);
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Busca o pedido salvo no Supabase (para pegar quantidade e frete confiáveis)
function buscarPedido(pedidoId) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const url = new URL(`${supabaseUrl}/rest/v1/pedidos?id=eq.${pedidoId}&select=*`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const arr = JSON.parse(body);
          resolve(arr[0] || null);
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Confere o token de login e devolve o usuário (ou null)
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pedidoId, email } = JSON.parse(event.body);
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const SITE_URL = 'https://zipshop01.netlify.app';

    if (!pedidoId) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'pedidoId é obrigatório' }) };
    }

    // Valida o formato antes de usar em qualquer consulta — evita
    // injetar valores estranhos no filtro da API do banco.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pedidoId)) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'pedidoId inválido' }) };
    }

    // 1. Busca o pedido REAL salvo no banco (não confia no navegador)
    const pedido = await buscarPedido(pedidoId);
    if (!pedido) {
      return { statusCode: 404, body: JSON.stringify({ erro: 'Pedido não encontrado' }) };
    }

    // 1b. Só cria pagamento para pedido ainda pendente (não recobra pago/cancelado)
    if (pedido.status && pedido.status !== 'pendente') {
      return { statusCode: 409, body: JSON.stringify({ erro: 'Este pedido não está mais aguardando pagamento.' }) };
    }

    // 1c. Se o pedido tem dono, confirma pelo token que quem paga é o dono
    const donoId = pedido.usuario_id;
    if (donoId && donoId !== 'anonimo') {
      const _token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer /i, '');
      const _user = await getUser(_token);
      if (!_user || _user.id !== donoId) {
        return { statusCode: 403, body: JSON.stringify({ erro: 'Você não tem permissão para pagar este pedido.' }) };
      }
    }

    // 2. Para cada item do pedido, busca o PREÇO REAL e ATUAL do produto no banco
    // Desconto de 5% no PIX é aplicado aqui também (sobre produtos, nunca sobre o frete)
    const descontoPix = pedido.pagamento === 'pix' ? 0.95 : 1;
    const itensValidados = [];
    for (const item of (pedido.itens || [])) {
      const qtd = parseInt(item.quantidade || 1);
      if (!(qtd > 0)) continue; // ignora quantidade zero/negativa
      const produtoReal = await buscarProduto(item.produto_id);
      if (!produtoReal) continue; // ignora produtos que não existem mais

      itensValidados.push({
        title: produtoReal.name,
        quantity: qtd,
        unit_price: parseFloat((produtoReal.price * descontoPix).toFixed(2)), // PREÇO REAL DO BANCO, com desconto PIX se aplicável
        currency_id: 'BRL'
      });
    }

    if (itensValidados.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'Nenhum produto válido no pedido' }) };
    }

    // 3. Frete também vem do pedido salvo no banco, não do navegador
    const freteReal = parseFloat(pedido.frete || 0);
    if (freteReal > 0) {
      itensValidados.push({
        title: 'Frete - Entrega',
        quantity: 1,
        unit_price: freteReal,
        currency_id: 'BRL'
      });
    }

    // 4. CORREÇÃO: cupom e saldo (cashback/indicação) aplicados no
    // checkout precisam ser descontados aqui também, senão o cliente
    // via preço reduzido na tela mas era cobrado o valor cheio no
    // Mercado Pago. Os valores vêm do pedido salvo no banco (não do
    // navegador), então não dá pra forjar um desconto maior.
    const descontoTotal = parseFloat(pedido.cupom_desconto || 0) + parseFloat(pedido.saldo_usado || 0);
    if (descontoTotal > 0) {
      itensValidados.push({
        title: 'Desconto (cupom / saldo)',
        quantity: 1,
        unit_price: -Math.round(descontoTotal * 100) / 100,
        currency_id: 'BRL'
      });
    }

    const preference = {
      items: itensValidados,
      payer: {
        email: email || pedido.usuario_email || 'cliente@zipshop.com'
      },
      external_reference: pedidoId,
      back_urls: {
        success: `${SITE_URL}/checkout.html?status=aprovado&pedido=${pedidoId}`,
        failure: `${SITE_URL}/checkout.html?status=erro&pedido=${pedidoId}`,
        pending: `${SITE_URL}/checkout.html?status=pendente&pedido=${pedidoId}`
      },
      auto_return: 'approved',
      notification_url: `${SITE_URL}/.netlify/functions/webhook-mp`,
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
        installments: 12
      },
      statement_descriptor: 'ZIPSHOP'
    };

    const result = await new Promise((resolve, reject) => {
      const data = JSON.stringify(preference);
      const options = {
        hostname: 'api.mercadopago.com',
        path: '/checkout/preferences',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });

    if (result.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ erro: result.message || 'Erro ao criar pagamento' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': 'https://zipshop01.netlify.app' },
      body: JSON.stringify({
        url: result.init_point,
        preference_id: result.id
      })
    };

  } catch (err) {
    console.error('Erro:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'Erro interno ao processar pagamento. Tente novamente.' })
    };
  }
};

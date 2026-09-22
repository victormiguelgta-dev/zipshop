const https = require('https');
const crypto = require('crypto');

function buscarPagamento(paymentId, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mercadopago.com',
      path: `/v1/payments/${paymentId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function buscarPedido(pedidoId) {
  return new Promise((resolve) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const url = new URL(`${supabaseUrl}/rest/v1/pedidos?id=eq.${pedidoId}&select=*`);
    const options = {
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)[0]); } catch(e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Envia SÓ o id do pedido e um segredo interno. A função de e-mail
// busca o destinatário no banco — o navegador nunca escolhe pra quem vai.
function enviarEmailConfirmacao(siteUrl, pedidoId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ pedidoId });
    const url = new URL(`${siteUrl}/.netlify/functions/enviar-email-pedido`);
    const options = {
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'x-internal-secret': process.env.INTERNAL_SECRET || ''
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });
}

function atualizarPedido(pedidoId, status, pagamentoId) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const data = JSON.stringify({ status, pagamento_id: String(pagamentoId) });
    const url = new URL(`${supabaseUrl}/rest/v1/pedidos?id=eq.${pedidoId}`);
    const options = {
      hostname: url.hostname, path: url.pathname + url.search, method: 'PATCH',
      headers: {
        'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Confere a assinatura do Mercado Pago. Retorna true/false se o segredo
// estiver configurado, ou null se ainda não configuraram (não bloqueia).
function assinaturaValida(event, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return null;
  const h = event.headers || {};
  const sig = h['x-signature'] || h['X-Signature'] || '';
  const reqId = h['x-request-id'] || h['X-Request-Id'] || '';
  const parts = {};
  sig.split(',').forEach(p => { const i = p.indexOf('='); if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(parts.v1)); }
  catch (e) { return false; }
}

exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    let paymentId = params.get('id') || params.get('data.id');
    if (!paymentId && event.body) {
      try { const b = JSON.parse(event.body); paymentId = b?.data?.id || b?.id; } catch(e) {}
    }
    if (!paymentId) return { statusCode: 200, body: 'ok' };

    // 1. Valida a assinatura do Mercado Pago (se o segredo estiver setado)
    const assinatura = assinaturaValida(event, paymentId);
    if (assinatura === false) return { statusCode: 401, body: 'assinatura invalida' };
    if (assinatura === null) console.warn('MP_WEBHOOK_SECRET nao configurado — assinatura nao verificada');

    const pagamento = await buscarPagamento(paymentId, process.env.MP_ACCESS_TOKEN);
    if (!pagamento || !pagamento.external_reference) return { statusCode: 200, body: 'ok' };

    const statusMap = {
      'approved': 'pago', 'pending': 'pendente', 'in_process': 'pendente',
      'rejected': 'cancelado', 'cancelled': 'cancelado', 'refunded': 'cancelado'
    };
    const novoStatus = statusMap[pagamento.status] || 'pendente';
    const pedidoId = pagamento.external_reference;

    const pedido = await buscarPedido(pedidoId);
    if (!pedido) return { statusCode: 200, body: 'ok' };

    // 2. Idempotência: se já está pago, não reprocessa (nada de e-mail duplicado)
    if (pedido.status === 'pago') return { statusCode: 200, body: 'ok' };

    // 3. Confere se o valor pago bate com o total do pedido
    if (novoStatus === 'pago') {
      const pago = Number(pagamento.transaction_amount || 0);
      const total = Number(pedido.total || 0);
      if (Math.abs(pago - total) > 0.10) {
        console.warn('Valor pago diverge do total; deixando pendente para revisao');
        await atualizarPedido(pedidoId, 'pendente', paymentId);
        return { statusCode: 200, body: 'ok' };
      }
    }

    await atualizarPedido(pedidoId, novoStatus, paymentId);

    if (novoStatus === 'pago') {
      await enviarEmailConfirmacao('https://zipshop01.netlify.app', pedidoId);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('Erro no webhook');
    return { statusCode: 500, body: 'erro' };
  }
};

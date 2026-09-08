const https = require('https');

async function buscarPagamento(paymentId, accessToken) {
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
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function buscarPedido(pedidoId) {
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
        try { resolve(JSON.parse(body)[0]); } catch(e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function enviarEmailConfirmacao(siteUrl, pedido) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ pedido });
    const url = new URL(`${siteUrl}/.netlify/functions/enviar-email-pedido`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
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

async function atualizarPedido(pedidoId, status, pagamentoId) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const data = JSON.stringify({ status, pagamento_id: String(pagamentoId) });
    const url = new URL(`${supabaseUrl}/rest/v1/pedidos?id=eq.${pedidoId}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
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

exports.handler = async (event) => {
  console.log('Webhook recebido:', event.body);

  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const topic = params.get('topic') || params.get('type');
    const id = params.get('id') || params.get('data.id');

    let paymentId = id;

    // Tenta pegar do body também
    if (!paymentId && event.body) {
      try {
        const body = JSON.parse(event.body);
        paymentId = body?.data?.id || body?.id;
      } catch(e) {}
    }

    if (!paymentId) {
      return { statusCode: 200, body: 'ok' };
    }

    // Busca detalhes do pagamento
    const pagamento = await buscarPagamento(paymentId, process.env.MP_ACCESS_TOKEN);
    console.log('Pagamento:', pagamento.status, 'Pedido:', pagamento.external_reference);

    if (!pagamento.external_reference) {
      return { statusCode: 200, body: 'ok' };
    }

    // Mapeia status do MP para status do Supabase
    const statusMap = {
      'approved': 'pago',
      'pending': 'pendente',
      'in_process': 'pendente',
      'rejected': 'cancelado',
      'cancelled': 'cancelado',
      'refunded': 'cancelado'
    };

    const novoStatus = statusMap[pagamento.status] || 'pendente';

    // Atualiza pedido no Supabase
    await atualizarPedido(pagamento.external_reference, novoStatus, paymentId);
    console.log(`Pedido ${pagamento.external_reference} atualizado para ${novoStatus}`);

    // Envia email de confirmação se o pagamento foi aprovado
    if (novoStatus === 'pago') {
      const pedidoCompleto = await buscarPedido(pagamento.external_reference);
      if (pedidoCompleto) {
        await enviarEmailConfirmacao('https://zipshop01.netlify.app', pedidoCompleto);
        console.log('Email de confirmação enviado para:', pedidoCompleto.usuario_email);
      }
    }

    return { statusCode: 200, body: 'ok' };

  } catch (err) {
    console.error('Erro no webhook:', err);
    return { statusCode: 500, body: 'erro: ' + err.message };
  }
};

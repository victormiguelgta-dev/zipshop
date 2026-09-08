const https = require('https');

function enviarEmail(destinatario, assunto, html) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      from: 'Zipshop <onboarding@resend.dev>',
      to: [destinatario],
      subject: assunto,
      html: html
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function gerarHTMLPedido(pedido) {
  const itens = (pedido.itens || []).map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.emoji || '📦')} ${esc(i.nome || i.name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${i.quantidade || i.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">R$ ${Number((i.preco||i.price||0) * (i.quantidade||i.qty||1)).toFixed(2).replace('.',',')}</td>
    </tr>`).join('');

  const end = pedido.endereco || {};

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:24px;font-weight:900;color:#AAEF00">ZIP</span><span style="font-size:24px;font-weight:900;color:#fff">SHOP</span>
    </div>
    <h1 style="font-size:20px;text-align:center;margin-bottom:8px">✅ Pedido Confirmado!</h1>
    <p style="text-align:center;color:#999;margin-bottom:24px">Pedido #${pedido.id.slice(0,8).toUpperCase()}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="border-bottom:2px solid #AAEF00">
          <th style="text-align:left;padding-bottom:8px;color:#AAEF00;font-size:13px">Produto</th>
          <th style="text-align:center;padding-bottom:8px;color:#AAEF00;font-size:13px">Qtd</th>
          <th style="text-align:right;padding-bottom:8px;color:#AAEF00;font-size:13px">Valor</th>
        </tr>
      </thead>
      <tbody style="color:#ccc;font-size:13px">${itens}</tbody>
    </table>

    <div style="background:#1a1a1a;border-radius:10px;padding:16px;margin-bottom:20px">
      <p style="margin:4px 0;font-size:13px">Subtotal: R$ ${Number(pedido.subtotal||0).toFixed(2).replace('.',',')}</p>
      <p style="margin:4px 0;font-size:13px">Frete: R$ ${Number(pedido.frete||0).toFixed(2).replace('.',',')}</p>
      <p style="margin:8px 0 0;font-size:18px;font-weight:900;color:#AAEF00">Total: R$ ${Number(pedido.total||0).toFixed(2).replace('.',',')}</p>
    </div>

    <div style="background:#1a1a1a;border-radius:10px;padding:16px;margin-bottom:20px">
      <p style="font-weight:700;margin-bottom:8px;font-size:13px">📍 Entrega</p>
      <p style="margin:4px 0;font-size:13px;color:#ccc">${esc(end.endereco || '')}, ${esc(end.bairro || '')}</p>
      <p style="margin:4px 0;font-size:13px;color:#ccc">${pedido.tipo_entrega === 'exclusiva' ? '⚡ Entrega Exclusiva — até 3h' : '🛵 Entrega por Rota — 24-48h'}</p>
      ${end.horario_preferido ? `<p style="margin:4px 0;font-size:13px;color:#ccc">🕐 Janela: ${esc(end.horario_preferido)}</p>` : ''}
    </div>

    <p style="text-align:center;color:#666;font-size:12px;margin-top:24px">Dúvidas? Fale conosco pelo WhatsApp.</p>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pedido } = JSON.parse(event.body);

    if (!pedido || !pedido.usuario_email) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'Dados do pedido incompletos' }) };
    }

    const html = gerarHTMLPedido(pedido);
    const resultado = await enviarEmail(
      pedido.usuario_email,
      `Pedido Confirmado #${pedido.id.slice(0,8).toUpperCase()} — Zipshop`,
      html
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ sucesso: true, resultado })
    };

  } catch (err) {
    console.error('Erro ao enviar email:', err);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Não foi possível enviar o e-mail de confirmação.' }) };
  }
};

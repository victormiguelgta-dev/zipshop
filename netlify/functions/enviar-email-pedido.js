const https = require('https');

const CORS = { 'Access-Control-Allow-Origin': 'https://zipshop01.netlify.app' };
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buscarPedido(pedidoId) {
  return new Promise((resolve) => {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/pedidos?id=eq.${pedidoId}&select=*`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)[0] || null); } catch(e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function enviarEmail(destinatario, assunto, html) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ from: 'Zipshop <onboarding@resend.dev>', to: [destinatario], subject: assunto, html });
    const options = {
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let body = ''; res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function gerarHTMLPedido(pedido) {
  const itens = (pedido.itens || []).map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.emoji || '📦')} ${esc(i.nome || i.name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${esc(i.quantidade || i.qty)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">R$ ${Number((i.preco||i.price||0) * (i.quantidade||i.qty||1)).toFixed(2).replace('.',',')}</td>
    </tr>`).join('');
  const end = pedido.endereco || {};
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:24px;font-weight:900;color:#AAEF00">ZIP</span><span style="font-size:24px;font-weight:900;color:#fff">SHOP</span>
    </div>
    <h1 style="font-size:20px;text-align:center;margin-bottom:8px">✅ Pedido Confirmado!</h1>
    <p style="text-align:center;color:#999;margin-bottom:24px">Pedido #${esc(String(pedido.id).slice(0,8).toUpperCase())}</p>
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const corpo = JSON.parse(event.body || '{}');
    const pedidoId = corpo.pedidoId || (corpo.pedido && corpo.pedido.id);
    if (!pedidoId || !uuidRegex.test(String(pedidoId))) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'pedidoId invalido' }) };
    }
    // O destinatário e os dados vêm SEMPRE do banco (pelo id), nunca do
    // corpo da requisição. Assim ninguém dispara e-mail da Zipshop para
    // um endereço arbitrário.
    const pedido = await buscarPedido(pedidoId);
    if (!pedido || !pedido.usuario_email) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ erro: 'Pedido nao encontrado' }) };
    }
    const html = gerarHTMLPedido(pedido);
    await enviarEmail(pedido.usuario_email, `Pedido Confirmado #${String(pedido.id).slice(0,8).toUpperCase()} — Zipshop`, html);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sucesso: true }) };
  } catch (err) {
    console.error('Erro ao enviar email');
    return { statusCode: 500, body: JSON.stringify({ erro: 'Nao foi possivel enviar o e-mail de confirmacao.' }) };
  }
};

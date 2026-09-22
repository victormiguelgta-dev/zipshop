// Envia e-mails de atualização de pedido (saiu para entrega, entregue)
// e de devolução. SÓ ADMIN pode disparar (verificação por token), e o
// destinatário é buscado no banco pelo id do pedido — nunca vem do corpo.
const https = require('https');

const CORS = { 'Access-Control-Allow-Origin': 'https://zipshop01.netlify.app' };

function adminEmails() {
  return (process.env.ADMIN_EMAILS || 'admin@zipshop.com,victormiguelgta@gmail.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function getUser(token) {
  return new Promise((resolve) => {
    if (!token) return resolve(null);
    const url = new URL(`${process.env.SUPABASE_URL}/auth/v1/user`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'GET',
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { const u = JSON.parse(b); resolve(u && u.id ? u : null); } catch(e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function buscarEmailPedido(pedidoId) {
  return new Promise((resolve) => {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/pedidos?id=eq.${pedidoId}&select=usuario_email`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { const r = JSON.parse(b)[0]; resolve(r ? r.usuario_email : null); } catch(e) { resolve(null); } });
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
    const req = https.request(options, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve({status:res.statusCode})); });
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

function baseTemplate(titulo, corpo) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:24px;font-weight:900;color:#AAEF00">ZIP</span><span style="font-size:24px;font-weight:900;color:#fff">SHOP</span>
    </div>
    <h1 style="font-size:20px;text-align:center;margin-bottom:16px">${titulo}</h1>
    ${corpo}
    <p style="text-align:center;color:#666;font-size:12px;margin-top:24px">Dúvidas? Fale conosco pelo WhatsApp.</p>
  </div>`;
}

const TEMPLATES_STATUS = {
  enviado: (pedido) => ({
    assunto: `🛵 Seu pedido saiu para entrega! #${String(pedido.id).slice(0,8).toUpperCase()}`,
    html: baseTemplate('🛵 Saiu para entrega!', `
      <p style="text-align:center;color:#ccc;margin-bottom:20px">Pedido #${String(pedido.id).slice(0,8).toUpperCase()} está a caminho.</p>
      ${pedido.codigo_confirmacao ? `
      <div style="background:#1a1a1a;border:1px solid #AAEF00;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px">
        <p style="font-size:11px;color:#999;text-transform:uppercase;margin-bottom:4px">Código de confirmação</p>
        <p style="font-size:24px;font-weight:900;color:#AAEF00;letter-spacing:2px">${esc(pedido.codigo_confirmacao)}</p>
        <p style="font-size:12px;color:#999;margin-top:4px">Informe esse código pro entregador na hora da entrega.</p>
      </div>` : ''}
    `)
  }),
  entregue: (pedido) => ({
    assunto: `✅ Pedido entregue! #${String(pedido.id).slice(0,8).toUpperCase()}`,
    html: baseTemplate('✅ Pedido entregue!', `
      <p style="text-align:center;color:#ccc;margin-bottom:16px">Esperamos que você aproveite sua compra! Se tiver qualquer problema, é só falar com a gente.</p>
    `)
  })
};

const TEMPLATES_DEVOLUCAO = {
  aprovado: () => ({
    assunto: `✅ Sua devolução foi aprovada`,
    html: baseTemplate('✅ Devolução aprovada', `<p style="text-align:center;color:#ccc">Sua solicitação de devolução foi aprovada. Em breve entraremos em contato com os próximos passos.</p>`)
  }),
  rejeitado: (d) => ({
    assunto: `Sobre sua solicitação de devolução`,
    html: baseTemplate('Devolução não aprovada', `<p style="text-align:center;color:#ccc">Analisamos sua solicitação e, infelizmente, não foi possível aprová-la dessa vez.${d.resposta_admin ? ` Motivo: ${esc(d.resposta_admin)}` : ''} Qualquer dúvida, fale com a gente.</p>`)
  }),
  reembolsado: (d, pedido) => ({
    assunto: `💰 Reembolso creditado no seu saldo Zipshop`,
    html: baseTemplate('💰 Reembolso creditado!', `<p style="text-align:center;color:#ccc">O valor de R$ ${Number(pedido?.total||0).toFixed(2).replace('.',',')} foi creditado como saldo na sua conta Zipshop — já pode usar na próxima compra.</p>`)
  })
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    // 1. Só admin: verifica o token de login e confere se o e-mail é admin
    const h = event.headers || {};
    const token = (h.authorization || h.Authorization || '').replace(/^Bearer /i, '');
    const user = await getUser(token);
    if (!user || !adminEmails().includes(String(user.email || '').toLowerCase())) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ erro: 'Acesso restrito ao admin.' }) };
    }

    const { pedido, tipo, devolucao } = JSON.parse(event.body || '{}');

    let assunto, html;
    if (devolucao && TEMPLATES_DEVOLUCAO[tipo]) {
      const t = TEMPLATES_DEVOLUCAO[tipo](devolucao, pedido); assunto = t.assunto; html = t.html;
    } else if (pedido && TEMPLATES_STATUS[tipo]) {
      const t = TEMPLATES_STATUS[tipo](pedido); assunto = t.assunto; html = t.html;
    } else {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'Tipo de e-mail invalido ou dados incompletos' }) };
    }

    // 2. Destinatário vem do banco (pelo id do pedido), nunca do corpo
    const destinatario = pedido && pedido.id ? await buscarEmailPedido(pedido.id) : null;
    if (!destinatario) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'Destinatario nao encontrado' }) };
    }

    await enviarEmail(destinatario, assunto, html);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sucesso: true }) };
  } catch (err) {
    console.error('Erro ao enviar email de status');
    return { statusCode: 500, body: JSON.stringify({ erro: 'Nao foi possivel enviar o e-mail.' }) };
  }
};

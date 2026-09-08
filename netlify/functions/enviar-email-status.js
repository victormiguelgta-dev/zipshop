// Envia e-mails de atualização de pedido (saiu para entrega, entregue)
// e de devolução (aprovada, rejeitada, reembolsada). Complementa o
// enviar-email-pedido.js, que só cobre a confirmação inicial da compra.
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
    assunto: `🛵 Seu pedido saiu para entrega! #${pedido.id.slice(0,8).toUpperCase()}`,
    html: baseTemplate('🛵 Saiu para entrega!', `
      <p style="text-align:center;color:#ccc;margin-bottom:20px">Pedido #${pedido.id.slice(0,8).toUpperCase()} está a caminho.</p>
      ${pedido.codigo_confirmacao ? `
      <div style="background:#1a1a1a;border:1px solid #AAEF00;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px">
        <p style="font-size:11px;color:#999;text-transform:uppercase;margin-bottom:4px">Código de confirmação</p>
        <p style="font-size:24px;font-weight:900;color:#AAEF00;letter-spacing:2px">${esc(pedido.codigo_confirmacao)}</p>
        <p style="font-size:12px;color:#999;margin-top:4px">Informe esse código pro entregador na hora da entrega.</p>
      </div>` : ''}
    `)
  }),
  entregue: (pedido) => ({
    assunto: `✅ Pedido entregue! #${pedido.id.slice(0,8).toUpperCase()}`,
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pedido, tipo, devolucao } = JSON.parse(event.body);

    let assunto, html, destinatario;

    if (devolucao && TEMPLATES_DEVOLUCAO[tipo]) {
      const t = TEMPLATES_DEVOLUCAO[tipo](devolucao, pedido);
      assunto = t.assunto; html = t.html;
      destinatario = pedido?.usuario_email;
    } else if (pedido && TEMPLATES_STATUS[tipo]) {
      const t = TEMPLATES_STATUS[tipo](pedido);
      assunto = t.assunto; html = t.html;
      destinatario = pedido.usuario_email;
    } else {
      return { statusCode: 400, body: JSON.stringify({ erro: 'Tipo de e-mail inválido ou dados incompletos' }) };
    }

    if (!destinatario) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'E-mail do destinatário não encontrado' }) };
    }

    const resultado = await enviarEmail(destinatario, assunto, html);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ sucesso: true, resultado })
    };
  } catch (err) {
    console.error('Erro ao enviar email de status:', err);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Não foi possível enviar o e-mail.' }) };
  }
};

// Roda automaticamente (agendado no netlify.toml) — verifica carrinhos
// parados há mais de 3 horas e manda um lembrete por e-mail, uma única
// vez por carrinho.
const https = require('https');

function supabaseRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://kkliwdphrdbguclsvxcw.supabase.co/rest/v1${path}`);
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation'
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body || '[]') }); }
        catch { resolve({ status: res.statusCode, data: [] }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function enviarEmail(destinatario, assunto, html) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ from: 'Zipshop <onboarding@resend.dev>', to: [destinatario], subject: assunto, html });
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve({status:res.statusCode})); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

exports.handler = async () => {
  try {
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: carrinhos } = await supabaseRequest(
      `/carrinhos_ativos?lembrete_enviado=eq.false&atualizado_em=lt.${tresHorasAtras}`
    );

    let enviados = 0;
    for (const c of (carrinhos || [])) {
      if (!c.usuario_email || !c.itens?.length) continue;

      const itensHTML = c.itens.map(i => `
        <tr><td style="padding:6px 0;color:#ccc;font-size:13px">${esc(i.emoji||'📦')} ${esc(i.name)}</td>
        <td style="padding:6px 0;text-align:right;color:#ccc;font-size:13px">R$ ${Number((i.price||0)*(i.qty||1)).toFixed(2).replace('.',',')}</td></tr>`).join('');

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
          <div style="text-align:center;margin-bottom:20px">
            <span style="font-size:24px;font-weight:900;color:#AAEF00">ZIP</span><span style="font-size:24px;font-weight:900;color:#fff">SHOP</span>
          </div>
          <h1 style="font-size:19px;text-align:center;margin-bottom:8px">🛒 Você esqueceu isso aqui...</h1>
          <p style="text-align:center;color:#999;margin-bottom:20px">Seu carrinho ainda está esperando por você!</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${itensHTML}</table>
          <div style="text-align:center">
            <a href="https://zipshop01.netlify.app/carrinho.html" style="display:inline-block;background:#AAEF00;color:#000;font-weight:900;padding:12px 28px;border-radius:10px;text-decoration:none">Finalizar Compra →</a>
          </div>
        </div>`;

      await enviarEmail(c.usuario_email, '🛒 Você esqueceu itens no seu carrinho — Zipshop', html);
      await supabaseRequest(`/carrinhos_ativos?usuario_id=eq.${c.usuario_id}`, {
        method: 'PATCH',
        body: { lembrete_enviado: true },
        prefer: 'return=minimal'
      });
      enviados++;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, enviados }) };
  } catch (err) {
    console.error('Erro no lembrete de carrinho abandonado:', err);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao processar carrinhos abandonados' }) };
  }
};

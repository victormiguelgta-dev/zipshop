// Chamado quando o cliente tenta trocar CPF ou telefone no perfil.
// Gera um código de 6 dígitos com crypto (não Math.random), guarda a
// troca pendente no banco (service role key) e manda o código para o
// e-mail REAL do usuário salvo no banco — nunca para um e-mail que veio
// no corpo da requisição. Assim, mesmo que alguém chame com o id de
// outra pessoa, o código vai para o dono verdadeiro da conta.
const https = require('https');
const crypto = require('crypto');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const url = new URL(`${supabaseUrl}${path}`);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname, path: url.pathname + url.search, method,
      headers: {
        'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let out = ''; res.on('data', chunk => out += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(out || '[]') }); } catch (e) { resolve({ status: res.statusCode, body: out }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
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
    const req = https.request(options, (res) => { let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({status:res.statusCode, body})); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function validarCPFReal(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

const DDDS_VALIDOS = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);
function validarTelefoneReal(telefone) {
  const t = String(telefone || '').replace(/\D/g, '');
  if (t.length !== 10 && t.length !== 11) return false;
  if (/^(\d)\1+$/.test(t)) return false;
  const ddd = parseInt(t.slice(0, 2), 10);
  if (!DDDS_VALIDOS.has(ddd)) return false;
  if (t.length === 11 && t[2] !== '9') return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const CORS = { 'Access-Control-Allow-Origin': 'https://zipshop01.netlify.app' };
  try {
    // O e-mail NÃO é lido do corpo — é buscado no banco pelo usuario_id.
    const { usuario_id, campo, valor_novo } = JSON.parse(event.body || '{}');

    if (!usuario_id || !uuidRegex.test(String(usuario_id)) || !['cpf', 'telefone'].includes(campo) || !valor_novo) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'Dados inválidos.' }) };
    }

    const valorLimpo = String(valor_novo).replace(/\D/g, '');

    if (campo === 'cpf') {
      if (!validarCPFReal(valorLimpo)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'CPF inválido.' }) };
      }
      const disponivel = await supabaseRequest('POST', '/rest/v1/rpc/cpf_disponivel', { cpf_input: valorLimpo, usuario_atual: usuario_id });
      if (disponivel.body === false) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ erro: 'Este CPF já está em uso por outra conta.' }) };
      }
    } else {
      if (!validarTelefoneReal(valorLimpo)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'Telefone inválido.' }) };
      }
    }

    // Busca o e-mail REAL do usuário no banco (destino do código)
    const usuarioResp = await supabaseRequest('GET', `/rest/v1/usuarios?id=eq.${usuario_id}&select=email`);
    const emailReal = Array.isArray(usuarioResp.body) && usuarioResp.body[0] ? usuarioResp.body[0].email : null;
    if (!emailReal) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ erro: 'Usuário não encontrado.' }) };
    }

    // Limite: no máximo um código por minuto por campo
    const existente = await supabaseRequest('GET', `/rest/v1/confirmacoes_pendentes?usuario_id=eq.${usuario_id}&campo=eq.${campo}&order=created_at.desc&limit=1`);
    const ultimo = Array.isArray(existente.body) ? existente.body[0] : null;
    if (ultimo && (Date.now() - new Date(ultimo.created_at).getTime()) < 60000) {
      return { statusCode: 429, headers: CORS, body: JSON.stringify({ erro: 'Aguarde um minuto antes de pedir um novo código.' }) };
    }

    const codigo = String(crypto.randomInt(100000, 1000000));
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseRequest('DELETE', `/rest/v1/confirmacoes_pendentes?usuario_id=eq.${usuario_id}&campo=eq.${campo}`);

    const insercao = await supabaseRequest('POST', '/rest/v1/confirmacoes_pendentes', {
      usuario_id, campo, valor_novo: valorLimpo, codigo, expira_em: expiraEm
    });

    if (insercao.status >= 300) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ erro: 'Não foi possível gerar a confirmação.' }) };
    }

    const nomeCampo = campo === 'cpf' ? 'CPF' : 'telefone';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
        <p style="text-align:center;margin-bottom:16px"><span style="font-size:22px;font-weight:900;color:#AAEF00">ZIP</span><span style="font-size:22px;font-weight:900;color:#fff">SHOP</span></p>
        <h1 style="font-size:18px;text-align:center;margin-bottom:12px">Confirme a alteração do seu ${nomeCampo}</h1>
        <p style="text-align:center;color:#ccc;font-size:14px;margin-bottom:24px">Use o código abaixo para confirmar essa alteração no seu cadastro. Ele expira em 15 minutos.</p>
        <p style="text-align:center;font-size:32px;font-weight:900;letter-spacing:6px;color:#AAEF00;margin-bottom:24px">${codigo}</p>
        <p style="text-align:center;color:#666;font-size:12px">Se você não pediu essa alteração, ignore este e-mail.</p>
      </div>`;

    await enviarEmail(emailReal, `Confirme a alteração do seu ${nomeCampo} — Zipshop`, html);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sucesso: true }) };
  } catch (err) {
    console.error('Erro em solicitar-confirmacao-dados');
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ erro: 'Erro interno.' }) };
  }
};

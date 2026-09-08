// netlify/functions/confirmar-alteracao-dados.js
//
// Chamado quando o cliente digita o código de 6 dígitos recebido por
// e-mail. A validação do código acontece aqui, no servidor, com a
// service role key — o front-end nunca compara o código sozinho,
// senão daria pra forjar a confirmação editando o JS no navegador.

const https = require('https');

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const url = new URL(`${supabaseUrl}${path}`);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let out = '';
      res.on('data', chunk => out += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out || '[]') }); }
        catch (e) { resolve({ status: res.statusCode, body: out }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { usuario_id, campo, codigo } = JSON.parse(event.body);

    if (!usuario_id || !['cpf', 'telefone'].includes(campo) || !/^\d{6}$/.test(String(codigo || ''))) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: 'Dados inválidos.' }) };
    }

    const busca = await supabaseRequest('GET', `/rest/v1/confirmacoes_pendentes?usuario_id=eq.${usuario_id}&campo=eq.${campo}&order=created_at.desc&limit=1`);
    const pendencia = Array.isArray(busca.body) ? busca.body[0] : null;

    if (!pendencia) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: 'Nenhuma confirmação pendente. Solicite um novo código.' }) };
    }

    if (new Date(pendencia.expira_em).getTime() < Date.now()) {
      await supabaseRequest('DELETE', `/rest/v1/confirmacoes_pendentes?id=eq.${pendencia.id}`);
      return { statusCode: 410, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: 'Código expirado. Solicite um novo.' }) };
    }

    if (pendencia.tentativas >= 5) {
      await supabaseRequest('DELETE', `/rest/v1/confirmacoes_pendentes?id=eq.${pendencia.id}`);
      return { statusCode: 429, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: 'Muitas tentativas erradas. Solicite um novo código.' }) };
    }

    if (String(codigo) !== pendencia.codigo) {
      await supabaseRequest('PATCH', `/rest/v1/confirmacoes_pendentes?id=eq.${pendencia.id}`, { tentativas: pendencia.tentativas + 1 });
      return { statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: 'Código incorreto.' }) };
    }

    // Código certo: aplica a troca de verdade na tabela usuarios.
    // Se for CPF, o índice único do banco garante que não dá pra
    // aplicar um CPF que virou duplicado nesse meio tempo.
    const atualizacao = await supabaseRequest('PATCH', `/rest/v1/usuarios?id=eq.${usuario_id}`, { [campo]: pendencia.valor_novo });

    if (atualizacao.status >= 300) {
      const mensagem = String(atualizacao.body?.message || '').includes('usuarios_cpf_unico_idx')
        ? 'Este CPF já está em uso por outra conta.'
        : 'Não foi possível salvar a alteração.';
      return { statusCode: 409, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: mensagem }) };
    }

    await supabaseRequest('DELETE', `/rest/v1/confirmacoes_pendentes?id=eq.${pendencia.id}`);

    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ sucesso: true, valor: pendencia.valor_novo }) };

  } catch (err) {
    console.error('Erro em confirmar-alteracao-dados:', err);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: 'Erro interno.' }) };
  }
};

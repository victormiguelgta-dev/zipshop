// Roda automaticamente (agendado no netlify.toml), de hora em hora.
//
// Problema que resolve: quando o cliente fecha a aba do Mercado Pago sem
// pagar, o MP não avisa nada (não existe pagamento para notificar). O
// pedido ficava 'pendente' para sempre, prendendo o saldo usado, o cupom
// e o estoque.
//
// O que faz: pega pedidos Pix/cartão ainda 'pendente' criados há mais que
// o prazo, pergunta ao Mercado Pago se existe pagamento e:
//   - aprovado  -> marca 'pago' (se o valor bater), não cancela
//   - em andamento -> deixa quieto (o webhook resolve)
//   - nenhum / recusado / expirado -> marca 'cancelado'
// Ao virar 'cancelado', os triggers do banco devolvem saldo, cupom e estoque.
// Pedidos em dinheiro (pagamento na entrega) nunca são mexidos aqui.
const https = require('https');

// Tem que ser igual ao PRAZO_PAGAMENTO_HORAS do criar-pagamento.js.
// A folga de 1h evita cancelar um pagamento feito no último minuto.
const PRAZO_PAGAMENTO_HORAS = 24;
const FOLGA_HORAS = 1;
const MAX_POR_EXECUCAO = 50;

function requisicao(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(url, {
      method,
      headers: {
        ...headers,
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(b || 'null'); } catch { /* resposta sem JSON */ }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function supabase(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return requisicao(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' }
  });
}

function pagamentosDoPedido(pedidoId) {
  return requisicao(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${pedidoId}&sort=date_created&criteria=desc`,
    { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
  );
}

// Atualiza só se o pedido AINDA estiver pendente (evita brigar com o webhook)
function mudarStatus(pedidoId, status) {
  return supabase(`/pedidos?id=eq.${pedidoId}&status=eq.pendente`, { method: 'PATCH', body: { status } });
}

exports.handler = async () => {
  const resumo = { cancelados: 0, pagos: 0, aguardando: 0, erros: 0 };
  try {
    // created_at é gravado em UTC sem fuso; comparar com ISO sem 'Z' mantém UTC
    const limite = new Date(Date.now() - (PRAZO_PAGAMENTO_HORAS + FOLGA_HORAS) * 60 * 60 * 1000)
      .toISOString().replace('Z', '');

    const { status, data: pedidos } = await supabase(
      `/pedidos?select=id,total&status=eq.pendente&pagamento=in.(pix,cartao)` +
      `&created_at=lt.${limite}&order=created_at.asc&limit=${MAX_POR_EXECUCAO}`
    );
    if (status !== 200 || !Array.isArray(pedidos)) {
      console.error(`Não consegui listar pedidos pendentes: HTTP ${status}`);
      return { statusCode: 500 };
    }

    for (const pedido of pedidos) {
      try {
        const mp = await pagamentosDoPedido(pedido.id);
        if (mp.status !== 200) { resumo.erros++; continue; } // na dúvida, não cancela

        const pagamentos = mp.data?.results || [];
        const aprovado = pagamentos.find(p => p.status === 'approved');
        const emAndamento = pagamentos.some(p => ['pending', 'in_process', 'authorized'].includes(p.status));

        if (aprovado) {
          const pago = Number(aprovado.transaction_amount || 0);
          if (Math.abs(pago - Number(pedido.total || 0)) <= 0.10) {
            await mudarStatus(pedido.id, 'pago');
            resumo.pagos++;
          } else {
            console.warn(`Pedido ${pedido.id}: pago no MP com valor diferente do total, precisa de revisão`);
            resumo.aguardando++;
          }
        } else if (emAndamento) {
          resumo.aguardando++;
        } else {
          const r = await mudarStatus(pedido.id, 'cancelado');
          if (r.status >= 300) { resumo.erros++; continue; }
          resumo.cancelados++;
        }
      } catch (e) {
        resumo.erros++;
      }
    }

    console.log('expirar-pedidos-pendentes:', JSON.stringify(resumo));
    return { statusCode: 200 };
  } catch (err) {
    console.error('Erro em expirar-pedidos-pendentes');
    return { statusCode: 500 };
  }
};

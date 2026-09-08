// js/validadores.js
// Validações reais de CPF e telefone, compartilhadas por cadastro.html,
// checkout.html e conta.html. Antes cada página tinha sua própria regra
// (algumas só contavam dígitos), o que deixava passar CPFs e telefones
// falsos como 000.000.000-00 ou (61) 11900-00000.
//
// IMPORTANTE: isso roda no navegador e pode ser contornado por quem quiser
// (desabilitando JS ou chamando a API do Supabase direto). Serve para
// UX / evitar erro de digitação — a validação que realmente protege o
// banco de dados precisa existir no backend (constraint no Postgres ou
// Edge Function). Ver nota separada sobre isso.

// Lista de DDDs válidos no Brasil (Anatel)
const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19,
  21,22,24,27,28,
  31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,
  51,53,54,55,
  61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,
  81,82,83,84,85,86,87,88,89,
  91,92,93,94,95,96,97,98,99
]);

/**
 * Valida CPF de verdade: 11 dígitos, rejeita sequências repetidas
 * (000.000.000-00, 111.111.111-11 etc) e confere os dois dígitos
 * verificadores (algoritmo oficial da Receita Federal).
 */
function validarCPFReal(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1+$/.test(c)) return false; // todos os dígitos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

/**
 * Valida telefone de verdade:
 * - Exatamente 10 (fixo) ou 11 (celular) dígitos — nunca 12+ como
 *   "611190000000".
 * - DDD precisa existir na lista de DDDs reais da Anatel.
 * - Celular (11 dígitos) precisa começar com 9 depois do DDD.
 * - Rejeita o número inteiro repetido (111111111 etc) e o "corpo"
 *   do número todo zerado (ex: 61 900000000), que é o padrão de
 *   "611190000000".
 */
function validarTelefoneReal(telefone) {
  const t = String(telefone || '').replace(/\D/g, '');
  if (t.length !== 10 && t.length !== 11) return false;
  if (/^(\d)\1+$/.test(t)) return false;

  const ddd = parseInt(t.slice(0, 2), 10);
  if (!DDDS_VALIDOS.has(ddd)) return false;

  const numero = t.slice(2);
  if (t.length === 11 && numero[0] !== '9') return false;
  if (/^0+$/.test(numero.slice(1))) return false; // corpo do número todo zero

  return true;
}

// Disponibiliza no escopo global (uso em <script> comum, sem import/export)
window.validarCPFReal = validarCPFReal;
window.validarTelefoneReal = validarTelefoneReal;

/**
 * Mascara o CPF para exibição: mostra só os 5 últimos dígitos
 * (bloco + dígitos verificadores) e esconde o resto.
 * Ex: 123.456.789-00  ->  •••.•••.789-00
 * Nunca deve ser usado o CPF completo em nenhuma tela do site.
 */
function mascararCPF(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
  if (c.length !== 11) return '•••.•••.•••-••';
  return `•••.•••.${c.slice(6, 9)}-${c.slice(9, 11)}`;
}
window.mascararCPF = mascararCPF;

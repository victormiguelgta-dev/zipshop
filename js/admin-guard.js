/**
 * admin-guard.js
 * Protege todas as páginas do painel admin.
 * 
 * Como funciona:
 * 1. Verifica se há usuário logado
 * 2. Verifica se o e-mail está na lista de admins
 * 3. Se não for admin, redireciona para o login
 * 
 * Para adicionar um admin novo, acrescente o e-mail na lista ADMIN_EMAILS abaixo.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(
  'https://kkliwdphrdbguclsvxcw.supabase.co',
  'sb_publishable_OMXANLsZK98fPWygp8ZHfA_xzSpWgYb'
);

// ✏️ LISTA DE ADMINS — adicione o e-mail do cliente aqui quando precisar
const ADMIN_EMAILS = [
  'victormiguelgta@gmail.com',
  'admin@zipshop.com',
  // 'email-do-cliente@exemplo.com',
];

async function verificarAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;

  if (!user) {
    // Não está logado — redireciona para o login
    window.location.replace('../login.html?redirect=admin');
    return false;
  }

  if (!ADMIN_EMAILS.includes(user.email)) {
    // Está logado mas não é admin — mostra erro e redireciona
    document.body.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:20px
      ">
        <div style="font-size:64px;margin-bottom:16px">🚫</div>
        <h1 style="font-size:24px;margin-bottom:8px">Acesso negado</h1>
        <p style="color:#888;margin-bottom:24px">
          Você não tem permissão para acessar o painel administrativo.<br>
          Logado como: <strong>${user.email}</strong>
        </p>
        <div style="display:flex;gap:12px">
          <a href="../index.html" style="
            background:#AAEF00;color:#000;padding:10px 20px;border-radius:8px;
            text-decoration:none;font-weight:700
          ">Ir para a Loja</a>
          <button onclick="logout()" style="
            background:transparent;border:1px solid #444;color:#fff;padding:10px 20px;
            border-radius:8px;cursor:pointer;font-weight:700
          ">Trocar de Conta</button>
        </div>
      </div>
    `;

    window.logout = async () => {
      await supabase.auth.signOut();
      window.location.href = '../login.html';
    };

    return false;
  }

  return true; // É admin — pode continuar
}

// Executa a verificação ao carregar
const isAdmin = await verificarAdmin();
export { isAdmin, supabase };
